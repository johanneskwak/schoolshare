import { describe, expect, it } from 'vitest';
import { computeGuide } from './guide';
import { unitCost } from './leaders';
import { producibleUnits } from './rules';
import type { Action, GameSnapshot, RoomPlayer, Tile, Unit } from '../types/game';

const ME = 'me';

function snap(units: Unit[], extra: Partial<GameSnapshot> = {}, cityAt = { x: 2, y: 2 }): GameSnapshot {
  const tiles: Tile[] = [];
  for (let x = 0; x < 10; x++)
    for (let y = 0; y < 10; y++)
      tiles.push({
        x, y, terrain: 'plains', owner_id: Math.max(Math.abs(x - cityAt.x), Math.abs(y - cityAt.y)) <= 1 ? ME : null,
        is_city: x === cityAt.x && y === cityAt.y, is_capital: x === cityAt.x && y === cityAt.y,
        city_name: x === cityAt.x && y === cityAt.y ? '파리' : null, city_pop: 1, improvement: null, city_hp: 100,
      });
  return {
    server_now: '', room: {} as GameSnapshot['room'], players: [me()], tiles, units,
    my_actions: [], last_log: null, leaders: [], my_events: [], scholars: [], wonders: [], year: 1760, buildings: [], conditions: [], ...extra,
  };
}
function me(o: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    room_id: 'r', user_id: ME, nickname: '나', seat: 0, faction: 'france', is_ready: true, has_ended_turn: false,
    is_eliminated: false, is_ai: false, stability: 60, gold: 30, food: 0, hammer: 20, innovation: 0, ideology: 0,
    research_target: null, research_progress: 0, researched: [], score: 0, joined_at: '', ...o,
  };
}
const unit = (o: Partial<Unit>): Unit => ({
  id: 'u', owner_id: ME, kind: 'militia', x: 2, y: 2, hp: 100, moves_left: 2, created_turn: 1, acted: false, fortified: false, ...o,
});

describe('computeGuide', () => {
  it('첫 턴: 도시를 세울 수 있는 곳의 개척자가 있으면 도시 건설을 안내', () => {
    const settler = unit({ id: 's', kind: 'settler', x: 6, y: 6 });
    const g = computeGuide(snap([settler]), me(), []);
    expect(g.title).toBe('개척자로 도시를 건설하세요');
    expect(g.focus).toEqual({ kind: 'unit', id: 's' });
  });
  it('수도 옆 개척자는 도시 터로 옮기라고 안내', () => {
    const g = computeGuide(snap([unit({ id: 's', kind: 'settler', x: 3, y: 2 })]), me(), []);
    expect(g.title).toBe('개척자를 도시 터로 옮기세요');
  });
  it('개척자가 행동하면 연구 → 생산 → 정찰 → 턴 종료 순서로 안내', () => {
    const settlerDone = unit({ id: 's', kind: 'settler', x: 6, y: 6, acted: true });
    let units = [settlerDone, unit({ id: 'm', x: 2, y: 3 })];
    let pending: Action[] = [];
    expect(computeGuide(snap(units), me(), pending).title).toBe('연구할 기술을 고르세요');
    pending = [{ type: 'research', tech: 'steam_engine' }];
    expect(computeGuide(snap(units), me(), pending).title).toBe('파리에서 생산을 고르세요');
    pending = [...pending, { type: 'produce', x: 2, y: 2, unit_kind: 'militia' }];
    const g = computeGuide(snap(units), me(), pending);
    expect(g.title).toBe('시민군을(를) 이동시켜 정찰하세요');
    expect(g.idleUnitIds).toEqual(['m']);
    units = [settlerDone, unit({ id: 'm', x: 3, y: 3, acted: true })];
    const done = computeGuide(snap(units), me(), pending);
    expect(done.title).toBe('준비 완료! 턴을 종료하세요');
    expect(done.checklist.filter((c) => c.id !== 'end').every((c) => c.done)).toBe(true);
  });
  it('역사적 사건이 있으면 가장 먼저 안내', () => {
    const ev = { pe_id: 1, id: 'luddite', turn: 3, title: '러다이트 운동', era: '', icon: '', body: '',
      choice_a_label: '', choice_a_desc: '', choice_b_label: '', choice_b_desc: '' };
    const g = computeGuide(snap([unit({ kind: 'settler', x: 6, y: 6 })], { my_events: [ev] }), me(), []);
    expect(g.title).toBe('역사적 사건: 러다이트 운동');
    expect(g.checklist[0]!.id).toBe('event');
  });
  it('이동력이 없는 유닛은 대기 목록에서 제외', () => {
    const g = computeGuide(snap([unit({ moves_left: 0 })]), me({ research_target: 'steam_engine', hammer: 0 }), []);
    expect(g.idleUnitIds).toEqual([]);
  });
});

describe('인물 효과 (LeaderSystem)', () => {
  it('링컨: 비프랑스도 시민군 징집, 비용 50%', () => {
    const b = me({ faction: 'britain' });
    expect(producibleUnits(b, [])).not.toContain('militia');
    expect(producibleUnits(b, [], ['lincoln'])).toContain('militia');
    expect(unitCost('militia', ['lincoln'])).toBe(5);
  });
  it('비스마르크: 군사 유닛 25% 할인, 개척자는 제외', () => {
    expect(unitCost('line_infantry', ['bismarck'])).toBe(15);
    expect(unitCost('settler', ['bismarck'])).toBe(30);
  });
});
