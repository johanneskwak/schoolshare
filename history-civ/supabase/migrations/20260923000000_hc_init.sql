-- =====================================================================
-- 역사 문명전 (History Civ) — 초기 스키마
--   * 모든 게임 상태 변경은 SECURITY DEFINER RPC를 통해서만 일어난다.
--   * 클라이언트는 테이블을 "읽기"만 한다 (RLS: 방 참가자만 SELECT).
--   * 턴 정산(hc__resolve_turn)은 DB 트랜잭션 안에서 hc_rooms 행 잠금 후 1회만 실행된다.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. ENUM
-- ---------------------------------------------------------------------
create type hc_room_status  as enum ('waiting', 'playing', 'finished');
create type hc_faction_type as enum ('france', 'britain', 'empire');
create type hc_terrain_type as enum ('plains', 'grassland', 'hills', 'forest', 'mountain', 'water');
create type hc_victory_type as enum ('conquest', 'science', 'culture', 'score');

-- ---------------------------------------------------------------------
-- 1. 정적 규칙 데이터 (유닛 / 테크)
-- ---------------------------------------------------------------------
create table public.hc_techs (
  id       text primary key,
  name_ko  text not null,
  cost     int  not null check (cost > 0),
  prereq   text references public.hc_techs(id),
  branch   text not null check (branch in ('science', 'culture'))
);

insert into public.hc_techs (id, name_ko, cost, prereq, branch) values
  ('enlightenment',      '계몽사상',     20, null,              'culture'),
  ('rights_declaration', '인권선언',     40, 'enlightenment',   'culture'),
  ('steam_engine',       '증기기관',     30, null,              'science'),
  ('electrification',    '전기화',       60, 'steam_engine',    'science'),
  ('new_weapons',        '신무기',      100, 'electrification', 'science');  -- 과학 승리

create table public.hc_unit_types (
  kind          text primary key,
  name_ko       text not null,
  attack        int  not null,
  defense       int  not null,
  moves         int  not null,
  initiative    int  not null,       -- 동시 이동 충돌 시 우선순위 (높을수록 먼저)
  range         int  not null default 1,
  cost          int  not null,       -- 망치
  naval         boolean not null default false,
  is_hero       boolean not null default false,
  faction       hc_faction_type,        -- null = 모든 진영
  requires_tech text references public.hc_techs(id)
);

insert into public.hc_unit_types
  (kind, name_ko, attack, defense, moves, initiative, range, cost, naval, is_hero, faction, requires_tech) values
  ('settler',          '개척자',       0, 1, 2, 1, 1, 30, false, false, null,      null),
  ('militia',          '시민군',       3, 3, 2, 4, 1, 10, false, false, 'france',  null),
  ('line_infantry',    '전열보병',     4, 4, 1, 3, 1, 20, false, false, null,      null),
  ('cavalry',          '기병',         5, 2, 3, 6, 1, 28, false, false, null,      null),
  ('artillery',        '포병',         6, 1, 1, 2, 2, 35, false, false, null,      null),
  ('machine_gunner',   '기관총병',     7, 5, 1, 3, 2, 45, false, false, 'empire',  'electrification'),
  ('ironclad',         '철갑함',       6, 5, 4, 5, 2, 50, true,  false, null,      'steam_engine'),
  ('hero_napoleon',    '나폴레옹',     8, 6, 3, 8, 1, 60, false, true,  'france',  null),
  ('hero_robespierre', '로베스피에르', 2, 4, 2, 5, 1, 40, false, true,  'france',  'enlightenment'),
  ('hero_watt',        '제임스 와트',  0, 3, 2, 3, 1, 40, false, true,  'britain', null);

-- ---------------------------------------------------------------------
-- 2. 게임 테이블
-- ---------------------------------------------------------------------
create table public.hc_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now()
);

create table public.hc_rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  host_id       uuid not null references public.hc_profiles(id),
  status        hc_room_status not null default 'waiting',
  max_players   int not null default 4 check (max_players between 2 and 6),
  map_width     int not null default 16 check (map_width between 10 and 40),
  map_height    int not null default 12 check (map_height between 8 and 30),
  turn_number   int not null default 0,
  turn_seconds  int not null default 60 check (turn_seconds between 20 and 300),
  turn_deadline timestamptz,
  max_turns     int not null default 60,
  winner_id     uuid references public.hc_profiles(id),
  victory       hc_victory_type,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.hc_room_players (
  room_id           uuid not null references public.hc_rooms(id) on delete cascade,
  user_id           uuid not null references public.hc_profiles(id) on delete cascade,
  nickname          text not null,
  seat              smallint not null check (seat between 0 and 5),
  faction           hc_faction_type not null,
  is_ready          boolean not null default false,
  has_ended_turn    boolean not null default false,
  is_eliminated     boolean not null default false,
  gold              int not null default 30,
  food              int not null default 0,
  hammer            int not null default 20,
  innovation        int not null default 0,   -- 턴당 혁신 점수 (표시용)
  ideology          int not null default 0,   -- 누적 혁명 이념 점수 (문화 승리)
  research_target   text references public.hc_techs(id),
  research_progress int not null default 0,
  researched        text[] not null default '{}',
  score             int not null default 0,
  joined_at         timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table public.hc_tiles (
  room_id     uuid not null references public.hc_rooms(id) on delete cascade,
  x           int  not null,
  y           int  not null,
  terrain     hc_terrain_type not null,
  owner_id    uuid references public.hc_profiles(id),
  is_city     boolean not null default false,
  is_capital  boolean not null default false,
  city_name   text,
  city_pop    int not null default 0,
  improvement text check (improvement in ('farm', 'railway', 'factory', 'port')),
  primary key (room_id, x, y)
);
create index hc_game_tiles_owner_idx on public.hc_tiles (room_id, owner_id);

create table public.hc_units (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.hc_rooms(id) on delete cascade,
  owner_id     uuid not null references public.hc_profiles(id),
  kind         text not null references public.hc_unit_types(kind),
  x            int  not null,
  y            int  not null,
  hp           int  not null default 100 check (hp between 0 and 100),
  moves_left   int  not null,
  created_turn int  not null default 0
);
create index hc_units_room_idx on public.hc_units (room_id);
create index hc_units_pos_idx  on public.hc_units (room_id, x, y);

-- 이번 턴에 제출된 명령 (동시 턴: 다른 플레이어는 볼 수 없음)
create table public.hc_turn_actions (
  room_id      uuid not null references public.hc_rooms(id) on delete cascade,
  turn         int  not null,
  player_id    uuid not null references public.hc_profiles(id),
  actions      jsonb not null default '[]',
  submitted_at timestamptz not null default now(),
  primary key (room_id, turn, player_id)
);

-- 정산 결과 이벤트 (전투, 도시 건설, 함락 등) — 클라이언트 애니메이션/로그용
create table public.hc_turn_logs (
  id         bigserial primary key,
  room_id    uuid not null references public.hc_rooms(id) on delete cascade,
  turn       int  not null,
  events     jsonb not null,
  created_at timestamptz not null default now()
);
create index hc_turn_logs_room_idx on public.hc_turn_logs (room_id, turn);

create table public.hc_match_results (
  room_id   uuid not null references public.hc_rooms(id) on delete cascade,
  user_id   uuid not null references public.hc_profiles(id) on delete cascade,
  faction   hc_faction_type not null,
  score     int not null,
  is_winner boolean not null,
  victory   hc_victory_type,
  ended_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.hc_leaderboard (
  user_id      uuid primary key references public.hc_profiles(id) on delete cascade,
  nickname     text not null,
  games_played int not null default 0,
  wins         int not null default 0,
  total_score  int not null default 0,
  best_score   int not null default 0,
  updated_at   timestamptz not null default now()
);

create view public.hc_leaderboard_ranked with (security_invoker = true) as
  select l.*,
         rank() over (order by l.wins desc, l.total_score desc) as rank
  from public.hc_leaderboard l;

-- ---------------------------------------------------------------------
-- 3. RLS — 클라이언트는 읽기 전용. 쓰기 정책은 의도적으로 없음.
-- ---------------------------------------------------------------------
create or replace function public.hc_is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hc_room_players where room_id = p_room and user_id = auth.uid());
$$;

alter table public.hc_techs         enable row level security;
alter table public.hc_unit_types    enable row level security;
alter table public.hc_profiles      enable row level security;
alter table public.hc_rooms         enable row level security;
alter table public.hc_room_players  enable row level security;
alter table public.hc_tiles    enable row level security;
alter table public.hc_units         enable row level security;
alter table public.hc_turn_actions  enable row level security;
alter table public.hc_turn_logs     enable row level security;
alter table public.hc_match_results enable row level security;
alter table public.hc_leaderboard   enable row level security;

create policy "rules readable"      on public.hc_techs         for select to authenticated using (true);
create policy "rules readable"      on public.hc_unit_types    for select to authenticated using (true);
create policy "hc_profiles readable"   on public.hc_profiles      for select to authenticated using (true);
create policy "lobby or member"     on public.hc_rooms         for select to authenticated
  using (status = 'waiting' or public.hc_is_room_member(id));
create policy "members read"        on public.hc_room_players  for select to authenticated using (public.hc_is_room_member(room_id));
create policy "members read"        on public.hc_tiles    for select to authenticated using (public.hc_is_room_member(room_id));
create policy "members read"        on public.hc_units         for select to authenticated using (public.hc_is_room_member(room_id));
create policy "own actions only"    on public.hc_turn_actions  for select to authenticated using (player_id = auth.uid());
create policy "members read"        on public.hc_turn_logs     for select to authenticated using (public.hc_is_room_member(room_id));
create policy "results readable"    on public.hc_match_results for select to authenticated using (true);
create policy "hc_leaderboard public"  on public.hc_leaderboard   for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- 4. 내부 헬퍼 (클라이언트 실행 불가)
-- ---------------------------------------------------------------------
create or replace function public.hc__valid_action(a jsonb)
returns boolean language sql immutable as $$
  select coalesce(
    case a->>'type'
      when 'move'       then a->>'unit_id' ~* '^[0-9a-f-]{36}$'
                             and a->>'x' ~ '^\d{1,3}$' and a->>'y' ~ '^\d{1,3}$'
      when 'found_city' then a->>'unit_id' ~* '^[0-9a-f-]{36}$'
                             and coalesce(char_length(a->>'name'), 0) <= 20
      when 'produce'    then a->>'x' ~ '^\d{1,3}$' and a->>'y' ~ '^\d{1,3}$'
                             and a->>'unit_kind' ~ '^[a-z_]{1,30}$'
      when 'build'      then a->>'x' ~ '^\d{1,3}$' and a->>'y' ~ '^\d{1,3}$'
                             and a->>'improvement' in ('farm', 'railway', 'factory', 'port')
      when 'research'   then a->>'tech' ~ '^[a-z_]{1,30}$'
      when 'spread'     then true
      else false
    end, false);
$$;

create or replace function public.hc__store_actions(p_room uuid, p_turn int, p_actions jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) > 60 then
    raise exception 'INVALID_ACTIONS';
  end if;
  if exists (select 1 from jsonb_array_elements(p_actions) e where not hc__valid_action(e)) then
    raise exception 'INVALID_ACTIONS';
  end if;
  if exists (select 1 from hc_room_players where room_id = p_room and user_id = auth.uid()
             and (has_ended_turn or is_eliminated)) then
    raise exception 'TURN_ALREADY_ENDED';
  end if;
  insert into hc_turn_actions (room_id, turn, player_id, actions)
  values (p_room, p_turn, auth.uid(), p_actions)
  on conflict (room_id, turn, player_id)
  do update set actions = excluded.actions, submitted_at = now();
end $$;

create or replace function public.hc__spawn(p_room uuid, p_owner uuid, p_kind text, p_x int, p_y int, p_turn int)
returns void language sql security definer set search_path = public as $$
  insert into hc_units (room_id, owner_id, kind, x, y, moves_left, created_turn)
  select p_room, p_owner, p_kind, p_x, p_y, moves, p_turn from hc_unit_types where kind = p_kind;
$$;

create or replace function public.hc__capture_city(p_room uuid, p_x int, p_y int, p_new_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_old uuid; v_cap boolean;
begin
  select owner_id, is_capital into v_old, v_cap from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  update hc_tiles set owner_id = p_new_owner, is_capital = false
   where room_id = p_room and x = p_x and y = p_y;
  update hc_tiles set owner_id = p_new_owner
   where room_id = p_room and owner_id = v_old and not is_city
     and greatest(abs(x - p_x), abs(y - p_y)) <= 1;
  if v_cap then
    -- 수도 함락 → 해당 문명 멸망, 남은 영토 병합
    update hc_room_players set is_eliminated = true, has_ended_turn = true
     where room_id = p_room and user_id = v_old;
    update hc_tiles set owner_id = p_new_owner, is_capital = false
     where room_id = p_room and owner_id = v_old;
    delete from hc_units where room_id = p_room and owner_id = v_old;
  end if;
  return jsonb_build_object('type', case when v_cap then 'capital_captured' else 'city_captured' end,
                            'x', p_x, 'y', p_y, 'from', v_old, 'to', p_new_owner);
end $$;

create or replace function public.hc__finish_game(p_room uuid, p_winner uuid, p_victory hc_victory_type)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_winner is not null then
    update hc_room_players set score = score + 50 where room_id = p_room and user_id = p_winner;
  end if;
  update hc_rooms set status = 'finished', winner_id = p_winner, victory = p_victory,
                   turn_deadline = null, updated_at = now()
   where id = p_room;

  insert into hc_match_results (room_id, user_id, faction, score, is_winner, victory)
  select room_id, user_id, faction, score, user_id is not distinct from p_winner, p_victory
    from hc_room_players where room_id = p_room
  on conflict do nothing;

  insert into hc_leaderboard as l (user_id, nickname, games_played, wins, total_score, best_score)
  select user_id, nickname, 1, (user_id is not distinct from p_winner)::int, score, score
    from hc_room_players where room_id = p_room
  on conflict (user_id) do update set
    nickname     = excluded.nickname,
    games_played = l.games_played + 1,
    wins         = l.wins + excluded.wins,
    total_score  = l.total_score + excluded.total_score,
    best_score   = greatest(l.best_score, excluded.best_score),
    updated_at   = now();
end $$;

-- ---------------------------------------------------------------------
-- 5. 턴 정산 (핵심). 호출자가 hc_rooms 행을 FOR UPDATE로 잠근 상태여야 한다.
--    순서: 연구 선택 → 도시 건설 → 이동/전투(선제권 순) → 생산 → 시설/이념
--          → 자원 산출/연구 → 유닛 회복 → 승리 판정 → 다음 턴
-- ---------------------------------------------------------------------
create or replace function public.hc__resolve_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r   hc_rooms%rowtype;
  a   record;
  p   record;
  u   hc_units%rowtype;
  d   hc_units%rowtype;
  s   hc_unit_types%rowtype;
  ds  hc_unit_types%rowtype;
  t   hc_tiles%rowtype;
  ev  jsonb := '[]';
  tx int; ty int; dist int; def_bonus int; dmg_def int; dmg_att int;
  sx int; sy int; v_cost int;
  v_food int; v_ham int; v_gold int; v_cities int; v_pop int; v_sea int; v_rail int;
  v_inn int; v_ideo int; v_units int; v_watt int; v_robes int;
  v_prog int; v_target text; v_res text[]; v_new_food int; v_new_ideo int;
  v_winner uuid;
begin
  select * into r from hc_rooms where id = p_room;

  -- (1) 연구 목표 설정 ------------------------------------------------
  for a in
    select ta.player_id, e.act from hc_turn_actions ta, jsonb_array_elements(ta.actions) e(act)
     where ta.room_id = p_room and ta.turn = r.turn_number and e.act->>'type' = 'research'
  loop
    update hc_room_players rp set
      research_progress = case when rp.research_target is distinct from a.act->>'tech' then 0 else rp.research_progress end,
      research_target   = a.act->>'tech'
     where rp.room_id = p_room and rp.user_id = a.player_id
       and not ((a.act->>'tech') = any (rp.researched))
       and exists (select 1 from hc_techs tc where tc.id = a.act->>'tech'
                    and (tc.prereq is null or tc.prereq = any (rp.researched)));
  end loop;

  -- (2) 도시 건설 -----------------------------------------------------
  for a in
    select ta.player_id, e.act from hc_turn_actions ta, jsonb_array_elements(ta.actions) e(act)
     where ta.room_id = p_room and ta.turn = r.turn_number and e.act->>'type' = 'found_city'
     order by random()
  loop
    select * into u from hc_units
     where id = (a.act->>'unit_id')::uuid and room_id = p_room and owner_id = a.player_id and kind = 'settler';
    continue when not found;
    select * into t from hc_tiles where room_id = p_room and x = u.x and y = u.y;
    continue when t.terrain in ('water', 'mountain')
               or (t.owner_id is not null and t.owner_id <> a.player_id)
               or exists (select 1 from hc_tiles g where g.room_id = p_room and g.is_city
                           and greatest(abs(g.x - u.x), abs(g.y - u.y)) <= 2);
    update hc_tiles set is_city = true, city_pop = 1, owner_id = a.player_id,
                          city_name = coalesce(nullif(a.act->>'name', ''), '새 도시')
     where room_id = p_room and x = u.x and y = u.y;
    update hc_tiles set owner_id = a.player_id
     where room_id = p_room and owner_id is null and greatest(abs(x - u.x), abs(y - u.y)) <= 1;
    delete from hc_units where id = u.id;
    ev := ev || jsonb_build_object('type', 'city_founded', 'player', a.player_id, 'x', u.x, 'y', u.y);
  end loop;

  -- (3) 이동 / 전투: 선제권(initiative) 높은 순 → HP 높은 순 → 무작위 --
  for a in
    select ta.player_id, e.act, un.id as unit_id
      from hc_turn_actions ta
      cross join lateral jsonb_array_elements(ta.actions) e(act)
      join hc_units un on un.id = (e.act->>'unit_id')::uuid and un.room_id = p_room and un.owner_id = ta.player_id
      join hc_unit_types ut on ut.kind = un.kind
     where ta.room_id = p_room and ta.turn = r.turn_number and e.act->>'type' = 'move'
     order by ut.initiative desc, un.hp desc, random()
  loop
    select * into u from hc_units where id = a.unit_id;      -- 앞선 전투로 사망했을 수 있음
    continue when not found;
    select * into s from hc_unit_types where kind = u.kind;
    tx := (a.act->>'x')::int; ty := (a.act->>'y')::int;
    continue when tx >= r.map_width or ty >= r.map_height;
    dist := greatest(abs(tx - u.x), abs(ty - u.y));
    continue when dist = 0;

    select * into d from hc_units where room_id = p_room and x = tx and y = ty limit 1;
    if found then
      -- 적 유닛이 있는 칸 → 공격 (근접: 이동력 내 / 원거리: 사거리 내)
      continue when d.owner_id = u.owner_id or s.attack = 0;
      continue when not (dist <= u.moves_left or (s.range > 1 and dist <= s.range));
      select * into ds from hc_unit_types where kind = d.kind;
      select * into t from hc_tiles where room_id = p_room and x = tx and y = ty;
      def_bonus := case when t.terrain in ('hills', 'forest') then 2 else 0 end
                 + case when t.is_city then 3 else 0 end;
      dmg_def := greatest(10, 30 + 4 * (s.attack - ds.defense - def_bonus)) * (50 + u.hp / 2) / 100;
      dmg_att := case when s.range > 1 then 0
                      else greatest(5, 20 + 4 * (ds.defense + def_bonus - s.attack)) * (50 + d.hp / 2) / 100 end;
      update hc_units set hp = greatest(0, hp - dmg_def) where id = d.id returning * into d;
      update hc_units set hp = greatest(0, hp - dmg_att), moves_left = 0 where id = u.id returning * into u;
      ev := ev || jsonb_build_object('type', 'combat', 'attacker', u.id, 'defender', d.id,
                                     'x', tx, 'y', ty, 'dmg_att', dmg_att, 'dmg_def', dmg_def);
      if d.hp = 0 then
        delete from hc_units where id = d.id;
        ev := ev || jsonb_build_object('type', 'unit_destroyed', 'unit', d.id, 'owner', d.owner_id);
      end if;
      if u.hp = 0 then
        delete from hc_units where id = u.id;
        ev := ev || jsonb_build_object('type', 'unit_destroyed', 'unit', u.id, 'owner', u.owner_id);
        continue;
      end if;
      -- 근접 공격으로 방어자를 격파하면 그 칸으로 진입
      continue when d.hp > 0 or s.range > 1 or dist > 1;
    else
      continue when dist > u.moves_left;
    end if;

    select * into t from hc_tiles where room_id = p_room and x = tx and y = ty;
    continue when t.terrain = 'mountain'
               or (t.terrain = 'water' and not s.naval)
               or (t.terrain <> 'water' and s.naval and not (t.is_city and t.owner_id = u.owner_id));

    update hc_units set x = tx, y = ty, moves_left = greatest(0, moves_left - dist) where id = u.id;
    ev := ev || jsonb_build_object('type', 'move', 'unit', u.id, 'from', jsonb_build_array(u.x, u.y),
                                   'to', jsonb_build_array(tx, ty));
    if t.is_city and t.owner_id is distinct from u.owner_id and s.attack > 0 then
      ev := ev || hc__capture_city(p_room, tx, ty, u.owner_id);
    end if;
  end loop;

  -- (4) 생산 ----------------------------------------------------------
  for a in
    select ta.player_id, e.act from hc_turn_actions ta, jsonb_array_elements(ta.actions) e(act)
     where ta.room_id = p_room and ta.turn = r.turn_number and e.act->>'type' = 'produce'
  loop
    select * into p from hc_room_players where room_id = p_room and user_id = a.player_id;
    continue when p.is_eliminated;
    select * into t from hc_tiles
     where room_id = p_room and x = (a.act->>'x')::int and y = (a.act->>'y')::int
       and is_city and owner_id = a.player_id;
    continue when not found;
    select * into s from hc_unit_types where kind = a.act->>'unit_kind';
    continue when not found
               or (s.faction is not null and s.faction <> p.faction)
               or (s.requires_tech is not null and not (s.requires_tech = any (p.researched)))
               or p.hammer < s.cost
               or (s.is_hero and exists (select 1 from hc_units where room_id = p_room
                                          and owner_id = a.player_id and kind = s.kind));
    -- 도시 칸 또는 인접한 빈 칸에 배치 (함선은 도시 또는 물)
    select g.x, g.y into sx, sy from hc_tiles g
     where g.room_id = p_room and greatest(abs(g.x - t.x), abs(g.y - t.y)) <= 1
       and g.terrain <> 'mountain'
       and ((g.x = t.x and g.y = t.y) or (g.terrain = 'water') = s.naval)
       and not exists (select 1 from hc_units x where x.room_id = p_room and x.x = g.x and x.y = g.y)
     order by (g.x = t.x and g.y = t.y) desc
     limit 1;
    continue when not found;
    perform hc__spawn(p_room, a.player_id, s.kind, sx, sy, r.turn_number);
    update hc_room_players set hammer = hammer - s.cost where room_id = p_room and user_id = a.player_id;
    ev := ev || jsonb_build_object('type', 'unit_produced', 'player', a.player_id, 'kind', s.kind, 'x', sx, 'y', sy);
  end loop;

  -- (5) 시설 건설(골드) / 이념 전파(골드 → 이념) ------------------------
  for a in
    select ta.player_id, e.act from hc_turn_actions ta, jsonb_array_elements(ta.actions) e(act)
     where ta.room_id = p_room and ta.turn = r.turn_number and e.act->>'type' in ('build', 'spread')
  loop
    select * into p from hc_room_players where room_id = p_room and user_id = a.player_id;
    continue when p.is_eliminated;
    if a.act->>'type' = 'spread' then
      continue when p.gold < 10;
      update hc_room_players set gold = gold - 10, ideology = ideology + 3
       where room_id = p_room and user_id = a.player_id;
      continue;
    end if;
    select * into t from hc_tiles
     where room_id = p_room and x = (a.act->>'x')::int and y = (a.act->>'y')::int
       and owner_id = a.player_id and terrain not in ('water', 'mountain') and improvement is null;
    continue when not found;
    v_cost := case a.act->>'improvement' when 'farm' then 10 when 'port' then 15
                                         when 'railway' then 15 when 'factory' then 30 end;
    continue when p.gold < v_cost
      or (a.act->>'improvement' in ('railway', 'factory') and not ('steam_engine' = any (p.researched)))
      or (a.act->>'improvement' = 'factory' and not t.is_city)
      or (a.act->>'improvement' = 'port' and not exists (
            select 1 from hc_tiles w where w.room_id = p_room and w.terrain = 'water'
               and greatest(abs(w.x - t.x), abs(w.y - t.y)) = 1));
    update hc_tiles set improvement = a.act->>'improvement' where room_id = p_room and x = t.x and y = t.y;
    update hc_room_players set gold = gold - v_cost where room_id = p_room and user_id = a.player_id;
  end loop;

  -- (6) 자원 산출 / 도시 성장 / 연구 / 승점 ---------------------------
  for p in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    select
      coalesce(sum(case terrain when 'grassland' then 2 when 'plains' then 1 when 'forest' then 1 when 'water' then 1 else 0 end
                 + case when improvement = 'farm' then 2 else 0 end
                 + case when is_city then 1 + city_pop else 0 end), 0),
      coalesce(sum(case terrain when 'hills' then 2 when 'plains' then 1 when 'forest' then 1 else 0 end
                 + case improvement when 'factory' then 3 when 'railway' then 1 else 0 end
                 + case when is_city then 1 + city_pop else 0 end), 0),
      coalesce(sum(case when terrain = 'water' then 1 else 0 end
                 + case when improvement = 'port' then 2 else 0 end
                 + case when is_city then 2 + city_pop else 0 end), 0),
      count(*) filter (where is_city),
      coalesce(sum(city_pop) filter (where is_city), 0),
      count(*) filter (where terrain = 'water' or improvement = 'port'),
      count(*) filter (where improvement = 'railway')
      into v_food, v_ham, v_gold, v_cities, v_pop, v_sea, v_rail
      from hc_tiles where room_id = p_room and owner_id = p.user_id;

    select count(*) filter (where not ut.is_hero and ut.kind <> 'settler'),
           count(*) filter (where un.kind = 'hero_watt'),
           count(*) filter (where un.kind = 'hero_robespierre')
      into v_units, v_watt, v_robes
      from hc_units un join hc_unit_types ut on ut.kind = un.kind
     where un.room_id = p_room and un.owner_id = p.user_id;

    -- 진영 특성
    if p.faction = 'britain' then v_ham := v_ham + v_rail + v_ham / 4; end if;   -- 증기기관·철도 생산력
    if p.faction = 'empire'  then v_gold := v_gold + v_sea; end if;              -- 식민 무역
    if 'steam_engine' = any (p.researched) then v_ham := v_ham + v_cities; end if;
    v_ham := v_ham + 3 * v_watt;

    v_inn  := 2 + 2 * v_cities + 3 * v_watt
            + case when p.faction = 'britain' then 2 else 0 end
            + case when 'electrification' = any (p.researched) then 3 else 0 end;
    v_ideo := v_cities + 3 * v_robes
            + case when p.faction = 'france' then 2 else 0 end
            + case when 'enlightenment' = any (p.researched) then 2 else 0 end
            + case when 'rights_declaration' = any (p.researched) then 3 else 0 end;

    -- 연구 진행
    v_prog := p.research_progress + v_inn; v_target := p.research_target; v_res := p.researched;
    v_new_ideo := p.ideology + v_ideo;
    if v_target is not null and v_prog >= (select cost from hc_techs where id = v_target) then
      v_prog := v_prog - (select cost from hc_techs where id = v_target);
      v_res := array_append(v_res, v_target);
      ev := ev || jsonb_build_object('type', 'tech_researched', 'player', p.user_id, 'tech', v_target);
      if v_target = 'rights_declaration' then v_new_ideo := v_new_ideo + 15; end if;  -- 인권선언 발포
      v_target := null;
    end if;

    -- 도시 성장: 인구 1당 식량 1 소비, 비축이 기준치를 넘으면 가장 작은 도시 성장
    v_new_food := greatest(0, p.food + v_food - v_pop);
    if v_cities > 0 and v_new_food >= 10 + 5 * v_pop then
      v_new_food := v_new_food - (10 + 5 * v_pop);
      update hc_tiles set city_pop = city_pop + 1
       where (room_id, x, y) = (select room_id, x, y from hc_tiles
                                 where room_id = p_room and owner_id = p.user_id and is_city
                                 order by city_pop, random() limit 1);
    end if;

    update hc_room_players set
      food              = v_new_food,
      hammer            = hammer + v_ham,
      gold              = greatest(0, gold + v_gold - greatest(0, v_units - 2 * v_cities)),
      innovation        = v_inn,
      ideology          = v_new_ideo,
      research_progress = v_prog,
      research_target   = v_target,
      researched        = v_res,
      score             = 10 * v_cities + 3 * v_pop + 8 * cardinality(v_res) + v_new_ideo / 5
     where room_id = p_room and user_id = p.user_id;
  end loop;

  -- (7) 유닛 행동력 회복 + 자국 영토 내 체력 회복 ----------------------
  update hc_units un set
    moves_left = ut.moves,
    hp = least(100, un.hp + case when exists (select 1 from hc_tiles g where g.room_id = p_room
                                               and g.x = un.x and g.y = un.y and g.owner_id = un.owner_id)
                                 then 10 else 0 end)
    from hc_unit_types ut
   where un.room_id = p_room and ut.kind = un.kind;

  insert into hc_turn_logs (room_id, turn, events) values (p_room, r.turn_number, ev);

  -- (8) 승리 판정 -----------------------------------------------------
  if (select count(*) from hc_room_players where room_id = p_room and not is_eliminated) <= 1 then
    select user_id into v_winner from hc_room_players where room_id = p_room and not is_eliminated limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
    return;
  end if;

  select user_id into v_winner from hc_room_players
   where room_id = p_room and not is_eliminated and 'new_weapons' = any (researched)
   order by score desc limit 1;
  if found then perform hc__finish_game(p_room, v_winner, 'science'); return; end if;

  select user_id into v_winner from hc_room_players
   where room_id = p_room and not is_eliminated and ideology >= 100
   order by ideology desc, score desc limit 1;
  if found then perform hc__finish_game(p_room, v_winner, 'culture'); return; end if;

  if r.turn_number >= r.max_turns then
    select user_id into v_winner from hc_room_players
     where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'score');
    return;
  end if;

  -- (9) 다음 턴 -------------------------------------------------------
  update hc_room_players set has_ended_turn = is_eliminated where room_id = p_room;
  update hc_rooms set turn_number   = turn_number + 1,
                   turn_deadline = now() + make_interval(secs => turn_seconds),
                   updated_at    = now()
   where id = p_room;
end $$;

-- ---------------------------------------------------------------------
-- 6. 클라이언트 RPC
-- ---------------------------------------------------------------------
create or replace function public.hc_ensure_profile(p_nickname text)
returns void language sql security definer set search_path = public as $$
  insert into hc_profiles (id, nickname) values (auth.uid(), trim(p_nickname))
  on conflict (id) do update set nickname = excluded.nickname;
$$;

create or replace function public.hc_create_room(
  p_faction hc_faction_type, p_max_players int default 4, p_turn_seconds int default 60)
returns hc_rooms language plpgsql security definer set search_path = public as $$
declare r hc_rooms;
begin
  if not exists (select 1 from hc_profiles where id = auth.uid()) then raise exception 'NO_PROFILE'; end if;
  insert into hc_rooms (host_id, max_players, turn_seconds)
  values (auth.uid(), p_max_players, p_turn_seconds) returning * into r;
  insert into hc_room_players (room_id, user_id, nickname, seat, faction)
  select r.id, auth.uid(), nickname, 0, p_faction from hc_profiles where id = auth.uid();
  return r;
end $$;

create or replace function public.hc_join_room(p_code text, p_faction hc_faction_type)
returns uuid language plpgsql security definer set search_path = public as $$
declare r hc_rooms; v_seat int;
begin
  select * into r from hc_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if exists (select 1 from hc_room_players where room_id = r.id and user_id = auth.uid()) then
    return r.id;                                          -- 재접속
  end if;
  if r.status <> 'waiting' then raise exception 'ROOM_ALREADY_STARTED'; end if;
  select min(sn) into v_seat from generate_series(0, r.max_players - 1) sn
   where sn not in (select seat from hc_room_players where room_id = r.id);
  if v_seat is null then raise exception 'ROOM_FULL'; end if;
  insert into hc_room_players (room_id, user_id, nickname, seat, faction)
  select r.id, auth.uid(), nickname, v_seat, p_faction from hc_profiles where id = auth.uid();
  return r.id;
end $$;

create or replace function public.hc_update_lobby_state(p_room uuid, p_ready boolean, p_faction hc_faction_type default null)
returns void language sql security definer set search_path = public as $$
  update hc_room_players rp set is_ready = p_ready, faction = coalesce(p_faction, rp.faction)
   where rp.room_id = p_room and rp.user_id = auth.uid()
     and exists (select 1 from hc_rooms where id = p_room and status = 'waiting');
$$;

create or replace function public.hc_leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r hc_rooms;
begin
  select * into r from hc_rooms where id = p_room for update;
  if not found then return; end if;
  if r.status = 'waiting' then
    delete from hc_room_players where room_id = p_room and user_id = auth.uid();
    if not exists (select 1 from hc_room_players where room_id = p_room) then
      delete from hc_rooms where id = p_room;
    elsif r.host_id = auth.uid() then
      update hc_rooms set host_id = (select user_id from hc_room_players where room_id = p_room order by seat limit 1)
       where id = p_room;
    end if;
  elsif r.status = 'playing' then
    -- 게임 중 이탈 = 항복
    update hc_room_players set is_eliminated = true, has_ended_turn = true
     where room_id = p_room and user_id = auth.uid();
    delete from hc_units where room_id = p_room and owner_id = auth.uid();
    if not exists (select 1 from hc_room_players where room_id = p_room and not is_eliminated and not has_ended_turn) then
      perform hc__resolve_turn(p_room);
    end if;
  end if;
end $$;

create or replace function public.hc_start_game(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r hc_rooms; p record; i int := 0;
  cx int; cy int; xs int[]; ys int[];
begin
  select * into r from hc_rooms where id = p_room for update;
  if not found or r.host_id <> auth.uid() then raise exception 'NOT_HOST'; end if;
  if r.status <> 'waiting' then raise exception 'ALREADY_STARTED'; end if;
  if (select count(*) from hc_room_players where room_id = p_room) < 2 then raise exception 'NEED_2_PLAYERS'; end if;
  if exists (select 1 from hc_room_players where room_id = p_room and user_id <> r.host_id and not is_ready) then
    raise exception 'NOT_ALL_READY';
  end if;

  -- 지형 무작위 생성
  insert into hc_tiles (room_id, x, y, terrain)
  select p_room, gx, gy,
         (case when rnd < 0.12 then 'water' when rnd < 0.30 then 'forest' when rnd < 0.42 then 'hills'
               when rnd < 0.47 then 'mountain' when rnd < 0.75 then 'plains' else 'grassland' end)::hc_terrain_type
    from (select gx, gy, random() as rnd
            from generate_series(0, r.map_width - 1) gx, generate_series(0, r.map_height - 1) gy) m;

  -- 좌석별 수도 위치 (모서리 → 상하 중앙)
  xs := array[2, r.map_width - 3, r.map_width - 3, 2, r.map_width / 2, r.map_width / 2 - 1];
  ys := array[2, r.map_height - 3, 2, r.map_height - 3, 1, r.map_height - 2];

  for p in select * from hc_room_players where room_id = p_room order by seat loop
    i := i + 1;
    cx := xs[i]; cy := ys[i];
    update hc_tiles set terrain = 'plains', owner_id = p.user_id
     where room_id = p_room and greatest(abs(x - cx), abs(y - cy)) <= 1 and terrain in ('water', 'mountain');
    update hc_tiles set owner_id = p.user_id
     where room_id = p_room and greatest(abs(x - cx), abs(y - cy)) <= 1;
    update hc_tiles set is_city = true, is_capital = true, city_pop = 1,
           city_name = case p.faction when 'france' then '파리' when 'britain' then '런던' else '베를린' end
     where room_id = p_room and x = cx and y = cy;
    update hc_room_players set is_ready = true, has_ended_turn = false where room_id = p_room and user_id = p.user_id;

    perform hc__spawn(p_room, p.user_id, 'settler', cx + 1, cy, 1);
    if p.faction = 'france' then
      perform hc__spawn(p_room, p.user_id, 'militia', cx, cy, 1);
      perform hc__spawn(p_room, p.user_id, 'militia', cx - 1, cy, 1);
      perform hc__spawn(p_room, p.user_id, 'militia', cx, cy + 1, 1);
    else
      perform hc__spawn(p_room, p.user_id, 'line_infantry', cx, cy, 1);
      perform hc__spawn(p_room, p.user_id, 'line_infantry', cx - 1, cy, 1);
    end if;
  end loop;

  update hc_rooms set status = 'playing', turn_number = 1,
                   turn_deadline = now() + make_interval(secs => turn_seconds), updated_at = now()
   where id = p_room;
end $$;

-- 턴 중 명령 저장 (여러 번 호출 가능, 마지막 값이 유효)
create or replace function public.hc_submit_actions(p_room uuid, p_actions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r hc_rooms;
begin
  select * into r from hc_rooms where id = p_room for share;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  if not hc_is_room_member(p_room) then raise exception 'NOT_MEMBER'; end if;
  perform hc__store_actions(p_room, r.turn_number, p_actions);
end $$;

-- 턴 종료. 마지막 플레이어가 누르면 같은 트랜잭션에서 즉시 정산.
create or replace function public.hc_end_turn(p_room uuid, p_actions jsonb default null)
returns int language plpgsql security definer set search_path = public as $$
declare r hc_rooms;
begin
  -- FOR UPDATE: 동시에 누른 두 트랜잭션이 서로의 has_ended_turn을 못 보고
  -- 둘 다 정산을 건너뛰는(또는 둘 다 정산하는) 경쟁 상태를 막는다.
  select * into r from hc_rooms where id = p_room for update;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  if not hc_is_room_member(p_room) then raise exception 'NOT_MEMBER'; end if;
  if p_actions is not null then perform hc__store_actions(p_room, r.turn_number, p_actions); end if;

  update hc_room_players set has_ended_turn = true
   where room_id = p_room and user_id = auth.uid() and not is_eliminated;

  if not exists (select 1 from hc_room_players where room_id = p_room and not is_eliminated and not has_ended_turn) then
    perform hc__resolve_turn(p_room);
  end if;
  return (select turn_number from hc_rooms where id = p_room);
end $$;

-- 턴 종료 취소 (아직 정산 전일 때만)
create or replace function public.hc_cancel_end_turn(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update hc_room_players set has_ended_turn = false
   where room_id = p_room and user_id = auth.uid() and not is_eliminated
     and exists (select 1 from hc_rooms where id = p_room and status = 'playing');
$$;

-- 타이머 만료 시 아무 참가자나 호출. p_turn 비교로 멱등성 보장(중복 호출 안전).
create or replace function public.hc_try_resolve_turn(p_room uuid, p_turn int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r hc_rooms;
begin
  if not hc_is_room_member(p_room) then raise exception 'NOT_MEMBER'; end if;
  select * into r from hc_rooms where id = p_room for update;
  if r.status <> 'playing' or r.turn_number <> p_turn or now() < r.turn_deadline then
    return false;
  end if;
  perform hc__resolve_turn(p_room);
  return true;
end $$;

-- 턴 경계에서 한 번에 받는 전체 스냅샷
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
    'last_log',   (select events from hc_turn_logs where room_id = p_room order by id desc limit 1)
  );
end $$;

-- 서버 전용 백업 스위퍼 (pg_cron용) — 모든 클라이언트가 끊겨도 턴이 진행되도록
create or replace function public.hc__sweep_expired_turns()
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  for v_id in select id from hc_rooms where status = 'playing' and turn_deadline < now() - interval '3 seconds' loop
    perform 1 from hc_rooms where id = v_id and status = 'playing' and turn_deadline < now() for update skip locked;
    if found then perform hc__resolve_turn(v_id); end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. 권한: 내부 함수는 클라이언트 실행 금지 (Supabase는 기본으로 EXECUTE를 부여함)
-- ---------------------------------------------------------------------
revoke execute on function public.hc__valid_action(jsonb)                          from public, anon, authenticated;
revoke execute on function public.hc__store_actions(uuid, int, jsonb)              from public, anon, authenticated;
revoke execute on function public.hc__spawn(uuid, uuid, text, int, int, int)       from public, anon, authenticated;
revoke execute on function public.hc__capture_city(uuid, int, int, uuid)           from public, anon, authenticated;
revoke execute on function public.hc__finish_game(uuid, uuid, hc_victory_type)        from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)                           from public, anon, authenticated;
revoke execute on function public.hc__sweep_expired_turns()                        from public, anon, authenticated;

revoke execute on function public.hc_ensure_profile(text)                          from public, anon;
revoke execute on function public.hc_create_room(hc_faction_type, int, int)           from public, anon;
revoke execute on function public.hc_join_room(text, hc_faction_type)                 from public, anon;
revoke execute on function public.hc_update_lobby_state(uuid, boolean, hc_faction_type) from public, anon;
revoke execute on function public.hc_leave_room(uuid)                              from public, anon;
revoke execute on function public.hc_start_game(uuid)                              from public, anon;
revoke execute on function public.hc_submit_actions(uuid, jsonb)                   from public, anon;
revoke execute on function public.hc_end_turn(uuid, jsonb)                         from public, anon;
revoke execute on function public.hc_cancel_end_turn(uuid)                         from public, anon;
revoke execute on function public.hc_try_resolve_turn(uuid, int)                   from public, anon;
revoke execute on function public.hc_get_game_state(uuid)                          from public, anon;

-- ---------------------------------------------------------------------
-- 8. Realtime: 작은 "신호" 테이블만 구독 → 턴 경계에서 스냅샷 재조회
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.hc_rooms, public.hc_room_players, public.hc_turn_logs;

-- (선택) pg_cron 백업 스위퍼 — 대시보드에서 pg_cron 확장 활성화 후 실행
-- select cron.schedule('sweep-expired-turns', '5 seconds', 'select public.hc__sweep_expired_turns()');
-- 로비에서 나간 플레이어(DELETE)도 room_id 필터 구독으로 받기 위해 전체 행을 WAL에 기록
alter table public.hc_room_players replica identity full;
