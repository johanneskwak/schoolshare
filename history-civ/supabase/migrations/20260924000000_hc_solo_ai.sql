-- =====================================================================
-- 1인 프리플레이 (AI 대전)
--   * AI 플레이어는 DB 안에서 명령을 생성한다 (hc__ai_actions).
--   * 턴 정산 직전에 AI 명령을 넣고 같은 규칙으로 함께 정산한다.
--   * AI는 항상 턴 종료 상태 → 사람이 턴을 끝내면 즉시 다음 턴.
--   * AI 대전 결과는 리더보드에 기록하지 않는다.
-- =====================================================================

-- AI 프로필은 auth.users에 없으므로 FK를 풀고 is_ai로 구분한다.
alter table public.hc_profiles drop constraint if exists hc_profiles_id_fkey;
alter table public.hc_profiles add column if not exists is_ai boolean not null default false;
alter table public.hc_room_players add column if not exists is_ai boolean not null default false;
alter table public.hc_rooms add column if not exists is_solo boolean not null default false;

insert into public.hc_profiles (id, nickname, is_ai) values
  ('00000000-0000-4000-a000-000000000001', 'AI 1', true),
  ('00000000-0000-4000-a000-000000000002', 'AI 2', true),
  ('00000000-0000-4000-a000-000000000003', 'AI 3', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- AI 명령 생성
-- ---------------------------------------------------------------------
create or replace function public.hc__ai_actions(p_room uuid, p_ai uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r hc_rooms; me hc_room_players; acts jsonb := '[]';
  u record; cty record;
  planned text[] := '{}';
  tx int; ty int; sx int; sy int;
  v_tech text; v_kind text; v_cost int; ham int; gold int; spreads int := 0;
  v_cities int; v_army int; v_settlers int;
begin
  select * into r from hc_rooms where id = p_room;
  select * into me from hc_room_players where room_id = p_room and user_id = p_ai;

  -- 1) 연구: 과학 → 문화 순으로 번갈아 선택
  if me.research_target is null then
    select x.id into v_tech
      from unnest(array['steam_engine', 'enlightenment', 'electrification', 'rights_declaration', 'new_weapons'])
           with ordinality as x(id, ord)
      join hc_techs t on t.id = x.id
     where not (x.id = any (me.researched)) and (t.prereq is null or t.prereq = any (me.researched))
     order by x.ord limit 1;
    if found then acts := acts || jsonb_build_array(jsonb_build_object('type', 'research', 'tech', v_tech)); end if;
  end if;

  -- 2) 유닛
  for u in
    select un.id, un.kind, un.x, un.y, un.hp, un.moves_left, ut.attack, ut.range, ut.naval
      from hc_units un join hc_unit_types ut on ut.kind = un.kind
     where un.room_id = p_room and un.owner_id = p_ai
     order by ut.initiative desc
  loop
    if u.kind = 'settler' then
      -- 지금 자리가 도시 터로 적합하면 건설
      if exists (select 1 from hc_tiles g where g.room_id = p_room and g.x = u.x and g.y = u.y
                  and g.terrain not in ('water', 'mountain') and (g.owner_id is null or g.owner_id = p_ai))
         and not exists (select 1 from hc_tiles g where g.room_id = p_room and g.is_city
                          and greatest(abs(g.x - u.x), abs(g.y - u.y)) <= 2) then
        acts := acts || jsonb_build_array(jsonb_build_object('type', 'found_city', 'unit_id', u.id,
                  'name', (array['리옹', '맨체스터', '뮌헨', '마르세유', '리버풀', '함부르크', '보르도', '버밍엄'])[1 + floor(random() * 8)::int]));
        continue;
      end if;
      -- 가장 가까운 도시 터로 이동
      select g.x, g.y into tx, ty from hc_tiles g
       where g.room_id = p_room and g.terrain not in ('water', 'mountain') and (g.owner_id is null or g.owner_id = p_ai)
         and not exists (select 1 from hc_tiles c where c.room_id = p_room and c.is_city
                          and greatest(abs(c.x - g.x), abs(c.y - g.y)) <= 2)
       order by greatest(abs(g.x - u.x), abs(g.y - u.y)), random() limit 1;
      continue when not found;
    else
      continue when u.attack = 0;
      -- 사거리/이동력 안의 적 유닛 공격 (체력 낮은 적 우선)
      select e.x, e.y into tx, ty from hc_units e
       where e.room_id = p_room and e.owner_id <> p_ai
         and greatest(abs(e.x - u.x), abs(e.y - u.y)) <= greatest(u.moves_left, case when u.range > 1 then u.range else 0 end)
       order by e.hp, random() limit 1;
      if found then
        acts := acts || jsonb_build_array(jsonb_build_object('type', 'move', 'unit_id', u.id, 'x', tx, 'y', ty));
        continue;
      end if;
      -- 자기 도시 수비대는 자리 유지
      continue when exists (select 1 from hc_tiles g where g.room_id = p_room and g.x = u.x and g.y = u.y
                             and g.is_city and g.owner_id = p_ai);
      -- 초반에는 방어, 6턴부터 가장 가까운 적 도시로 진격
      continue when r.turn_number < 6;
      select g.x, g.y into tx, ty from hc_tiles g
       where g.room_id = p_room and g.is_city and g.owner_id is distinct from p_ai
       order by greatest(abs(g.x - u.x), abs(g.y - u.y)) limit 1;
      continue when not found;
    end if;

    -- 목표(tx,ty) 쪽으로 이동 가능한 칸 중 가장 가까운 곳
    select g.x, g.y into sx, sy from hc_tiles g
     where g.room_id = p_room
       and greatest(abs(g.x - u.x), abs(g.y - u.y)) between 1 and u.moves_left
       and g.terrain <> 'mountain'
       and ((g.terrain = 'water') = u.naval)
       and not ((g.x || ',' || g.y) = any (planned))
       and not exists (select 1 from hc_units o where o.room_id = p_room and o.x = g.x and o.y = g.y
                        and (o.owner_id = p_ai or u.attack = 0 or not (g.x = tx and g.y = ty)))
     order by greatest(abs(g.x - tx), abs(g.y - ty)), random() limit 1;
    if found and greatest(abs(sx - tx), abs(sy - ty)) < greatest(abs(u.x - tx), abs(u.y - ty)) then
      acts := acts || jsonb_build_array(jsonb_build_object('type', 'move', 'unit_id', u.id, 'x', sx, 'y', sy));
      planned := planned || (sx || ',' || sy);
    end if;
  end loop;

  -- 3) 생산: 도시가 적으면 개척자, 아니면 살 수 있는 가장 강한 유닛
  ham := me.hammer;
  select count(*) into v_cities from hc_tiles where room_id = p_room and owner_id = p_ai and is_city;
  select count(*) filter (where kind = 'settler'), count(*) filter (where kind <> 'settler')
    into v_settlers, v_army from hc_units where room_id = p_room and owner_id = p_ai;
  for cty in select x, y from hc_tiles where room_id = p_room and owner_id = p_ai and is_city order by is_capital desc loop
    v_kind := null;
    if v_settlers = 0 and v_cities < 4 and r.turn_number < 30 then
      if ham >= 30 then v_kind := 'settler'; v_settlers := 1; end if;
    elsif v_army < 3 + 2 * v_cities then
      select ut.kind into v_kind from hc_unit_types ut
       where not ut.naval and ut.attack > 0 and ut.cost <= ham
         and (ut.faction is null or ut.faction = me.faction)
         and (ut.requires_tech is null or ut.requires_tech = any (me.researched))
         and not (ut.is_hero and exists (select 1 from hc_units x where x.room_id = p_room and x.owner_id = p_ai and x.kind = ut.kind))
       order by ut.is_hero desc, ut.attack + ut.defense desc, random() limit 1;
      if v_kind is not null then v_army := v_army + 1; end if;
    end if;
    if v_kind is not null then
      select cost into v_cost from hc_unit_types where kind = v_kind;
      acts := acts || jsonb_build_array(jsonb_build_object('type', 'produce', 'x', cty.x, 'y', cty.y, 'unit_kind', v_kind));
      ham := ham - v_cost;
    end if;
  end loop;

  -- 4) 시설: 증기기관 후 공장, 아니면 농장
  gold := me.gold;
  if 'steam_engine' = any (me.researched) and gold >= 40 then
    select x, y into tx, ty from hc_tiles
     where room_id = p_room and owner_id = p_ai and is_city and improvement is null limit 1;
    if found then
      acts := acts || jsonb_build_array(jsonb_build_object('type', 'build', 'x', tx, 'y', ty, 'improvement', 'factory'));
      gold := gold - 30;
    end if;
  end if;
  if gold >= 25 then
    select x, y into tx, ty from hc_tiles
     where room_id = p_room and owner_id = p_ai and not is_city and improvement is null
       and terrain not in ('water', 'mountain')
     order by random() limit 1;
    if found then
      acts := acts || jsonb_build_array(jsonb_build_object('type', 'build', 'x', tx, 'y', ty, 'improvement', 'farm'));
      gold := gold - 10;
    end if;
  end if;

  -- 5) 이념 전파: 골드가 넉넉할 때 턴당 1회 (프랑스는 조금 더 적극적)
  while gold >= case when me.faction = 'france' then 40 else 60 end and spreads < 1 loop
    acts := acts || jsonb_build_array(jsonb_build_object('type', 'spread'));
    gold := gold - 10; spreads := spreads + 1;
  end loop;

  return acts;
end $$;

-- ---------------------------------------------------------------------
-- 정산 래퍼: AI 명령 생성 → 기존 정산 → AI는 다시 턴 종료 상태
-- ---------------------------------------------------------------------
alter function public.hc__resolve_turn(uuid) rename to hc__resolve_turn_core;

create or replace function public.hc__resolve_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $
declare v_turn int; a record; v_winner uuid;
begin
  select turn_number into v_turn from hc_rooms where id = p_room;
  for a in select user_id from hc_room_players where room_id = p_room and is_ai and not is_eliminated loop
    insert into hc_turn_actions (room_id, turn, player_id, actions)
    values (p_room, v_turn, a.user_id, hc__ai_actions(p_room, a.user_id))
    on conflict (room_id, turn, player_id) do update set actions = excluded.actions, submitted_at = now();
  end loop;
  perform hc__resolve_turn_core(p_room);
  update hc_room_players set has_ended_turn = true where room_id = p_room and is_ai;

  -- AI 대전에서 사람이 모두 멸망하면 더 진행할 사람이 없으므로 종료 (최고 점수 AI의 정복 승리)
  if exists (select 1 from hc_rooms where id = p_room and is_solo and status = 'playing')
     and not exists (select 1 from hc_room_players where room_id = p_room and not is_ai and not is_eliminated) then
    select user_id into v_winner from hc_room_players
     where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
  end if;
end $;

-- ---------------------------------------------------------------------
-- 게임 종료: AI 행은 결과에서 제외, AI 대전은 리더보드 미기록
-- ---------------------------------------------------------------------
create or replace function public.hc__finish_game(p_room uuid, p_winner uuid, p_victory hc_victory_type)
returns void language plpgsql security definer set search_path = public as $$
declare v_solo boolean;
begin
  select is_solo into v_solo from hc_rooms where id = p_room;
  if p_winner is not null then
    update hc_room_players set score = score + 50 where room_id = p_room and user_id = p_winner;
  end if;
  update hc_rooms set status = 'finished', winner_id = p_winner, victory = p_victory,
                   turn_deadline = null, updated_at = now()
   where id = p_room;

  insert into hc_match_results (room_id, user_id, faction, score, is_winner, victory)
  select room_id, user_id, faction, score, user_id is not distinct from p_winner, p_victory
    from hc_room_players where room_id = p_room and not is_ai
  on conflict do nothing;

  if v_solo then return; end if;

  insert into hc_leaderboard as l (user_id, nickname, games_played, wins, total_score, best_score)
  select user_id, nickname, 1, (user_id is not distinct from p_winner)::int, score, score
    from hc_room_players where room_id = p_room and not is_ai
  on conflict (user_id) do update set
    nickname     = excluded.nickname,
    games_played = l.games_played + 1,
    wins         = l.wins + excluded.wins,
    total_score  = l.total_score + excluded.total_score,
    best_score   = greatest(l.best_score, excluded.best_score),
    updated_at   = now();
end $$;

-- ---------------------------------------------------------------------
-- 1인 게임 생성: 방 + AI 1~3명 → 바로 시작
-- ---------------------------------------------------------------------
create or replace function public.hc_create_solo_game(
  p_faction hc_faction_type, p_ai_count int default 2, p_turn_seconds int default 120)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r hc_rooms; i int;
  others hc_faction_type[];
begin
  if not exists (select 1 from hc_profiles where id = auth.uid() and not is_ai) then raise exception 'NO_PROFILE'; end if;
  if p_ai_count not between 1 and 3 then raise exception 'INVALID_AI_COUNT'; end if;

  insert into hc_rooms (host_id, max_players, turn_seconds, is_solo)
  values (auth.uid(), 1 + p_ai_count, p_turn_seconds, true) returning * into r;
  insert into hc_room_players (room_id, user_id, nickname, seat, faction)
  select r.id, auth.uid(), nickname, 0, p_faction from hc_profiles where id = auth.uid();

  -- 다른 두 진영을 먼저 배정하고, AI가 3명이면 셋째는 플레이어와 같은 진영
  others := array(select f from unnest(enum_range(null::hc_faction_type)) f where f <> p_faction) || p_faction;
  for i in 1..p_ai_count loop
    insert into hc_room_players (room_id, user_id, nickname, seat, faction, is_ready, is_ai)
    values (r.id, ('00000000-0000-4000-a000-00000000000' || i)::uuid,
            'AI ' || case others[i] when 'france' then '나폴레옹' when 'britain' then '빅토리아' else '비스마르크' end,
            i, others[i], true, true);
  end loop;

  perform hc_start_game(r.id);
  update hc_room_players set has_ended_turn = true where room_id = r.id and is_ai;
  return r.id;
end $$;

revoke execute on function public.hc__ai_actions(uuid, uuid)                    from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)                        from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn_core(uuid)                   from public, anon, authenticated;
revoke execute on function public.hc__finish_game(uuid, uuid, hc_victory_type)  from public, anon, authenticated;
revoke execute on function public.hc_create_solo_game(hc_faction_type, int, int) from public, anon;

-- ---------------------------------------------------------------------
-- 밸런스: 문화 승리 기준 100 → 200 (시뮬레이션에서 100은 14~19턴 만에 달성됨)
-- ---------------------------------------------------------------------
do $mig$
declare d text;
begin
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  if position('and ideology >= 100' in d) > 0 then
    execute replace(d, 'and ideology >= 100', 'and ideology >= 200');
  end if;
end $mig$;
revoke execute on function public.hc__resolve_turn_core(uuid) from public, anon, authenticated;
