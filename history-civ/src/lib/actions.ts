import type { Action } from '../types/game';

/** 명령 하나가 차지하는 "슬롯". 같은 슬롯의 새 명령은 이전 명령을 대체한다. */
export function actionSlot(a: Action): string | null {
  switch (a.type) {
    case 'move':
    case 'found_city':
      return `unit:${a.unit_id}`; // 유닛 하나당 명령 하나
    case 'produce':
    case 'build':
      return `${a.type}:${a.x},${a.y}`;
    case 'research':
      return 'research';
    case 'spread':
      return null; // 여러 번 가능
  }
}

export const MAX_ACTIONS = 60; // 서버 _store_actions 제한과 동일

export function upsertAction(list: Action[], next: Action): Action[] {
  const slot = actionSlot(next);
  const kept = slot === null ? list : list.filter((a) => actionSlot(a) !== slot);
  return kept.length >= MAX_ACTIONS ? kept : [...kept, next];
}

export function removeUnitActions(list: Action[], unitId: string): Action[] {
  return list.filter((a) => actionSlot(a) !== `unit:${unitId}`);
}
