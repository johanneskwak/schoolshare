import { describe, expect, it } from 'vitest';
import { MAX_ACTIONS, removeUnitActions, upsertAction } from './actions';
import type { Action } from '../types/game';

const U = '11111111-1111-1111-1111-111111111111';

describe('upsertAction', () => {
  it('같은 유닛의 새 명령은 이전 명령을 대체한다', () => {
    let list: Action[] = [];
    list = upsertAction(list, { type: 'move', unit_id: U, x: 1, y: 1 });
    list = upsertAction(list, { type: 'found_city', unit_id: U });
    expect(list).toEqual([{ type: 'found_city', unit_id: U }]);
  });
  it('연구는 하나만, 이념 전파는 여러 번 가능', () => {
    let list: Action[] = [];
    list = upsertAction(list, { type: 'research', tech: 'steam_engine' });
    list = upsertAction(list, { type: 'research', tech: 'enlightenment' });
    list = upsertAction(list, { type: 'spread' });
    list = upsertAction(list, { type: 'spread' });
    expect(list.filter((a) => a.type === 'research')).toEqual([{ type: 'research', tech: 'enlightenment' }]);
    expect(list.filter((a) => a.type === 'spread')).toHaveLength(2);
  });
  it('같은 도시의 생산은 대체, 다른 도시는 유지', () => {
    let list: Action[] = [];
    list = upsertAction(list, { type: 'produce', x: 2, y: 2, unit_kind: 'militia' });
    list = upsertAction(list, { type: 'produce', x: 5, y: 5, unit_kind: 'militia' });
    list = upsertAction(list, { type: 'produce', x: 2, y: 2, unit_kind: 'cavalry' });
    expect(list).toHaveLength(2);
    expect(list).toContainEqual({ type: 'produce', x: 2, y: 2, unit_kind: 'cavalry' });
  });
  it('서버 제한(60개)을 넘지 않는다', () => {
    let list: Action[] = [];
    for (let i = 0; i < MAX_ACTIONS + 5; i++) list = upsertAction(list, { type: 'spread' });
    expect(list).toHaveLength(MAX_ACTIONS);
  });
});

describe('removeUnitActions', () => {
  it('해당 유닛 명령만 지운다', () => {
    const list: Action[] = [{ type: 'move', unit_id: U, x: 1, y: 1 }, { type: 'spread' }];
    expect(removeUnitActions(list, U)).toEqual([{ type: 'spread' }]);
  });
});
