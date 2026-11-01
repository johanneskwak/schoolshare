-- =====================================================================
-- 불가사의: 즉시 완공 → 약 15턴 건설 (도시 1곳의 턴당 생산을 매 턴 투입) → 완공 후 10턴 사수 = 승리
-- 독일(프로이센) 철혈 재정: 군사 유지비 -20%
-- =====================================================================

-- 중반 도시 1곳 생산 ≈ 15~16/턴 기준 15턴
update public.hc_wonder_defs set hammer_cost = case id when 'manhattan' then 300 else 240 end;

create table if not exists public.hc_wonder_projects (
  room_id      uuid not null references public.hc_rooms(id) on delete cascade,
  player_id    uuid not null references public.hc_profiles(id),
  wonder_id    text not null references public.hc_wonder_defs(id),
  x            int  not null,
  y            int  not null,
  progress     int  not null default 0,
  started_turn int  not null,
  primary key (room_id, player_id, wonder_id),
  unique (room_id, x, y)
);
alter table public.hc_wonder_projects enable row level security;
create policy "members read" on public.hc_wonder_projects for select to authenticated using (public.hc_is_room_member(room_id));

/** 이 도시가 매 턴 불가사의에 투입하는 망치: 문명 턴당 생산 ÷ 도시 수 (최소 3), 아인슈타인+맨해튼 2배 */
create or replace function public.hc__wonder_rate(p_room uuid, p_player uuid, p_wonder text)
returns int language sql stable security definer set search_path = public as $$
  select greatest(3, rp.hammer_rate / greatest(1, (select count(*) from hc_tiles t
                                                    where t.room_id = p_room and t.owner_id = p_player and t.is_city)::int))
       * case when p_wonder = 'manhattan' and hc__has_person(p_room, p_player, 'einstein') then 2 else 1 end
    from hc_room_players rp where rp.room_id = p_room and rp.user_id = p_player;
$$;

-- 건설 시작 (망치는 매 턴 조금씩 들어간다)
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
  if exists (select 1 from hc_wonder_projects where room_id = p_room and x = p_x and y = p_y) then raise exception 'CITY_BUILDING_WONDER'; end if;
  if exists (select 1 from hc_wonder_projects where room_id = p_room and player_id = pl.user_id and wonder_id = p_wonder) then
    raise exception 'WONDER_IN_PROGRESS';
  end if;

  insert into hc_wonder_projects (room_id, player_id, wonder_id, x, y, started_turn)
  values (p_room, pl.user_id, p_wonder, p_x, p_y, r.turn_number);
  ev := jsonb_build_array(jsonb_build_object('type', 'wonder_started', 'player', pl.user_id, 'wonder', p_wonder,
                                             'x', p_x, 'y', p_y, 'city', t.city_name));
  update hc_turn_logs set events = events || ev where id = (select max(id) from hc_turn_logs where room_id = p_room);
  perform hc__bump(p_room);
  return ev;
end $$;

create or replace function public.hc_cancel_wonder(p_room uuid, p_x int, p_y int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from hc_rooms where id = p_room and status = 'playing' for update;
  if not found then raise exception 'ROOM_NOT_PLAYING'; end if;
  delete from hc_wonder_projects where room_id = p_room and x = p_x and y = p_y and player_id = auth.uid();
  if not found then raise exception 'NO_WONDER'; end if;
  perform hc__bump(p_room);
end $$;

-- 매 턴: 도시를 잃었거나 다른 문명이 먼저 완공한 공사는 중단, 나머지는 망치 투입 → 완공
create or replace function public.hc__advance_wonders(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pj record; v_cost int; v_take int; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  for pj in select p.*, t.owner_id as city_owner, rp.hammer as pool
              from hc_wonder_projects p
              join hc_tiles t on t.room_id = p.room_id and t.x = p.x and t.y = p.y
              join hc_room_players rp on rp.room_id = p.room_id and rp.user_id = p.player_id
             where p.room_id = p_room order by p.started_turn loop
    if pj.city_owner is distinct from pj.player_id
       or exists (select 1 from hc_wonders where room_id = p_room and wonder_id = pj.wonder_id) then
      delete from hc_wonder_projects where room_id = p_room and player_id = pj.player_id and wonder_id = pj.wonder_id;
      out := out || jsonb_build_object('type', 'wonder_lost', 'player', pj.player_id, 'wonder', pj.wonder_id);
      continue;
    end if;
    select hammer_cost into v_cost from hc_wonder_defs where id = pj.wonder_id;
    v_take := least(pj.pool, hc__wonder_rate(p_room, pj.player_id, pj.wonder_id), v_cost - pj.progress);
    update hc_room_players set hammer = hammer - v_take where room_id = p_room and user_id = pj.player_id;
    if pj.progress + v_take >= v_cost then
      delete from hc_wonder_projects where room_id = p_room and player_id = pj.player_id and wonder_id = pj.wonder_id;
      insert into hc_wonders (room_id, wonder_id, player_id, x, y, built_turn)
      values (p_room, pj.wonder_id, pj.player_id, pj.x, pj.y, r.turn_number);
      out := out || jsonb_build_object('type', 'wonder_built', 'player', pj.player_id, 'wonder', pj.wonder_id, 'x', pj.x, 'y', pj.y);
    else
      update hc_wonder_projects set progress = progress + v_take
       where room_id = p_room and player_id = pj.player_id and wonder_id = pj.wonder_id;
    end if;
  end loop;
  return out;
end $$;

do $mig$
declare d text;
begin
  -- 정산 래퍼: 연대기 처리 직후 불가사의 공사 진행
  d := pg_get_functiondef('public.hc__resolve_turn(uuid)'::regprocedure);
  if position('hc__advance_wonders' in d) = 0 then
    if position('hc__check_leaders(p_room) || hc__trigger_events(p_room);' in d) = 0 then raise exception 'resolve_turn pattern missing'; end if;
    d := replace(d, 'hc__check_leaders(p_room) || hc__trigger_events(p_room);',
                    'hc__check_leaders(p_room) || hc__trigger_events(p_room) || hc__advance_wonders(p_room);');
    execute d;
  end if;

  -- 독일 철혈 재정: 유닛 유지비 -20%
  d := pg_get_functiondef('public.hc__resolve_turn_core(uuid)'::regprocedure);
  if position('then 4 else 5 end / 5' in d) = 0 then
    if position('greatest(0, v_units - 2 * v_cities)' in d) = 0 then raise exception 'core upkeep pattern missing'; end if;
    d := replace(d, 'greatest(0, v_units - 2 * v_cities)',
                    'greatest(0, v_units - 2 * v_cities) * case when p.faction = ''empire'' then 4 else 5 end / 5');
    execute d;
  end if;

  -- 스냅샷에 공사 현황
  d := pg_get_functiondef('public.hc_get_game_state(uuid)'::regprocedure);
  if position('wonder_projects' in d) = 0 then
    d := replace(d, '    ''buildings'',',
'    ''wonder_projects'', (select coalesce(jsonb_agg(jsonb_build_object(
                                     ''wonder_id'', p.wonder_id, ''player_id'', p.player_id, ''x'', p.x, ''y'', p.y,
                                     ''progress'', p.progress, ''cost'', d.hammer_cost, ''started_turn'', p.started_turn,
                                     ''rate'', hc__wonder_rate(p_room, p.player_id, p.wonder_id),
                                     ''name_ko'', d.name_ko, ''icon'', d.icon)), ''[]'')
                     from hc_wonder_projects p join hc_wonder_defs d on d.id = p.wonder_id
                    where p.room_id = p_room),
    ''buildings'',');
    execute d;
  end if;
end $mig$;

revoke execute on function public.hc__wonder_rate(uuid, uuid, text)  from public, anon, authenticated;
revoke execute on function public.hc__advance_wonders(uuid)          from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)             from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn_core(uuid)        from public, anon, authenticated;
revoke execute on function public.hc_build_wonder(uuid, int, int, text) from public, anon;
revoke execute on function public.hc_cancel_wonder(uuid, int, int)   from public, anon;
revoke execute on function public.hc_get_game_state(uuid)            from public, anon;
