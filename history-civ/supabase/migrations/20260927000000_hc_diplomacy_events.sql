-- =====================================================================
-- 외교 명성 · 영국 권리 장전(명예혁명 유산) · 조지 워싱턴 · 보스턴 차 사건(영국/미국 딜레마)
-- · 독립운동 후원(이달고·볼리바르·가리발디) · 파쇼다 사건 · 스페인 독감
-- =====================================================================

alter table public.hc_room_players add column if not exists prestige int not null default 0;

alter table public.hc_player_conditions drop constraint if exists hc_player_conditions_cond_id_check;
alter table public.hc_player_conditions add constraint hc_player_conditions_cond_id_check
  check (cond_id in ('depression', 'oil_shock', 'cholera', 'subprime', 'unrest', 'morale',
                     'embargo', 'stagnation', 'pandemic', 'latin_market', 'raw_materials'));

-- ---------------------------------------------------------------------
-- 인물: 권리 장전(1750, 영국 시작 헌정) · 조지 워싱턴(1776, 미국)
-- ---------------------------------------------------------------------
insert into public.hc_scholar_defs
  (id, faction, ord, name, era, icon, works, significance, effect, category, year, factions, immediate, passive, unlock_building, quiz)
values
  ('bill_of_rights', 'britain', 1, '권리 장전 (명예혁명의 유산)', '1689년 · 윌리엄 3세와 메리 2세', '📜',
   '명예혁명(1688) · 권리 장전 승인(1689)',
   '피를 흘리지 않고 왕을 바꾼 명예혁명 뒤, 윌리엄 3세와 메리 2세가 권리 장전을 승인했습니다. "의회의 승인 없는 과세는 위법이다" — 왕보다 의회가 앞서는 입헌 군주제가 자리 잡았어요.',
   '영국 고유: 안정도 +2/턴, 골드 +3/턴(자유로운 상공업), 폭동 골드 손실 1/3', 'statesman', 1750, '{britain}',
   '{}', '{"stability": 2, "gold": 3}', null,
   '{"q": "권리 장전에 담긴 원칙은?", "choices": ["의회의 승인 없는 과세는 위법이다", "왕의 권력은 신에게서 나온다", "모든 토지는 국왕의 것이다"], "answer": 0}'),
  ('washington', 'usa', 9, '조지 워싱턴', '대륙군 총사령관 · 미국 초대 대통령', '🎖️',
   '독립 전쟁 승리(1783) · 초대 대통령(1789)',
   '독립 전쟁에서 대륙군을 이끌어 영국군에 승리했고, 두 번의 임기 뒤 스스로 물러나 평화로운 권력 이양의 전통을 남겼습니다.',
   '모든 공격 +1 (전시 지휘), 민병대 1부대 합류', 'statesman', 1776, '{usa}',
   '{"spawn": {"kind": "militia", "count": 1}}', '{}', null,
   '{"q": "조지 워싱턴이 남긴 전통은?", "choices": ["종신 대통령제", "두 번의 임기 뒤 스스로 물러남", "왕위 세습"], "answer": 1}')
on conflict (id) do update set
  faction = excluded.faction, ord = excluded.ord, name = excluded.name, era = excluded.era, icon = excluded.icon,
  works = excluded.works, significance = excluded.significance, effect = excluded.effect, category = excluded.category,
  year = excluded.year, factions = excluded.factions, immediate = excluded.immediate, passive = excluded.passive,
  unlock_building = excluded.unlock_building, quiz = excluded.quiz;

create or replace function public.hc__attack_bonus(p_room uuid, p_player uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when hc__has_leader(p_room, p_player, 'napoleon') then 2 else 0 end
       + case when hc__has_person(p_room, p_player, 'washington') then 1 else 0 end
       + case when hc__has_condition(p_room, p_player, 'morale') then 1 else 0 end;
$$;

-- ---------------------------------------------------------------------
-- 사건: 보스턴 차 사건 · 독립운동 후원 · 파쇼다 · 스페인 독감
-- ---------------------------------------------------------------------
insert into public.hc_event_defs
  (id, title, era, icon, body, choice_a_label, choice_a_desc, choice_a, choice_b_label, choice_b_desc, choice_b, sort, year, factions)
values
  ('boston_tea_britain', '보스턴 차 사건 — 식민지의 반발', '1773년', '🫖',
   '차 관세와 동인도 회사의 독점 판매에 반발한 보스턴 주민들이 항구의 배를 습격해 차 상자를 바다에 던졌습니다. "대표 없는 곳에 과세 없다!" 영국 정부는 어떻게 대응할까요?',
   '강경 진압 (보스턴항 봉쇄)', '즉시 골드 +40 징수 · 식민지 반발로 반란(안정도 -3·망치 -2/턴) 4턴',
   '{"gold": 40, "condition": {"id": "unrest", "turns": 4}}',
   '유화책 (관세 철회·자치 인정)', '골드 -20 · 평화 유지, 외교 명성 +15',
   '{"gold": -20, "prestige": 15}', 15, 1773, '{britain}'),
  ('boston_tea_usa', '보스턴 차 사건 — 대표 없는 과세', '1773년', '🫖',
   '영국이 차에 관세를 매기고 동인도 회사에 독점 판매권을 주었습니다. "대표 없는 곳에 과세 없다!" 식민지 주민들은 어떻게 맞설까요?',
   '차 상자 투척 (결사항전)', '혁명 열기 폭발 · 민병대 2부대 무상 징집, 이념 +10 · 영국의 무역 제재(골드 -30%) 3턴',
   '{"ideology": 10, "spawn": {"kind": "militia", "count": 2}, "condition": {"id": "embargo", "turns": 3}}',
   '불매 운동·평화 탄원', '상업 안정 골드 +20 · 혁명 추진력 정체(연구 -50%) 3턴',
   '{"gold": 20, "condition": {"id": "stagnation", "turns": 3}}', 16, 1773, '{usa}'),
  ('hidalgo', '독립운동 후원 — 미겔 이달고 신부', '1810년', '⛪',
   '멕시코의 이달고 신부가 "돌로레스의 외침"으로 스페인에 맞선 민중 봉기를 일으켰습니다. 봉기 자금을 지원해 달라고 요청합니다.',
   '봉기 자금 60골드 지원', '라틴 아메리카 신시장 개척(골드 +5/턴, 이후 계속) · 외교 명성 +15',
   '{"gold": -60, "prestige": 15, "condition": {"id": "latin_market", "turns": 999}}',
   '정중히 거절', '아무 일도 일어나지 않습니다.', '{}', 35, 1810, null),
  ('bolivar', '독립운동 후원 — 볼리바르 & 산마르틴', '1815년', '⚔️',
   '시몬 볼리바르와 산마르틴이 남아메리카를 스페인에서 해방하는 전쟁을 이끌고 있습니다. 해방군 자금을 요청합니다.',
   '해방군 자금 100골드 지원', '원자재(목재·광물) 무역 독점권 · 생산 +10% (이후 계속)',
   '{"gold": -100, "prestige": 10, "condition": {"id": "raw_materials", "turns": 999}}',
   '정중히 거절', '아무 일도 일어나지 않습니다.', '{}', 38, 1815, null),
  ('garibaldi', '독립운동 후원 — 가리발디의 붉은 셔츠대', '1860년', '🇮🇹',
   '주세페 가리발디가 붉은 셔츠 의용대 "천인대"를 이끌고 이탈리아 통일에 나섰습니다. 군자금을 보내 줄 수 있을까요?',
   '군자금 80골드 지원', '유럽 외교 명성 +20 · 전 군 사기(공격 +1) 5턴',
   '{"gold": -80, "prestige": 20, "condition": {"id": "morale", "turns": 5}}',
   '정중히 거절', '아무 일도 일어나지 않습니다.', '{}', 65, 1860, null),
  ('fashoda', '파쇼다 사건', '1898년', '🗺️',
   '아프리카를 세로로 잇는 영국(종단 정책)과 가로로 잇는 프랑스(횡단 정책)가 수단의 파쇼다에서 맞닥뜨렸습니다. 전쟁 직전입니다!',
   '물러서지 않는다', '외교 명성 +10, 전 군 사기 3턴 · 긴장으로 안정도 -5',
   '{"prestige": 10, "stability": -5, "condition": {"id": "morale", "turns": 3}}',
   '양보하고 협상 (훗날 영·프 협상)', '외교 명성 -5 · 평화의 대가로 골드 +30, 안정도 +5',
   '{"prestige": -5, "gold": 30, "stability": 5}', 85, 1898, '{britain,france}'),
  ('spanish_flu', '스페인 독감', '1918년', '😷',
   '제1차 세계 대전 막바지, 전 세계에서 수천만 명이 목숨을 잃은 독감이 퍼지고 있습니다.',
   '방역·격리', '공중 보건 투자 · 골드 -30', '{"gold": -30}',
   '방치', '비용을 아낀다 · 대유행(식량 -50%, 파스퇴르가 있으면 무효) 3턴',
   '{"condition": {"id": "pandemic", "turns": 3}}', 88, 1918, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 기존 함수 패치
-- ---------------------------------------------------------------------
do $mig$
declare d text;
begin
  -- 효과에 외교 명성
  d := pg_get_functiondef('public.hc__apply_effects(uuid,uuid,jsonb)'::regprocedure);
  if position('prestige' in d) = 0 then
    if position('    research_progress = research_progress + coalesce((p_eff->>''research'')::int, 0)' in d) = 0 then
      raise exception 'apply_effects pattern missing';
    end if;
    d := replace(d, '    research_progress = research_progress + coalesce((p_eff->>''research'')::int, 0)',
                    '    prestige          = prestige + coalesce((p_eff->>''prestige'')::int, 0),
    research_progress = research_progress + coalesce((p_eff->>''research'')::int, 0)');
    execute d;
  end if;

  -- 새 상태 효과 (연대기 경제 패시브에 추가)
  d := pg_get_functiondef('public.hc__faction_passives(uuid)'::regprocedure);
  if position('latin_market' in d) = 0 then
    if position('    if r.difficulty = ''easy'' and not pl.is_ai then' in d) = 0 then raise exception 'faction_passives pattern missing'; end if;
    d := replace(d, '    if r.difficulty = ''easy'' and not pl.is_ai then',
'    if hc__has_condition(p_room, pl.user_id, ''embargo'') then g := g - pl.gold_rate * 30 / 100; end if;
    if hc__has_condition(p_room, pl.user_id, ''stagnation'') then rs := rs - pl.innovation / 2; end if;
    if hc__has_condition(p_room, pl.user_id, ''pandemic'') and not hc__has_person(p_room, pl.user_id, ''pasteur'') then
      f := f - pl.food_rate / 2;
    end if;
    if hc__has_condition(p_room, pl.user_id, ''latin_market'') then g := g + 5; end if;
    if hc__has_condition(p_room, pl.user_id, ''raw_materials'') then h := h + pl.hammer_rate / 10; end if;

    if r.difficulty = ''easy'' and not pl.is_ai then');
    execute d;
  end if;

  -- 권리 장전: 폭동 골드 손실 3 → 1
  d := pg_get_functiondef('public.hc__leader_passives(uuid)'::regprocedure);
  if position('bill_of_rights' in d) = 0 then
    if position('gold - case when stability < 30 then 3 else 0 end' in d) = 0 then raise exception 'leader_passives pattern missing'; end if;
    d := replace(d, 'gold - case when stability < 30 then 3 else 0 end',
                    'gold - case when stability < 30 then case when hc__has_person(p_room, user_id, ''bill_of_rights'') then 1 else 3 end else 0 end');
    execute d;
  end if;

  -- 후원 사건: 골드가 모자라면 지원 선택 불가
  d := pg_get_functiondef('public.hc_choose_event(uuid,bigint,text)'::regprocedure);
  if position('NOT_ENOUGH_GOLD' in d) = 0 then
    d := replace(d, '  res := hc__resolve_event(p_event, p_choice);',
'  if exists (select 1 from hc_player_events e join hc_event_defs ed on ed.id = e.event_id
              join hc_room_players rp on rp.room_id = e.room_id and rp.user_id = e.player_id
             where e.id = p_event
               and rp.gold < -coalesce(((case when p_choice = ''b'' then ed.choice_b else ed.choice_a end)->>''gold'')::int, 0)) then
    raise exception ''NOT_ENOUGH_GOLD'';
  end if;
  res := hc__resolve_event(p_event, p_choice);');
    execute d;
  end if;

  -- 1750년 시작 헌정(권리 장전)은 게임 시작 즉시 등장
  d := pg_get_functiondef('public.hc_start_game(uuid)'::regprocedure);
  if position('hc__check_persons' in d) = 0 then
    d := regexp_replace(d, 'end\s*\$function\$\s*$', '  perform hc__check_persons(p_room);
end $function$');
    execute d;
  end if;
end $mig$;

-- AI가 후원 사건을 받으면 골드가 있을 때만 지원
create or replace function public.hc__trigger_events(p_room uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r hc_rooms; pl record; e record; v_year int; v_id bigint; v_choice text; out jsonb := '[]';
begin
  select * into r from hc_rooms where id = p_room;
  v_year := hc__year(r.turn_number);
  for pl in select * from hc_room_players where room_id = p_room and not is_eliminated loop
    continue when exists (select 1 from hc_player_events where room_id = p_room and player_id = pl.user_id and turn = r.turn_number);
    select * into e from hc_event_defs ed
     where ed.year is not null and ed.year <= v_year
       and (ed.factions is null or pl.faction::text = any (ed.factions))
       and not exists (select 1 from hc_player_events pe where pe.room_id = p_room and pe.player_id = pl.user_id and pe.event_id = ed.id)
     order by ed.year, ed.sort limit 1;
    continue when not found;
    insert into hc_player_events (room_id, player_id, event_id, turn)
    values (p_room, pl.user_id, e.id, r.turn_number) returning id into v_id;
    out := out || jsonb_build_object('type', 'historic_event', 'player', pl.user_id, 'event', e.id);
    if pl.is_ai then
      v_choice := case when random() < 0.5 then 'a' else 'b' end;
      if pl.gold < -coalesce(((case when v_choice = 'b' then e.choice_b else e.choice_a end)->>'gold')::int, 0) then
        v_choice := case when v_choice = 'a' then 'b' else 'a' end;
      end if;
      out := out || hc__resolve_event(v_id, v_choice);
    end if;
  end loop;
  return out;
end $$;

-- 시간 초과 자동 결정도 골드가 모자라면 다른 선택지
create or replace function public.hc__resolve_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_turn int; a record; v_winner uuid; v_status hc_room_status; ev jsonb := '[]';
begin
  select turn_number into v_turn from hc_rooms where id = p_room;

  for a in select e.id, case when rp.gold < -coalesce((d.choice_a->>'gold')::int, 0) then 'b' else 'a' end as ch
             from hc_player_events e join hc_event_defs d on d.id = e.event_id
             join hc_room_players rp on rp.room_id = e.room_id and rp.user_id = e.player_id
            where e.room_id = p_room and e.status = 'pending' and e.turn <= v_turn loop
    ev := ev || hc__resolve_event(a.id, a.ch);
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
    ev := ev || hc__check_persons(p_room) || hc__check_leaders(p_room) || hc__trigger_events(p_room);
  end if;
  if jsonb_array_length(ev) > 0 then
    update hc_turn_logs set events = events || ev
     where id = (select max(id) from hc_turn_logs where room_id = p_room);
  end if;

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

revoke execute on function public.hc__attack_bonus(uuid, uuid)     from public, anon, authenticated;
revoke execute on function public.hc__apply_effects(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.hc__faction_passives(uuid)       from public, anon, authenticated;
revoke execute on function public.hc__leader_passives(uuid)        from public, anon, authenticated;
revoke execute on function public.hc__trigger_events(uuid)         from public, anon, authenticated;
revoke execute on function public.hc__resolve_turn(uuid)           from public, anon, authenticated;
revoke execute on function public.hc_start_game(uuid)              from public, anon;
revoke execute on function public.hc_choose_event(uuid, bigint, text) from public, anon;
