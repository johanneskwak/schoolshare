-- =====================================================================
-- 역사적 인물(LeaderSystem) · 역사적 사건(EventSystem) · 안정도
--   * 인물: 조건을 가장 먼저 만족한 문명에 합류(방마다 1명씩, 유일). 패시브 효과.
--   * 사건: 조건을 만족하면 플레이어별로 1회 발생 → 선택지 A/B.
--           사람은 hc_choose_event로 즉시 선택(바로 반영), 안 고르면 턴 종료 시 A로 결정.
--           AI는 발생 즉시 무작위 선택.
--   * 모든 판정은 턴 정산 트랜잭션 안에서 처리 (클라이언트는 읽기 + 선택만).
-- =====================================================================

alter table public.hc_room_players add column if not exists stability int not null default 60
  check (stability between 0 and 100);

-- ---------------------------------------------------------------------
-- 정의 테이블
-- ---------------------------------------------------------------------
create table if not exists public.hc_leader_defs (
  id          text primary key,
  name_ko     text not null,
  era         text not null,
  icon        text not null,
  effect_ko   text not null,
  condition_ko text not null,
  sort        int not null
);

insert into public.hc_leader_defs (id, name_ko, era, icon, effect_ko, condition_ko, sort) values
  ('napoleon', '나폴레옹 보나파르트', '프랑스 혁명', '👑', '군사 유닛 이동력 +1, 공격력 +2', '계몽사상 연구 (프랑스는 5턴부터)', 1),
  ('watt',     '제임스 와트',       '산업혁명',   '⚙️', '도시마다 망치 +3, 과학 기술 연구 +4/턴', '증기기관 연구', 2),
  ('lincoln',  '에이브러햄 링컨',   '시민 혁명',   '🎩', '안정도 +5·이념 +2/턴, 시민군 징집 가능 (비용 50%)', '혁명 이념 60 이상', 3),
  ('bismarck', '오토 폰 비스마르크', '제국주의',   '🪖', '골드 +3/턴(외교), 군사 유닛 생산 비용 -25%', '8턴 이후 도시 3개 이상', 4)
on conflict (id) do nothing;

create table if not exists public.hc_event_defs (
  id             text primary key,
  title          text not null,
  era            text not null,
  icon           text not null,
  body           text not null,
  choice_a_label text not null,
  choice_a_desc  text not null,
  choice_a       jsonb not null,
  choice_b_label text not null,
  choice_b_desc  text not null,
  choice_b       jsonb not null,
  sort           int not null
);

insert into public.hc_event_defs values
  ('french_revolution', '프랑스 혁명', '1789년', '🇫🇷',
   '굶주림과 불평등에 지친 제3신분이 바스티유 감옥을 습격했습니다. 인권선언과 함께 "자유·평등·박애"의 외침이 거리로 퍼지고 있습니다. 어떻게 대응하시겠습니까?',
   '구체제 유지', '왕정과 신분제를 지킨다 · 안정도 +10, 골드 +15, 혁명 이념 -10',
   '{"stability": 10, "gold": 15, "ideology": -10}',
   '공화정 선포', '왕정을 폐지한다 · 혁명 이념 +25, 안정도 -15, 로베스피에르 등장, 나폴레옹 합류(아직 없으면)',
   '{"ideology": 25, "stability": -15, "spawn": {"kind": "hero_robespierre", "count": 1}, "leader": "napoleon"}',
   1),
  ('luddite', '러다이트 운동', '1811년', '⚙️',
   '"기계가 우리 일자리를 빼앗는다!" 방직 노동자들이 밤마다 공장에 몰려가 새로 들인 기계를 부수고 있습니다.',
   '기계 파괴 진압', '군대를 보내 진압한다 · 안정도 -15, 공장 가동 유지(망치 +10)',
   '{"stability": -15, "hammer": 10}',
   '노동 조건 개선', '임금과 노동 시간을 개선한다 · 골드 -20, 혁명 이념 +10, 안정도 +15',
   '{"gold": -20, "ideology": 10, "stability": 15}',
   2),
  ('independence', '독립 전쟁', '1775년', '🗽',
   '멀리 떨어진 식민지 주민들이 "대표 없이 과세 없다!"를 외치며 본국에 맞서 독립을 요구하고 있습니다.',
   '전면전 선언', '무력으로 맞선다 · 시민군 2부대 징집, 망치 +10, 안정도 -10',
   '{"spawn": {"kind": "militia", "count": 2}, "hammer": 10, "stability": -10}',
   '외교적 협상', '협상으로 평화를 지킨다 · 골드 -25, 안정도 +10, 혁명 이념 +5',
   '{"gold": -25, "stability": 10, "ideology": 5}',
   3),
  ('great_exhibition', '만국박람회', '1851년', '🏛️',
   '런던 수정궁에서 세계 최초의 만국박람회가 열립니다. 증기기관, 방직기, 전신기… 우리 문명의 산업 성과를 어떻게 보여줄까요?',
   '산업 성과 전시', '관람객과 투자를 모은다 · 골드 +30, 안정도 +5',
   '{"gold": 30, "stability": 5}',
   '발명가 초청', '세계의 발명가를 불러 모은다 · 연구 진행 +25, 망치 -20',
   '{"research": 25, "hammer": -20}',
   4)
on conflict (id) do nothing;

create table if not exists public.hc_player_leaders (
  room_id     uuid not null references public.hc_rooms(id) on delete cascade,
  leader_id   text not null references public.hc_leader_defs(id),
  player_id   uuid not null references public.hc_profiles(id),
  joined_turn int  not null,
  primary key (room_id, leader_id)          -- 인물은 방마다 한 문명에만
);

create table if not exists public.hc_player_events (
  id          bigserial primary key,
  room_id     uuid not null references public.hc_rooms(id) on delete cascade,
  player_id   uuid not null references public.hc_profiles(id),
  event_id    text not null references public.hc_event_defs(id),
  turn        int  not null,
  status      text not null default 'pending' check (status in ('pending', 'resolved')),
  choice      text check (choice in ('a', 'b')),
  resolved_at timestamptz,
  unique (room_id, player_id, event_id)
);
create index if not exists hc_player_events_pending_idx on public.hc_player_events (room_id, status);

alter table public.hc_leader_defs    enable row level security;
alter table public.hc_event_defs     enable row level security;
alter table public.hc_player_leaders enable row level security;
alter table public.hc_player_events  enable row level security;
create policy "rules readable" on public.hc_leader_defs    for select to authenticated using (true);
create policy "rules readable" on public.hc_event_defs     for select to authenticated using (true);
create policy "members read"   on public.hc_player_leaders for select to authenticated using (public.hc_is_room_member(room_id));
create policy "own events"     on public.hc_player_events  for select to authenticated using (player_id = auth.uid());

-- ---------------------------------------------------------------------
-- 인물 효과 헬퍼
-- ---------------------------------------------------------------------
create or replace function public.hc__has_leader(p_room uuid, p_player uuid, p_leader text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hc_player_leaders where room_id = p_room and player_id = p_player and leader_id = p_leader);
$$;

create or replace function public.hc__attack_bonus(p_room uuid, p_player uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when hc__has_leader(p_room, p_player, 'napoleon') then 2 else 0 end;
$$;

create or replace function public.hc__unit_cost(p_room uuid, p_player uuid, p_kind text, p_base int)
returns int language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'militia' and hc__has_leader(p_room, p_player, 'lincoln') then p_base / 2
    when hc__has_leader(p_room, p_player, 'bismarck')
         and exists (select 1 from hc_unit_types where kind = p_kind and attack > 0) then (p_base * 3) / 4
    else p_base
  end;
$$;

create or replace function public.hc__grant_leader(p_room uuid, p_player uuid, p_leader text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into hc_player_leaders (room_id, leader_id, player_id, joined_turn)
  values (p_room, p_leader, p_player, (select turn_number from hc_rooms where id = p_room))
  on conflict do nothing;
  return found;
end $$;

-- 선택지 효과 적용: gold/hammer/ideology/stability/research 증감, spawn(유닛 징집), leader(인물 합류)
create or replace function public.hc__apply_effects(p_room uuid, p_player uuid, p_eff jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap record; n int; i int; v_kind text; sx int; sy int; v_turn int; out jsonb := '[]';
begin
  update hc_room_players set
    gold              = greatest(0, gold + coalesce((p_eff->>'gold')::int, 0)),
    hammer            = greatest(0, hammer + coalesce((p_eff->>'hammer')::int, 0)),
    ideology          = greatest(0, ideology + coalesce((p_eff->>'ideology')::int, 0)),
    stability         = least(100, greatest(0, stability + coalesce((p_eff->>'stability')::int, 0))),
    research_progress = research_progress + coalesce((p_eff->>'research')::int, 0)
   where room_id = p_room and user_id = p_player;

  if p_eff ? 'spawn' then
    v_kind := p_eff->'spawn'->>'kind';
    n := coalesce((p_eff->'spawn'->>'count')::int, 1);
    select turn_number into v_turn from hc_rooms where id = p_room;
    select x, y into cap from hc_tiles
     where room_id = p_room and owner_id = p_player and is_city order by is_capital desc limit 1;
    if found then
      for i in 1..n loop
        select g.x, g.y into sx, sy from hc_tiles g
         where g.room_id = p_room and greatest(abs(g.x - cap.x), abs(g.y - cap.y)) <= 2
           and g.terrain not in ('water', 'mountain')
           and not exists (select 1 from hc_units o where o.room_id = p_room and o.x = g.x and o.y = g.y)
         order by greatest(abs(g.x - cap.x), abs(g.y - cap.y)), random() limit 1;
        exit when not found;
        perform hc__spawn(p_room, p_player, v_kind, sx, sy, v_turn);
        out := out || jsonb_build_object('type', 'unit_produced', 'player', p_player, 'kind', v_kind, 'x', sx, 'y', sy);
      end loop;
    end if;
  end if;

  if p_eff ? 'leader' and hc__grant_leader(p_room, p_player, p_eff->>'leader') then
    out := out || jsonb_build_object('type', 'leader_joined', 'player', p_player, 'leader', p_eff->>'leader');
  end if;
  return out;
end $$;

create or replace function public.hc__resolve_event(p_id bigint, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ev hc_player_events; d hc_event_defs; res jsonb;
begin
  select * into ev from hc_player_events where id = p_id for update;
  if not found or ev.status <> 'pending' then return '[]'; end if;
  select * into d from hc_event_defs where id = ev.event_id;
  res := hc__apply_effects(ev.room_id, ev.player_id, case when p_choice = 'b' then d.choice_b else d.choice_a end);
  update hc_player_events set status = 'resolved', choice = p_choice, resolved_at = now() where id = p_id;
  return jsonb_build_array(jsonb_build_object('type', 'event_resolved', 'player', ev.player_id,
                                              'event', ev.event_id, 'choice', p_choice)) || res;
end $$;

-- 인물 합류: 아직 아무도 없는 인물 → 조건을 만족한 문명 중 (연고 진영 우선, 점수 순)
create or replace function public.hc__check_leaders(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; l record; v_player uuid; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  for l in select id from hc_leader_defs
            where id not in (select leader_id from hc_player_leaders where room_id = p_room) order by sort loop
    select pl.user_id into v_player from hc_room_players pl
     where pl.room_id = p_room and not pl.is_eliminated
       and case l.id
             when 'napoleon' then 'enlightenment' = any (pl.researched) or (pl.faction = 'france' and r.turn_number >= 5)
             when 'watt'     then 'steam_engine' = any (pl.researched)
             when 'lincoln'  then pl.ideology >= 60
             when 'bismarck' then r.turn_number >= 8 and
                                  (select count(*) from hc_tiles tt where tt.room_id = p_room and tt.owner_id = pl.user_id and tt.is_city) >= 3
             else false
           end
     order by case when (l.id = 'napoleon' and pl.faction = 'france') or (l.id = 'watt' and pl.faction = 'britain')
                     or (l.id = 'bismarck' and pl.faction = 'empire') then 0 else 1 end,
              pl.score desc
     limit 1;
    if found and hc__grant_leader(p_room, v_player, l.id) then
      out := out || jsonb_build_object('type', 'leader_joined', 'player', v_player, 'leader', l.id);
    end if;
  end loop;
  return out;
end $$;

-- 사건 발생: 플레이어당 사건마다 1회, 한 턴에 새 사건은 1개까지
create or replace function public.hc__trigger_events(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl record; e record; v_cities int; ok boolean; v_id bigint; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  for pl in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    select count(*) into v_cities from hc_tiles where room_id = p_room and owner_id = pl.user_id and is_city;
    for e in select id from hc_event_defs order by sort loop
      continue when exists (select 1 from hc_player_events
                             where room_id = p_room and player_id = pl.user_id
                               and (event_id = e.id or turn = r.turn_number));
      ok := case e.id
              when 'french_revolution' then pl.ideology >= 30 or pl.stability <= 40
              when 'luddite'           then 'steam_engine' = any (pl.researched)
                                            or exists (select 1 from hc_tiles tt where tt.room_id = p_room
                                                        and tt.owner_id = pl.user_id and tt.improvement = 'factory')
              when 'independence'      then r.turn_number >= 10 and v_cities >= 2
              when 'great_exhibition'  then pl.hammer >= 60
              else false
            end;
      continue when not ok;
      insert into hc_player_events (room_id, player_id, event_id, turn)
      values (p_room, pl.user_id, e.id, r.turn_number) returning id into v_id;
      out := out || jsonb_build_object('type', 'historic_event', 'player', pl.user_id, 'event', e.id);
      if pl.is_ai then
        out := out || hc__resolve_event(v_id, case when random() < 0.5 then 'a' else 'b' end);
      end if;
    end loop;
  end loop;
  return out;
end $$;

-- 매 턴 인물 패시브 + 안정도 효과 (정산 직후, 다음 턴 시작 상태에 반영)
create or replace function public.hc__leader_passives(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 나폴레옹: 군사 유닛 이동력 +1 (정산에서 이동력이 초기화된 뒤에 더한다)
  update hc_units un set moves_left = un.moves_left + 1
    from hc_unit_types ut
   where un.room_id = p_room and ut.kind = un.kind and ut.attack > 0 and not ut.naval
     and hc__has_leader(p_room, un.owner_id, 'napoleon');
  -- 제임스 와트: 도시마다 망치 +3, 과학 기술 연구 +4
  update hc_room_players rp set
    hammer = rp.hammer + 3 * (select count(*) from hc_tiles tt where tt.room_id = p_room and tt.owner_id = rp.user_id and tt.is_city),
    research_progress = rp.research_progress
      + case when rp.research_target in ('steam_engine', 'electrification', 'new_weapons') then 4 else 0 end
   where rp.room_id = p_room and hc__has_leader(p_room, rp.user_id, 'watt');
  -- 링컨: 안정도 +5, 이념 +2
  update hc_room_players rp set stability = least(100, rp.stability + 5), ideology = rp.ideology + 2
   where rp.room_id = p_room and hc__has_leader(p_room, rp.user_id, 'lincoln');
  -- 비스마르크: 외교 골드 +3
  update hc_room_players rp set gold = rp.gold + 3
   where rp.room_id = p_room and hc__has_leader(p_room, rp.user_id, 'bismarck');
  -- 안정도: 50 미만이면 서서히 회복, 30 미만이면 골드 손실(폭동), 70 이상이면 이념 +1
  update hc_room_players set
    stability = least(100, stability + case when stability < 50 then 1 else 0 end),
    gold      = greatest(0, gold - case when stability < 30 then 3 else 0 end),
    ideology  = ideology + case when stability >= 70 then 1 else 0 end
   where room_id = p_room and not is_eliminated;
end $$;

-- ---------------------------------------------------------------------
-- 기존 정산 핵심에 인물 효과 연결 (전투 보너스, 생산 비용, 링컨 시민군)
-- ---------------------------------------------------------------------
do $mig$
declare d text;
  pairs text[][] := array[
    ['dmg_def := greatest(10, 30 + 4 * (s.attack - ds.defense - def_bonus))',
     'dmg_def := greatest(10, 30 + 4 * (s.attack + hc__attack_bonus(p_room, u.owner_id) - ds.defense - def_bonus))'],
    ['or (s.faction is not null and s.faction <> p.faction)',
     'or (s.faction is not null and s.faction <> p.faction and not (s.kind = ''militia'' and hc__has_leader(p_room, a.player_id, ''lincoln'')))'],
    ['or p.hammer < s.cost',
     'or p.hammer < hc__unit_cost(p_room, a.player_id, s.kind, s.cost)'],
    ['update hc_room_players set hammer = hammer - s.cost where',
     'update hc_room_players set hammer = hammer - hc__unit_cost(p_room, a.player_id, s.kind, s.cost) where']
  ];
  i int;
begin
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  for i in 1..array_length(pairs, 1) loop
    if position(pairs[i][2] in d) > 0 then continue; end if;          -- 이미 적용됨
    if position(pairs[i][1] in d) = 0 then raise exception 'core pattern not found: %', pairs[i][1]; end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  execute d;
end $mig$;

-- ---------------------------------------------------------------------
-- 정산 래퍼: 미선택 사건 자동 결정 → AI 명령 → 핵심 정산 → 인물/사건 → 로그
-- ---------------------------------------------------------------------
create or replace function public.hc__resolve_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_turn int; a record; v_winner uuid; v_status hc_room_status; ev jsonb := '[]';
begin
  select turn_number into v_turn from hc_rooms where id = p_room;

  -- 이번 턴까지 고르지 않은 사건은 첫 번째 선택지로 결정
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

  select status into v_status from hc_rooms where id = p_room;
  if v_status = 'playing' then
    perform hc__leader_passives(p_room);
    ev := ev || hc__check_leaders(p_room) || hc__trigger_events(p_room);
  end if;
  if jsonb_array_length(ev) > 0 then
    update hc_turn_logs set events = events || ev
     where id = (select max(id) from hc_turn_logs where room_id = p_room);
  end if;

  -- AI 대전에서 사람이 모두 멸망하면 종료 (최고 점수 AI의 정복 승리)
  if exists (select 1 from hc_rooms where id = p_room and is_solo and status = 'playing')
     and not exists (select 1 from hc_room_players where room_id = p_room and not is_ai and not is_eliminated) then
    select user_id into v_winner from hc_room_players
     where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 클라이언트 RPC: 사건 선택 (즉시 반영)
-- ---------------------------------------------------------------------
create or replace function public.hc_choose_event(p_room uuid, p_event bigint, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; res jsonb;
begin
  if p_choice not in ('a', 'b') then raise exception 'INVALID_CHOICE'; end if;
  -- 정산과 겹치지 않도록 방 행을 공유 잠금
  select * into r from hc_rooms where id = p_room for share;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  if not exists (select 1 from hc_player_events
                  where id = p_event and room_id = p_room and player_id = auth.uid() and status = 'pending') then
    raise exception 'EVENT_NOT_PENDING';
  end if;
  res := hc__resolve_event(p_event, p_choice);
  update hc_turn_logs set events = events || res
   where id = (select max(id) from hc_turn_logs where room_id = p_room);
  return res;
end $$;

-- 스냅샷에 인물·내 사건 추가
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
                    where e.room_id = p_room and e.player_id = auth.uid() and e.status = 'pending')
  );
end $$;

revoke execute on function public.hc__has_leader(uuid, uuid, text)            from public, anon, authenticated;
revoke execute on function public.hc__attack_bonus(uuid, uuid)                from public, anon, authenticated;
revoke execute on function public.hc__unit_cost(uuid, uuid, text, int)        from public, anon, authenticated;
revoke execute on function public.hc__grant_leader(uuid, uuid, text)          from public, anon, authenticated;
revoke execute on function public.hc__apply_effects(uuid, uuid, jsonb)        from public, anon, authenticated;
revoke execute on function public.hc__resolve_event(bigint, text)             from public, anon, authenticated;
revoke execute on function public.hc__check_leaders(uuid)                     from public, anon, authenticated;
revoke execute on function public.hc__trigger_events(uuid)                    from public, anon, authenticated;
revoke execute on function public.hc__leader_passives(uuid)                   from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)                      from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn_core(uuid)                 from public, anon, authenticated;
revoke execute on function public.hc_choose_event(uuid, bigint, text)         from public, anon;
revoke execute on function public.hc_get_game_state(uuid)                     from public, anon;
