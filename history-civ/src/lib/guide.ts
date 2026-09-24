// 우측 패널 가이드: "지금 무엇을 해야 하는지" (CTA) + 이번 턴 체크리스트
import { leadersOf, unitCost } from './leaders';
import { canFoundCity, indexTiles, producibleUnits, UNIT_TYPES } from './rules';
import type { Action, GameSnapshot, RoomPlayer, Unit } from '../types/game';

export type GuideFocus =
  | { kind: 'unit'; id: string }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'research' }
  | { kind: 'event' }
  | null;

export interface GuideStep {
  id: 'event' | 'research' | 'production' | 'units' | 'end';
  label: string;
  done: boolean;
}

export interface Guide {
  title: string;
  detail: string;
  focus: GuideFocus;
  checklist: GuideStep[];
  /** 아직 명령을 받지 않은, 움직일 수 있는 내 유닛 (맵에서 펄스 표시) */
  idleUnitIds: string[];
}

const orderedUnitIds = (pending: Action[]) =>
  new Set(pending.flatMap((a) => ('unit_id' in a ? [a.unit_id] : [])));

export function idleUnits(snapshot: GameSnapshot, me: RoomPlayer, pending: Action[]): Unit[] {
  const ordered = orderedUnitIds(pending);
  return snapshot.units.filter(
    (u) => u.owner_id === me.user_id && u.moves_left > 0 && !ordered.has(u.id)
      && (UNIT_TYPES[u.kind].attack > 0 || u.kind === 'settler'),
  );
}

export function computeGuide(snapshot: GameSnapshot, me: RoomPlayer, pending: Action[]): Guide {
  const tiles = indexTiles(snapshot.tiles);
  const myUnits = snapshot.units.filter((u) => u.owner_id === me.user_id);
  const leaders = leadersOf(snapshot.leaders, me.user_id);
  const idle = idleUnits(snapshot, me, pending);

  const hasResearch = !!me.research_target || pending.some((a) => a.type === 'research');
  const allResearched = me.researched.length >= 5;

  const myCities = snapshot.tiles.filter((t) => t.is_city && t.owner_id === me.user_id);
  const producing = new Set(pending.flatMap((a) => (a.type === 'produce' ? [`${a.x},${a.y}`] : [])));
  const hammerLeft = me.hammer - pending.reduce((s, a) => s + (a.type === 'produce' ? unitCost(a.unit_kind, leaders) : 0), 0);
  const cheapest = Math.min(...producibleUnits(me, myUnits, leaders).map((k) => unitCost(k, leaders)));
  const idleCity = hammerLeft >= cheapest ? myCities.find((c) => !producing.has(`${c.x},${c.y}`)) : undefined;

  const settler = idle.find((u) => u.kind === 'settler');
  const soldier = idle.find((u) => u.kind !== 'settler');
  const event = snapshot.my_events[0];

  const checklist: GuideStep[] = [
    ...(snapshot.my_events.length ? [{ id: 'event' as const, label: `역사적 사건에 답하기 (${event!.title})`, done: false }] : []),
    { id: 'research', label: allResearched ? '모든 기술 연구 완료' : '연구할 기술 고르기', done: hasResearch || allResearched },
    { id: 'production', label: '도시에서 생산 고르기', done: !idleCity },
    { id: 'units', label: idle.length ? `유닛에게 명령 내리기 (${idle.length}개 대기)` : '유닛 명령 완료', done: idle.length === 0 },
    { id: 'end', label: '턴 종료 (E)', done: me.has_ended_turn },
  ];

  let title = '준비 완료! 턴을 종료하세요';
  let detail = '오른쪽의 [턴 종료] 버튼 또는 E 키를 누르면 모든 문명의 명령이 동시에 실행됩니다.';
  let focus: GuideFocus = null;

  if (me.has_ended_turn) {
    title = '다른 문명을 기다리는 중…';
    detail = '모든 플레이어가 턴을 끝내거나 시간이 다 되면 다음 턴이 시작됩니다.';
  } else if (event) {
    title = `역사적 사건: ${event.title}`;
    detail = '선택에 따라 자원과 안정도가 바로 바뀝니다. 고르지 않으면 턴 종료 때 첫 번째 선택지로 결정돼요.';
    focus = { kind: 'event' };
  } else if (settler) {
    const canBuild = canFoundCity(settler, tiles);
    title = canBuild ? '개척자로 도시를 건설하세요' : '개척자를 도시 터로 옮기세요';
    detail = canBuild
      ? '개척자를 선택하고 [도시 건설] 버튼(B 키)을 누르세요. 도시가 많을수록 생산·연구가 빨라집니다.'
      : '다른 도시와 3칸 이상 떨어진 빈 땅이 필요해요. 개척자를 선택한 뒤 노란 칸을 눌러 이동하세요.';
    focus = { kind: 'unit', id: settler.id };
  } else if (!hasResearch && !allResearched) {
    title = '연구할 기술을 고르세요';
    detail = '증기기관 → 전기화 → 신무기는 과학 승리, 계몽사상 → 인권선언은 혁명 이념(문화)으로 이어집니다.';
    focus = { kind: 'research' };
  } else if (idleCity) {
    title = `${idleCity.city_name ?? '도시'}에서 생산을 고르세요`;
    detail = '도시 칸을 누르면 생산할 유닛이 보여요. 망치가 부족한 유닛은 흐리게 표시됩니다.';
    focus = { kind: 'tile', x: idleCity.x, y: idleCity.y };
  } else if (soldier) {
    const name = UNIT_TYPES[soldier.kind].name;
    title = `${name}을(를) 이동시켜 정찰하세요`;
    detail = '유닛을 선택하면 노란 칸(이동)과 빨간 칸(공격)이 보여요. 반짝이는 유닛이 아직 명령을 받지 않은 유닛입니다. (N: 다음 유닛)';
    focus = { kind: 'unit', id: soldier.id };
  }

  return { title, detail, focus, checklist, idleUnitIds: idle.map((u) => u.id) };
}
