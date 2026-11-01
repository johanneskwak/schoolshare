-- =====================================================================
-- 유닛 단위 즉시 행동 (조조전 방식)
--   * 이동·공격·도시 건설·요새화·휴식·대기·업그레이드를 RPC로 즉시 처리한다.
--   * 생산·연구·자원·AI는 기존처럼 턴 종료 정산에서 처리한다.
--   * 행동 RPC와 정산은 hc_rooms 행 잠금으로 직렬화된다.
--   * 다른 플레이어 화면은 hc_rooms.action_seq 증가(Realtime)로 즉시 갱신된다.
--   * 상성(matchup): 기병→포병 +4, 기병→보병 +2, 기관총병→기병 +3 / 요새화 방어 +2
-- =====================================================================

alter table public.hc_units add column if not exists acted boolean not null default false;
alter table public.hc_units add column if not exists fortified boolean not null default false;
alter table public.hc_rooms add column if not exists action_seq int not null default 0;

create table if not exists public.hc_unit_upgrades (
  from_kind     text primary key references public.hc_unit_types(kind),
  to_kind       text not null references public.hc_unit_types(kind),
  requires_tech text references public.hc_techs(id),
  gold_cost     int not null
);
insert into public.hc_unit_upgrades values
  ('militia',       'line_infantry',  null,              15),
  ('line_infantry', 'machine_gunner', 'electrification', 30)
on conflict (from_kind) do nothing;
alter table public.hc_unit_upgrades enable row level security;
create policy "rules readable" on public.hc_unit_upgrades for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 전투 헬퍼
-- ---------------------------------------------------------------------
create or replace function public.hc__matchup(p_att text, p_def text)
returns int language sql immutable set search_path = public as $$
  select case
    when p_att = 'cavalry' and p_def = 'artillery' then 4
    when p_att = 'cavalry' and p_def in ('line_infantry', 'militia') then 2
    when p_att = 'machine_gunner' and p_def in ('cavalry', 'hero_napoleon') then 3
    else 0
  end;
$$;

-- 정산 핵심 전투식에 상성·요새화 반영
do $mig$
declare d text;
  pairs text[][] := array[
    ['(s.attack + hc__attack_bonus(p_room, u.owner_id) - ds.defense - def_bonus)',
     '(s.attack + hc__attack_bonus(p_room, u.owner_id) + hc__matchup(s.kind, ds.kind) - ds.defense - def_bonus)'],
    ['case when t.is_city then 3 else 0 end;',
     'case when t.is_city then 3 else 0 end + case when d.fortified then 2 else 0 end;']
  ];
  i int;
begin
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  for i in 1..array_length(pairs, 1) loop
    if position(pairs[i][2] in d) > 0 then continue; end if;
    if position(pairs[i][1] in d) = 0 then raise exception 'core pattern not found: %', pairs[i][1]; end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  execute d;
end $mig$;

-- ---------------------------------------------------------------------
-- 공통 가드: 방 잠금 → 진행 중 · 내 유닛 · 턴 미종료 · 아직 행동 안 함
-- ---------------------------------------------------------------------
create or replace function public.hc__act_guard(p_room uuid, p_unit uuid)
returns hc_units language plpgsql security definer set search_path = public as $$
declare r hc_rooms; u hc_units; pl hc_room_players;
begin
  select * into r from hc_rooms where id = p_room for update;
  if not found or r.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  select * into pl from hc_room_players where room_id = p_room and user_id = auth.uid();
  if not found or pl.is_eliminated then raise exception 'NOT_MEMBER'; end if;
  if pl.has_ended_turn then raise exception 'TURN_ALREADY_ENDED'; end if;
  select * into u from hc_units where id = p_unit and room_id = p_room for update;
  if not found or u.owner_id <> auth.uid() then raise exception 'NOT_YOUR_UNIT'; end if;
  if u.acted then raise exception 'UNIT_ALREADY_ACTED'; end if;
  return u;
end $$;

create or replace function public.hc__bump(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update hc_rooms set action_seq = action_seq + 1, updated_at = now() where id = p_room;
$$;

-- 도시 점령 후 즉시 정복 승리 판정 (살아남은 문명이 하나면 종료)
create or replace function public.hc__check_instant_conquest(p_room uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_winner uuid;
begin
  if (select count(*) from hc_room_players where room_id = p_room and not is_eliminated) <= 1 then
    select user_id into v_winner from hc_room_players where room_id = p_room and not is_eliminated limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
    return true;
  end if;
  if exists (select 1 from hc_rooms where id = p_room and is_solo)
     and not exists (select 1 from hc_room_players where room_id = p_room and not is_ai and not is_eliminated) then
    select user_id into v_winner from hc_room_players where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
    return true;
  end if;
  return false;
end $$;

-- ---------------------------------------------------------------------
-- 이동 (즉시)
-- ---------------------------------------------------------------------
create or replace function public.hc_unit_move(p_room uuid, p_unit uuid, p_x int, p_y int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u hc_units; s hc_unit_types; t hc_tiles; r hc_rooms; dist int; ev jsonb := '[]';
begin
  u := hc__act_guard(p_room, p_unit);
  select * into r from hc_rooms where id = p_room;
  select * into s from hc_unit_types where kind = u.kind;
  if p_x < 0 or p_y < 0 or p_x >= r.map_width or p_y >= r.map_height then raise exception 'INVALID_TARGET'; end if;
  dist := greatest(abs(p_x - u.x), abs(p_y - u.y));
  if dist = 0 or dist > u.moves_left then raise exception 'OUT_OF_RANGE'; end if;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  if t.terrain = 'mountain' or (t.terrain = 'water' and not s.naval)
     or (t.terrain <> 'water' and s.naval and not (t.is_city and t.owner_id = u.owner_id)) then
    raise exception 'IMPASSABLE';
  end if;
  if exists (select 1 from hc_units where room_id = p_room and x = p_x and y = p_y) then raise exception 'TILE_OCCUPIED'; end if;

  update hc_units set x = p_x, y = p_y, moves_left = moves_left - dist, fortified = false where id = u.id;
  ev := ev || jsonb_build_object('type', 'move', 'unit', u.id, 'from', jsonb_build_array(u.x, u.y), 'to', jsonb_build_array(p_x, p_y));
  if t.is_city and t.owner_id is distinct from u.owner_id and s.attack > 0 then
    ev := ev || hc__capture_city(p_room, p_x, p_y, u.owner_id);
    perform hc__check_instant_conquest(p_room);
  end if;
  perform hc__bump(p_room);
  return jsonb_build_object('events', ev, 'moves_left', u.moves_left - dist);
end $$;

-- ---------------------------------------------------------------------
-- 공격 (즉시 전투) — 정산 핵심과 같은 전투식
-- ---------------------------------------------------------------------
create or replace function public.hc_unit_attack(p_room uuid, p_unit uuid, p_x int, p_y int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u hc_units; d hc_units; s hc_unit_types; ds hc_unit_types; t hc_tiles;
  dist int; def_bonus int; dmg_def int; dmg_att int; moved_in boolean := false; ev jsonb := '[]';
  ux int; uy int;
begin
  u := hc__act_guard(p_room, p_unit);
  ux := u.x; uy := u.y;
  select * into s from hc_unit_types where kind = u.kind;
  if s.attack = 0 then raise exception 'CANNOT_ATTACK'; end if;
  select * into d from hc_units where room_id = p_room and x = p_x and y = p_y for update;
  if not found or d.owner_id = u.owner_id then raise exception 'NO_ENEMY'; end if;
  dist := greatest(abs(p_x - u.x), abs(p_y - u.y));
  if not (dist <= u.moves_left or (s.range > 1 and dist <= s.range)) then raise exception 'OUT_OF_RANGE'; end if;

  select * into ds from hc_unit_types where kind = d.kind;
  select * into t from hc_tiles where room_id = p_room and x = p_x and y = p_y;
  def_bonus := case when t.terrain in ('hills', 'forest') then 2 else 0 end
             + case when t.is_city then 3 else 0 end
             + case when d.fortified then 2 else 0 end;
  dmg_def := greatest(10, 30 + 4 * (s.attack + hc__attack_bonus(p_room, u.owner_id) + hc__matchup(s.kind, ds.kind)
                                    - ds.defense - def_bonus)) * (50 + u.hp / 2) / 100;
  dmg_att := case when s.range > 1 then 0
                  else greatest(5, 20 + 4 * (ds.defense + def_bonus - s.attack)) * (50 + d.hp / 2) / 100 end;

  update hc_units set hp = greatest(0, hp - dmg_def) where id = d.id returning * into d;
  update hc_units set hp = greatest(0, hp - dmg_att), moves_left = 0, acted = true, fortified = false
   where id = u.id returning * into u;
  ev := ev || jsonb_build_object('type', 'combat', 'attacker', u.id, 'defender', d.id,
                                 'x', p_x, 'y', p_y, 'dmg_att', dmg_att, 'dmg_def', dmg_def);
  if d.hp = 0 then
    delete from hc_units where id = d.id;
    ev := ev || jsonb_build_object('type', 'unit_destroyed', 'unit', d.id, 'owner', d.owner_id);
  end if;
  if u.hp = 0 then
    delete from hc_units where id = u.id;
    ev := ev || jsonb_build_object('type', 'unit_destroyed', 'unit', u.id, 'owner', u.owner_id);
  elsif d.hp = 0 and s.range <= 1 and dist = 1
        and not (t.terrain = 'mountain' or (t.terrain = 'water' and not s.naval)) then
    -- 근접 공격으로 격파하면 그 칸으로 진입 (도시면 점령)
    update hc_units set x = p_x, y = p_y where id = u.id;
    moved_in := true;
    if t.is_city and t.owner_id is distinct from u.owner_id then
      ev := ev || hc__capture_city(p_room, p_x, p_y, u.owner_id);
      perform hc__check_instant_conquest(p_room);
    end if;
  end if;
  perform hc__bump(p_room);
  return jsonb_build_object(
    'attacker_id', u.id, 'defender_id', d.id,
    'from', jsonb_build_array(ux, uy), 'at', jsonb_build_array(p_x, p_y),
    'dmg_att', dmg_att, 'dmg_def', dmg_def,
    'attacker_hp', u.hp, 'defender_hp', d.hp, 'moved_in', moved_in, 'events', ev);
end $$;

-- ---------------------------------------------------------------------
-- 도시 건설 (즉시)
-- ---------------------------------------------------------------------
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
  v_name := coalesce(nullif(trim(p_name), ''),
    (array['리옹', '맨체스터', '뮌헨', '마르세유', '리버풀', '함부르크', '보르도', '버밍엄', '툴루즈', '글래스고'])[1 + floor(random() * 10)::int]);
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
-- 대기 / 요새화 / 휴식(치유)
-- ---------------------------------------------------------------------
create or replace function public.hc_unit_rest(p_room uuid, p_unit uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u hc_units; s hc_unit_types; v_own boolean; v_heal int;
begin
  u := hc__act_guard(p_room, p_unit);
  select * into s from hc_unit_types where kind = u.kind;
  if p_mode = 'wait' then
    update hc_units set acted = true where id = u.id;
  elsif p_mode = 'fortify' then
    if s.attack = 0 then raise exception 'CANNOT_FORTIFY'; end if;
    update hc_units set fortified = true, acted = true, moves_left = 0 where id = u.id;
  elsif p_mode = 'heal' then
    if u.moves_left < s.moves then raise exception 'ALREADY_MOVED'; end if;
    if u.hp >= 100 then raise exception 'FULL_HP'; end if;
    select owner_id = u.owner_id into v_own from hc_tiles where room_id = p_room and x = u.x and y = u.y;
    v_heal := case when coalesce(v_own, false) then 25 else 15 end;
    update hc_units set hp = least(100, hp + v_heal), acted = true, moves_left = 0 where id = u.id;
  else
    raise exception 'INVALID_MODE';
  end if;
  perform hc__bump(p_room);
  return jsonb_build_object('mode', p_mode);
end $$;

-- ---------------------------------------------------------------------
-- 업그레이드 (자국 영토 안, 필요 기술 + 골드)
-- ---------------------------------------------------------------------
create or replace function public.hc_unit_upgrade(p_room uuid, p_unit uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u hc_units; up hc_unit_upgrades; pl hc_room_players; v_owner uuid;
begin
  u := hc__act_guard(p_room, p_unit);
  select * into up from hc_unit_upgrades where from_kind = u.kind;
  if not found then raise exception 'NO_UPGRADE'; end if;
  select * into pl from hc_room_players where room_id = p_room and user_id = u.owner_id;
  if up.requires_tech is not null and not (up.requires_tech = any (pl.researched)) then raise exception 'TECH_REQUIRED'; end if;
  if pl.gold < up.gold_cost then raise exception 'NOT_ENOUGH_GOLD'; end if;
  select owner_id into v_owner from hc_tiles where room_id = p_room and x = u.x and y = u.y;
  if v_owner is distinct from u.owner_id then raise exception 'NOT_IN_TERRITORY'; end if;
  update hc_units set kind = up.to_kind, acted = true, moves_left = 0, fortified = false where id = u.id;
  update hc_room_players set gold = gold - up.gold_cost where room_id = p_room and user_id = u.owner_id;
  perform hc__bump(p_room);
  return jsonb_build_object('from', up.from_kind, 'to', up.to_kind, 'gold', up.gold_cost);
end $$;

-- ---------------------------------------------------------------------
-- 정산 래퍼: 정산 후 모든 유닛의 행동 완료 표시를 초기화
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
    ev := ev || hc__check_leaders(p_room) || hc__trigger_events(p_room);
  end if;
  if jsonb_array_length(ev) > 0 then
    update hc_turn_logs set events = events || ev
     where id = (select max(id) from hc_turn_logs where room_id = p_room);
  end if;

  if exists (select 1 from hc_rooms where id = p_room and is_solo and status = 'playing')
     and not exists (select 1 from hc_room_players where room_id = p_room and not is_ai and not is_eliminated) then
    select user_id into v_winner from hc_room_players
     where room_id = p_room and not is_eliminated order by score desc limit 1;
    perform hc__finish_game(p_room, v_winner, 'conquest');
  end if;
end $$;

revoke execute on function public.hc__matchup(text, text)                    from public, anon, authenticated;
revoke execute on function public.hc__act_guard(uuid, uuid)                  from public, anon, authenticated;
revoke execute on function public.hc__bump(uuid)                             from public, anon, authenticated;
revoke execute on function public.hc__check_instant_conquest(uuid)           from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)                     from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn_core(uuid)                from public, anon, authenticated;
revoke execute on function public.hc_unit_move(uuid, uuid, int, int)         from public, anon;
revoke execute on function public.hc_unit_attack(uuid, uuid, int, int)       from public, anon;
revoke execute on function public.hc_unit_found_city(uuid, uuid, text)       from public, anon;
revoke execute on function public.hc_unit_rest(uuid, uuid, text)             from public, anon;
revoke execute on function public.hc_unit_upgrade(uuid, uuid)                from public, anon;
