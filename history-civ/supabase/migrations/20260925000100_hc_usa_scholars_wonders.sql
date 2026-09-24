-- =====================================================================
-- 미국 문명 · 문명별 도시 이름 · 도서관/지식인 · 불가사의 10턴 방어 승리
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 문명별 도시 이름 풀: 미사용 이름을 순서대로 배정
-- ---------------------------------------------------------------------
create table if not exists public.hc_city_names (
  faction hc_faction_type not null,
  ord     int  not null,
  name    text not null,
  primary key (faction, ord)
);
insert into public.hc_city_names (faction, ord, name)
select f::hc_faction_type, o, n from (values
  ('france', 1, '파리'), ('france', 2, '마르세유'), ('france', 3, '리옹'), ('france', 4, '보르도'),
  ('france', 5, '툴루즈'), ('france', 6, '낭트'), ('france', 7, '릴'), ('france', 8, '스트라스부르'),
  ('britain', 1, '런던'), ('britain', 2, '리버풀'), ('britain', 3, '맨체스터'), ('britain', 4, '버밍엄'),
  ('britain', 5, '에든버러'), ('britain', 6, '글래스고'), ('britain', 7, '리즈'), ('britain', 8, '브리스틀'),
  ('empire', 1, '베를린'), ('empire', 2, '뮌헨'), ('empire', 3, '함부르크'), ('empire', 4, '쾰른'),
  ('empire', 5, '프랑크푸르트'), ('empire', 6, '드레스덴'), ('empire', 7, '빈'), ('empire', 8, '프라하'),
  ('usa', 1, '워싱턴 D.C.'), ('usa', 2, '뉴욕'), ('usa', 3, '보스턴'), ('usa', 4, '필라델피아'),
  ('usa', 5, '시카고'), ('usa', 6, '샌프란시스코'), ('usa', 7, '볼티모어'), ('usa', 8, '뉴올리언스')
) v(f, o, n)
on conflict do nothing;
alter table public.hc_city_names enable row level security;
create policy "rules readable" on public.hc_city_names for select to authenticated using (true);

create or replace function public.hc__next_city_name(p_room uuid, p_player uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_name text; v_faction hc_faction_type; v_n int;
begin
  select faction into v_faction from hc_room_players where room_id = p_room and user_id = p_player;
  select cn.name into v_name from hc_city_names cn
   where cn.faction = v_faction
     and not exists (select 1 from hc_tiles t where t.room_id = p_room and t.is_city and t.city_name = cn.name)
   order by cn.ord limit 1;
  if v_name is not null then return v_name; end if;
  select count(*) + 1 into v_n from hc_tiles where room_id = p_room and owner_id = p_player and is_city;
  return '신도시 ' || v_n;
end $$;

-- ---------------------------------------------------------------------
-- 2) 도서관(시설) · 학자 유닛
-- ---------------------------------------------------------------------
do $mig$
begin
  alter table public.hc_tiles drop constraint if exists hc_tiles_improvement_check;
  alter table public.hc_tiles add constraint hc_tiles_improvement_check
    check (improvement in ('farm', 'railway', 'factory', 'port', 'library'));
end $mig$;

insert into public.hc_unit_types
  (kind, name_ko, attack, defense, moves, initiative, range, cost, naval, is_hero, faction, requires_tech)
values ('scholar', '학자', 0, 1, 1, 1, 1, 999, false, true, null, null)
on conflict (kind) do nothing;

create or replace function public.hc__valid_action(a jsonb)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(
    case a->>'type'
      when 'move'       then a->>'unit_id' ~* '^[0-9a-f-]{36}$'
                             and a->>'x' ~ '^\d{1,3}$' and a->>'y' ~ '^\d{1,3}$'
      when 'found_city' then a->>'unit_id' ~* '^[0-9a-f-]{36}$'
                             and coalesce(char_length(a->>'name'), 0) <= 20
      when 'produce'    then a->>'x' ~ '^\d{1,3}$' and a->>'y' ~ '^\d{1,3}$'
                             and a->>'unit_kind' ~ '^[a-z_]{1,30}$'
      when 'build'      then a->>'x' ~ '^\d{1,3}$' and a->>'y' ~ '^\d{1,3}$'
                             and a->>'improvement' in ('farm', 'railway', 'factory', 'port', 'library')
      when 'research'   then a->>'tech' ~ '^[a-z_]{1,30}$'
      when 'spread'     then true
      else false
    end, false);
$$;

-- 지식인 정의: 문명마다 2명 (첫 번째 도서관 → 1번, 두 번째 도서관 → 2번)
create table if not exists public.hc_scholar_defs (
  id           text primary key,
  faction      hc_faction_type not null,
  ord          int not null,
  name         text not null,
  era          text not null,
  icon         text not null,
  works        text not null,
  significance text not null,
  effect       text not null,
  unique (faction, ord)
);
insert into public.hc_scholar_defs values
  ('voltaire', 'france', 1, '볼테르', '18세기 계몽사상가', '🖋️',
   '《철학 서한》(1734) · 《관용론》(1763)',
   '이성과 종교적 관용, 표현의 자유를 주장하며 절대 왕정과 교회의 권위를 비판했습니다. 계몽사상은 프랑스 혁명의 사상적 바탕이 되었어요.',
   '혁신 +3/턴 (연구 가속)'),
  ('rousseau', 'france', 2, '장 자크 루소', '18세기 계몽사상가', '📘',
   '《사회계약론》(1762) · 《에밀》(1762)',
   '"국가의 주인은 국민"이라는 국민 주권론을 펼쳐 프랑스 혁명과 인권선언에 큰 영향을 주었습니다.',
   '혁신 +3/턴, 혁명 이념 +5'),
  ('dickens', 'britain', 1, '찰스 디킨스', '산업혁명기 소설가', '📚',
   '《올리버 트위스트》(1838) · 《어려운 시절》(1854) · 《두 도시 이야기》(1859)',
   '산업혁명 시기 공장 노동자와 아동, 빈민의 비참한 삶을 그려 사회 개혁 여론을 이끌었습니다.',
   '혁신 +3/턴, 안정도 +10'),
  ('adam_smith', 'britain', 2, '애덤 스미스', '고전 경제학자', '⚖️',
   '《국부론》(1776)',
   '분업과 자유로운 시장 경쟁이 나라를 부유하게 한다고 설명해 자본주의 경제학의 기초를 세웠습니다.',
   '혁신 +3/턴, 골드 +30'),
  ('kant', 'empire', 1, '임마누엘 칸트', '독일 계몽 철학자', '🧠',
   '《계몽이란 무엇인가》(1784) · 《순수이성비판》(1781)',
   '"감히 알려고 하라!" — 스스로 생각하는 용기를 강조하며 계몽의 뜻을 정리했습니다.',
   '혁신 +3/턴'),
  ('marx', 'empire', 2, '카를 마르크스', '사회주의 사상가', '🚩',
   '《공산당 선언》(1848) · 《자본론》(1867)',
   '산업혁명 이후 자본가와 노동자의 불평등을 비판하고 사회주의 운동에 큰 영향을 주었습니다.',
   '혁신 +3/턴, 혁명 이념 +5'),
  ('lincoln_scholar', 'usa', 1, '에이브러햄 링컨', '미국 16대 대통령', '🎩',
   '《게티스버그 연설》(1863) · 노예 해방 선언(1863)',
   '남북 전쟁 중 노예 해방을 선언하고 "국민의, 국민에 의한, 국민을 위한 정부"를 말해 민주주의 발전의 상징이 되었습니다.',
   '혁신 +3/턴, 링컨 인물 카드 합류(아직 없으면)'),
  ('jefferson', 'usa', 2, '토머스 제퍼슨', '미국 독립 선언서 기초자', '📜',
   '《독립 선언서》(1776)',
   '"모든 사람은 평등하게 태어났다"는 천부 인권 사상을 담아 미국 독립 혁명의 이념을 세웠습니다.',
   '혁신 +3/턴, 혁명 이념 +5')
on conflict (id) do nothing;

create table if not exists public.hc_player_scholars (
  room_id     uuid not null references public.hc_rooms(id) on delete cascade,
  scholar_id  text not null references public.hc_scholar_defs(id),
  player_id   uuid not null references public.hc_profiles(id),
  joined_turn int not null,
  seen        boolean not null default false,
  primary key (room_id, scholar_id)
);
alter table public.hc_scholar_defs    enable row level security;
alter table public.hc_player_scholars enable row level security;
create policy "rules readable" on public.hc_scholar_defs    for select to authenticated using (true);
create policy "members read"   on public.hc_player_scholars for select to authenticated using (public.hc_is_room_member(room_id));

-- 도서관 수만큼 지식인이 합류 (첫 합류 효과: 즉시 보너스 + 학자 유닛 등장)
create or replace function public.hc__check_scholars(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pl record; d hc_scholar_defs; v_lib int; v_have int; v_turn int; out jsonb := '[]';
begin
  select turn_number into v_turn from hc_rooms where id = p_room;
  for pl in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    select count(*) into v_lib from hc_tiles where room_id = p_room and owner_id = pl.user_id and improvement = 'library';
    select count(*) into v_have from hc_player_scholars where room_id = p_room and player_id = pl.user_id;
    while v_have < v_lib loop
      select * into d from hc_scholar_defs where faction = pl.faction and ord = v_have + 1;
      exit when not found;
      insert into hc_player_scholars (room_id, scholar_id, player_id, joined_turn, seen)
      values (p_room, d.id, pl.user_id, v_turn, pl.is_ai) on conflict do nothing;
      out := out || jsonb_build_object('type', 'scholar_joined', 'player', pl.user_id, 'scholar', d.id);
      out := out || hc__apply_effects(p_room, pl.user_id,
        case d.id
          when 'rousseau' then '{"ideology": 5, "spawn": {"kind": "scholar", "count": 1}}'
          when 'dickens' then '{"stability": 10, "spawn": {"kind": "scholar", "count": 1}}'
          when 'adam_smith' then '{"gold": 30, "spawn": {"kind": "scholar", "count": 1}}'
          when 'marx' then '{"ideology": 5, "spawn": {"kind": "scholar", "count": 1}}'
          when 'jefferson' then '{"ideology": 5, "spawn": {"kind": "scholar", "count": 1}}'
          when 'lincoln_scholar' then '{"leader": "lincoln", "spawn": {"kind": "scholar", "count": 1}}'
          else '{"spawn": {"kind": "scholar", "count": 1}}'
        end::jsonb);
      v_have := v_have + 1;
    end loop;
  end loop;
  return out;
end $$;

-- 사용자가 지식인 소개 팝업을 확인
create or replace function public.hc_ack_scholar(p_room uuid, p_scholar text)
returns void language sql security definer set search_path = public as $$
  update hc_player_scholars set seen = true
   where room_id = p_room and scholar_id = p_scholar and player_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3) 불가사의: 즉시 건설(망치), 완공 도시를 10턴 사수하면 승리
-- ---------------------------------------------------------------------
create table if not exists public.hc_wonder_defs (
  id            text primary key,
  name_ko       text not null,
  icon          text not null,
  faction       hc_faction_type,          -- null = 공통
  hammer_cost   int not null,
  requires_tech text references public.hc_techs(id),
  description   text not null,
  sort          int not null
);
insert into public.hc_wonder_defs values
  ('eiffel',         '에펠탑',                 '🗼', 'france',  110, 'steam_engine',    '1889년 파리 만국박람회를 위해 세운 철탑. 프랑스 혁명 100주년과 산업 기술의 상징.', 1),
  ('big_ben',        '빅벤',                   '🕰️', 'britain', 100, 'steam_engine',    '1859년 완공된 영국 국회의사당의 시계탑. 의회 민주주의와 대영 제국의 상징.', 2),
  ('empire_state',   '엠파이어 스테이트 빌딩', '🏙️', 'usa',     120, 'electrification', '1931년 뉴욕에 세워진 초고층 빌딩. 미국 산업과 전기 문명의 상징.', 3),
  ('manhattan',      '맨해튼 프로젝트',        '☢️', 'usa',     150, 'new_weapons',     '제2차 세계 대전 중 미국의 원자 폭탄 개발 계획. 과학 기술의 힘과 그 위험성을 보여 준다.', 4),
  ('crystal_palace', '수정궁',                 '🏛️', null,      100, 'steam_engine',    '1851년 런던 만국박람회장. 철과 유리로 지은 산업혁명의 전시장.', 5)
on conflict (id) do nothing;

create table if not exists public.hc_wonders (
  room_id    uuid not null references public.hc_rooms(id) on delete cascade,
  wonder_id  text not null references public.hc_wonder_defs(id),
  player_id  uuid not null references public.hc_profiles(id),
  x          int not null,
  y          int not null,
  built_turn int not null,          -- 방어 카운트다운 시작 턴 (점령되면 새 주인 기준으로 리셋)
  primary key (room_id, wonder_id)
);
alter table public.hc_wonder_defs enable row level security;
alter table public.hc_wonders     enable row level security;
create policy "rules readable" on public.hc_wonder_defs for select to authenticated using (true);
create policy "members read"   on public.hc_wonders     for select to authenticated using (public.hc_is_room_member(room_id));

create or replace function public.hc_build_wonder(p_room uuid, p_x int, p_y int, p_wonder text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl hc_room_players; w hc_wonder_defs; t hc_tiles; ev jsonb;
begin
  select * into r from hc_rooms where id = p_room for update;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  select * into pl from hc_room_players where room_id = p_room and user_id = auth.uid();
  if not found or pl.is_eliminated then raise exception 'NOT_MEMBER'; end if;
  if pl.has_ended_turn then raise exception 'TURN_ALREADY_ENDED'; end if;
  select * into w from hc_wonder_defs where id = p_wonder;
  if not found then raise exception 'NO_WONDER'; end if;
  if w.faction is not null and w.faction <> pl.faction then raise exception 'WRONG_FACTION'; end if;
  if w.requires_tech is not null and not (w.requires_tech = any (pl.researched)) then raise exception 'TECH_REQUIRED'; end if;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  if not found or not t.is_city or t.owner_id <> pl.user_id then raise exception 'NOT_YOUR_CITY'; end if;
  if exists (select 1 from hc_wonders where room_id = p_room and wonder_id = p_wonder) then raise exception 'WONDER_TAKEN'; end if;
  if exists (select 1 from hc_wonders where room_id = p_room and x = p_x and y = p_y) then raise exception 'CITY_HAS_WONDER'; end if;
  if pl.hammer < w.hammer_cost then raise exception 'NOT_ENOUGH_HAMMER'; end if;

  update hc_room_players set hammer = hammer - w.hammer_cost where room_id = p_room and user_id = pl.user_id;
  insert into hc_wonders (room_id, wonder_id, player_id, x, y, built_turn)
  values (p_room, p_wonder, pl.user_id, p_x, p_y, r.turn_number);
  ev := jsonb_build_array(jsonb_build_object('type', 'wonder_built', 'player', pl.user_id, 'wonder', p_wonder,
                                             'x', p_x, 'y', p_y, 'city', t.city_name));
  -- 전역 공지: 최신 로그에 붙이고 action_seq로 모든 화면을 새로고침
  update hc_turn_logs set events = events || ev where id = (select max(id) from hc_turn_logs where room_id = p_room);
  perform hc__bump(p_room);
  return ev;
end $$;

-- 정산 후: 점령된 불가사의는 새 주인에게 인계(카운트다운 리셋), 10턴 사수하면 승리
create or replace function public.hc__check_wonders(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; w record; v_owner uuid; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  for w in select * from hc_wonders where room_id = p_room order by built_turn loop
    select owner_id into v_owner from hc_tiles where room_id = p_room and x = w.x and y = w.y;
    if v_owner is distinct from w.player_id then
      update hc_wonders set player_id = v_owner, built_turn = r.turn_number where room_id = p_room and wonder_id = w.wonder_id;
      out := out || jsonb_build_object('type', 'wonder_captured', 'wonder', w.wonder_id, 'from', w.player_id, 'player', v_owner);
    elsif r.turn_number - w.built_turn >= 10
          and exists (select 1 from hc_room_players where room_id = p_room and user_id = w.player_id and not is_eliminated) then
      out := out || jsonb_build_object('type', 'wonder_victory', 'wonder', w.wonder_id, 'player', w.player_id);
      update hc_turn_logs set events = events || out where id = (select max(id) from hc_turn_logs where room_id = p_room);
      perform hc__finish_game(p_room, w.player_id, 'wonder');
      return '[]';
    end if;
  end loop;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- 4) 문명 특성 · 지식인/도서관 패시브
-- ---------------------------------------------------------------------
create or replace function public.hc__faction_passives(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 미국: 개척지의 풍요(식량 +2), 민주주의(이념 +1)
  update hc_room_players set food = food + 2, ideology = ideology + 1
   where room_id = p_room and faction = 'usa' and not is_eliminated;
  -- 지식인 1명당 혁신 +3, 도서관 1곳당 혁신 +2 (연구 진행에 바로 더하고 표시용 혁신에도 반영)
  update hc_room_players rp set
    research_progress = rp.research_progress + b.bonus,
    innovation = rp.innovation + b.bonus
    from (select pl.user_id,
                 3 * (select count(*) from hc_player_scholars s where s.room_id = p_room and s.player_id = pl.user_id)
               + 2 * (select count(*) from hc_tiles t where t.room_id = p_room and t.owner_id = pl.user_id and t.improvement = 'library') as bonus
            from hc_room_players pl where pl.room_id = p_room) b
   where rp.room_id = p_room and rp.user_id = b.user_id and b.bonus > 0 and not rp.is_eliminated;
end $$;

-- 미국 개척 정신: 개척자 비용 30 → 20 (기존 인물 할인 규칙 유지)
create or replace function public.hc__unit_cost(p_room uuid, p_player uuid, p_kind text, p_base int)
returns int language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'settler' and exists (select 1 from hc_room_players where room_id = p_room and user_id = p_player and faction = 'usa')
         then 20
    when p_kind = 'militia' and hc__has_leader(p_room, p_player, 'lincoln') then p_base / 2
    when hc__has_leader(p_room, p_player, 'bismarck')
         and exists (select 1 from hc_unit_types where kind = p_kind and attack > 0) then (p_base * 3) / 4
    else p_base
  end;
$$;

-- ---------------------------------------------------------------------
-- 5) 기존 함수에 연결: 도시 이름 풀, 도서관 비용/조건, AI 도시 이름
-- ---------------------------------------------------------------------
do $mig$
declare d text;
begin
  -- 정산 핵심: 도시 이름 · 도서관 비용(골드 35) · 도서관은 도시 + 계몽사상 필요
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  if position('hc__next_city_name' in d) = 0 then
    d := replace(d, 'city_name = coalesce(nullif(a.act->>''name'', ''''), ''새 도시'')',
                    'city_name = coalesce(nullif(a.act->>''name'', ''''), hc__next_city_name(p_room, a.player_id))');
  end if;
  if position('when ''library'' then 35' in d) = 0 then
    d := replace(d, 'when ''railway'' then 15 when ''factory'' then 30 end;',
                    'when ''railway'' then 15 when ''factory'' then 30 when ''library'' then 35 end;');
    d := replace(d, 'or (a.act->>''improvement'' = ''factory'' and not t.is_city)',
                    'or (a.act->>''improvement'' in (''factory'', ''library'') and not t.is_city)
      or (a.act->>''improvement'' = ''library'' and not (''enlightenment'' = any (p.researched)))');
  end if;
  execute d;

  -- 게임 시작: 수도 이름을 문명 풀의 첫 이름으로
  d := pg_get_functiondef('public.hc_start_game(uuid)'::regprocedure);
  d := replace(d, 'case p.faction when ''france'' then ''파리'' when ''britain'' then ''런던'' else ''베를린'' end',
                  'hc__next_city_name(p_room, p.user_id)');
  execute d;

  -- AI: 도시 이름을 직접 정하지 않고 문명 풀을 쓰게 한다
  d := pg_get_functiondef('public.hc__ai_actions(uuid,uuid)'::regprocedure);
  d := regexp_replace(d, ',\s*''name'', \(array\[[^]]*\]\)\[1 \+ floor\(random\(\) \* 8\)::int\]', '');
  execute d;
end $mig$;

create or replace function public.hc_unit_found_city(p_room uuid, p_unit uuid, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u hc_units; t hc_tiles; v_name text;
begin
  u := hc__act_guard(p_room, p_unit);
  if u.kind <> 'settler' then raise exception 'NOT_SETTLER'; end if;
  select * into t from hc_tiles where room_id = p_room and x = u.x and y = u.y;
  if t.terrain in ('water', 'mountain') or (t.owner_id is not null and t.owner_id <> u.owner_id)
     or exists (select 1 from hc_tiles g where g.room_id = p_room and g.is_city
                 and greatest(abs(g.x - u.x), abs(g.y - u.y)) <= 2) then
    raise exception 'CANNOT_FOUND_HERE';
  end if;
  v_name := coalesce(nullif(trim(p_name), ''), hc__next_city_name(p_room, u.owner_id));
  update hc_tiles set is_city = true, city_pop = 1, owner_id = u.owner_id, city_name = left(v_name, 20)
   where room_id = p_room and x = u.x and y = u.y;
  update hc_tiles set owner_id = u.owner_id
   where room_id = p_room and owner_id is null and greatest(abs(x - u.x), abs(y - u.y)) <= 1;
  delete from hc_units where id = u.id;
  perform hc__bump(p_room);
  return jsonb_build_object('events', jsonb_build_array(
    jsonb_build_object('type', 'city_founded', 'player', u.owner_id, 'x', u.x, 'y', u.y, 'name', v_name)));
end $$;

-- ---------------------------------------------------------------------
-- 6) 정산 래퍼: + 문명 특성, 지식인, 불가사의 방어
-- ---------------------------------------------------------------------
create or replace function public.hc__resolve_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_turn int; a record; v_winner uuid; v_status hc_room_status; ev jsonb := '[]';
begin
  select turn_number into v_turn from hc_rooms where id = p_room;

  for a in select id from hc_player_events where room_id = p_room and status = 'pending' and turn <= v_turn loop
    ev := ev || hc__resolve_event(a.id, 'a');
  end loop;

  for a in select user_id from hc_room_players where room_id = p_room and is_ai and not is_eliminated loop
    insert into hc_turn_actions (room_id, turn, player_id, actions)
    values (p_room, v_turn, a.user_id, hc__ai_actions(p_room, a.user_id))
    on conflict (room_id, turn, player_id) do update set actions = excluded.actions, submitted_at = now();
  end loop;

  perform hc__resolve_turn_core(p_room);
  update hc_room_players set has_ended_turn = true where room_id = p_room and is_ai;
  update hc_units set acted = false where room_id = p_room;

  select status into v_status from hc_rooms where id = p_room;
  if v_status = 'playing' then
    perform hc__leader_passives(p_room);
    perform hc__faction_passives(p_room);
    ev := ev || hc__check_scholars(p_room) || hc__check_leaders(p_room) || hc__trigger_events(p_room);
  end if;
  if jsonb_array_length(ev) > 0 then
    update hc_turn_logs set events = events || ev
     where id = (select max(id) from hc_turn_logs where room_id = p_room);
  end if;

  -- 불가사의 방어 승리 (게임이 끝나면 이후 판정은 건너뛴다)
  if v_status = 'playing' then
    ev := hc__check_wonders(p_room);
    if jsonb_array_length(ev) > 0 then
      update hc_turn_logs set events = events || ev where id = (select max(id) from hc_turn_logs where room_id = p_room);
    end if;
  end if;

  if exists (select 1 from hc_rooms where id = p_room and is_solo and status = 'playing')
     and not exists (select 1 from hc_room_players where room_id = p_room and not is_ai and not is_eliminated) then
    select user_id into v_winner from hc_room_players
     where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7) 스냅샷: 지식인 · 불가사의 추가
-- ---------------------------------------------------------------------
create or replace function public.hc_get_game_state(p_room uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r hc_rooms;
begin
  if not hc_is_room_member(p_room) then raise exception 'NOT_MEMBER'; end if;
  select * into r from hc_rooms where id = p_room;
  return jsonb_build_object(
    'server_now', now(),
    'room',       to_jsonb(r),
    'players',    (select coalesce(jsonb_agg(to_jsonb(rp) order by rp.seat), '[]') from hc_room_players rp where rp.room_id = p_room),
    'tiles',      (select coalesce(jsonb_agg(to_jsonb(g) - 'room_id'), '[]') from hc_tiles g where g.room_id = p_room),
    'units',      (select coalesce(jsonb_agg(to_jsonb(u) - 'room_id'), '[]') from hc_units u where u.room_id = p_room),
    'my_actions', (select actions from hc_turn_actions where room_id = p_room and turn = r.turn_number and player_id = auth.uid()),
    'last_log',   (select events from hc_turn_logs where room_id = p_room order by id desc limit 1),
    'leaders',    (select coalesce(jsonb_agg(jsonb_build_object('leader_id', leader_id, 'player_id', player_id,
                                                                'joined_turn', joined_turn)), '[]')
                     from hc_player_leaders where room_id = p_room),
    'my_events',  (select coalesce(jsonb_agg((to_jsonb(d) - 'choice_a' - 'choice_b' - 'sort')
                                             || jsonb_build_object('pe_id', e.id, 'turn', e.turn) order by e.id), '[]')
                     from hc_player_events e join hc_event_defs d on d.id = e.event_id
                    where e.room_id = p_room and e.player_id = auth.uid() and e.status = 'pending'),
    'scholars',   (select coalesce(jsonb_agg(to_jsonb(d) || jsonb_build_object(
                                     'player_id', s.player_id, 'joined_turn', s.joined_turn,
                                     'seen', s.seen or s.player_id <> auth.uid()) order by s.joined_turn, d.ord), '[]')
                     from hc_player_scholars s join hc_scholar_defs d on d.id = s.scholar_id
                    where s.room_id = p_room),
    'wonders',    (select coalesce(jsonb_agg(jsonb_build_object(
                                     'wonder_id', w.wonder_id, 'player_id', w.player_id, 'x', w.x, 'y', w.y,
                                     'built_turn', w.built_turn,
                                     'turns_left', greatest(0, 10 - (r.turn_number - w.built_turn)),
                                     'name_ko', d.name_ko, 'icon', d.icon) order by w.built_turn), '[]')
                     from hc_wonders w join hc_wonder_defs d on d.id = w.wonder_id
                    where w.room_id = p_room)
  );
end $$;

revoke execute on function public.hc__next_city_name(uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.hc__check_scholars(uuid)                from public, anon, authenticated;
revoke execute on function public.hc__check_wonders(uuid)                 from public, anon, authenticated;
revoke execute on function public.hc__faction_passives(uuid)              from public, anon, authenticated;
revoke execute on function public.hc__unit_cost(uuid, uuid, text, int)    from public, anon, authenticated;
revoke execute on function public.hc__valid_action(jsonb)                 from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)                  from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn_core(uuid)             from public, anon, authenticated;
revoke execute on function public.hc__ai_actions(uuid, uuid)              from public, anon, authenticated;
revoke execute on function public.hc_start_game(uuid)                     from public, anon;
revoke execute on function public.hc_unit_found_city(uuid, uuid, text)    from public, anon;
revoke execute on function public.hc_build_wonder(uuid, int, int, text)   from public, anon;
revoke execute on function public.hc_ack_scholar(uuid, text)              from public, anon;
revoke execute on function public.hc_get_game_state(uuid)                 from public, anon;
