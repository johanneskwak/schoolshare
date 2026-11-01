import { describe, expect, it } from 'vitest';
import { buildableImprovements, canFoundCity, indexTiles, key, producibleUnits, unitTargets } from './rules';
import type { RoomPlayer, Terrain, Tile, Unit } from '../types/game';

const ME = 'me';
const ENEMY = 'enemy';

function grid(w: number, h: number, special: Record<string, Partial<Tile>> = {}): Tile[] {
  const out: Tile[] = [];
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      out.push({
        x, y, terrain: 'plains' as Terrain, owner_id: null, is_city: false, is_capital: false,
        city_name: null, city_pop: 0, improvement: null, city_hp: 100, ...special[key(x, y)],
      });
  return out;
}

const unit = (p: Partial<Unit>): Unit => ({
  id: 'u', owner_id: ME, kind: 'line_infantry', x: 2, y: 2, hp: 100, moves_left: 1, created_turn: 1, acted: false, fortified: false, ...p,
});

const player = (p: Partial<RoomPlayer> = {}): RoomPlayer => ({
  room_id: 'r', user_id: ME, nickname: 'a', seat: 0, faction: 'france', is_ready: true, has_ended_turn: false,
  is_eliminated: false, is_ai: false, stability: 60, gold: 30, food: 0, hammer: 20, innovation: 0, ideology: 0, research_target: null,
  research_progress: 0, researched: [], score: 0, joined_at: '', ...p,
});

describe('unitTargets', () => {
  it('공성: 성벽이 남은 빈 적 도시는 공격 대상, HP 0이면 근접 유닛만 입성(이동) 가능', () => {
    const city = { is_city: true, owner_id: ENEMY, city_name: '베를린', city_pop: 2 };
    const walled = indexTiles(grid(5, 5, { [key(3, 2)]: { ...city, city_hp: 40 } }));
    const u = unit({});
    let r = unitTargets(u, walled, [u]);
    expect(r.attacks.has(key(3, 2))).toBe(true);
    expect(r.moves.has(key(3, 2))).toBe(false);

    const breached = indexTiles(grid(5, 5, { [key(3, 2)]: { ...city, city_hp: 0 } }));
    r = unitTargets(u, breached, [u]);
    expect(r.moves.has(key(3, 2))).toBe(true);
    expect(r.attacks.has(key(3, 2))).toBe(false);

    const art = unit({ kind: 'artillery' });
    expect(unitTargets(art, breached, [art]).moves.has(key(3, 2))).toBe(false); // 포병은 입성 불가
    const settler = unit({ kind: 'settler' });
    const s = unitTargets(settler, walled, [settler]);
    expect(s.moves.has(key(3, 2)) || s.attacks.has(key(3, 2))).toBe(false);
  });

  it('이동력 1이면 주변 8칸, 산·아군 칸 제외, 적 칸은 공격', () => {
    const tiles = indexTiles(grid(5, 5, { [key(1, 1)]: { terrain: 'mountain' } }));
    const u = unit({});
    const units = [u, unit({ id: 'f', x: 3, y: 3 }), unit({ id: 'e', owner_id: ENEMY, x: 2, y: 3 })];
    const { moves, attacks } = unitTargets(u, tiles, units);
    expect(moves.has(key(1, 1))).toBe(false);
    expect(moves.has(key(3, 3))).toBe(false);
    expect(attacks).toEqual(new Set([key(2, 3)]));
    expect(moves.size).toBe(5);
  });
  it('포병은 이동력 1이어도 사거리 2 안의 적을 공격할 수 있다', () => {
    const tiles = indexTiles(grid(6, 6));
    const u = unit({ kind: 'artillery' });
    const { moves, attacks } = unitTargets(u, tiles, [u, unit({ id: 'e', owner_id: ENEMY, x: 4, y: 2 })]);
    expect(attacks.has(key(4, 2))).toBe(true);
    expect(moves.has(key(4, 3))).toBe(false); // 이동은 1칸까지만
  });
  it('개척자는 공격할 수 없다', () => {
    const tiles = indexTiles(grid(5, 5));
    const u = unit({ kind: 'settler', moves_left: 2 });
    expect(unitTargets(u, tiles, [u, unit({ id: 'e', owner_id: ENEMY, x: 3, y: 2 })]).attacks.size).toBe(0);
  });
  it('함선은 바다와 자기 도시만 들어갈 수 있다', () => {
    const tiles = indexTiles(grid(4, 4, {
      [key(1, 0)]: { terrain: 'water' },
      [key(1, 1)]: { is_city: true, owner_id: ME },
    }));
    const u = unit({ kind: 'ironclad', x: 0, y: 0, moves_left: 1 });
    expect(unitTargets(u, tiles, [u]).moves).toEqual(new Set([key(1, 0), key(1, 1)]));
  });
});

describe('canFoundCity', () => {
  it('다른 도시에서 2칸 이내면 불가, 3칸이면 가능', () => {
    const tiles = indexTiles(grid(8, 8, { [key(0, 0)]: { is_city: true, owner_id: ME } }));
    expect(canFoundCity(unit({ kind: 'settler', x: 2, y: 2 }), tiles)).toBe(false);
    expect(canFoundCity(unit({ kind: 'settler', x: 3, y: 1 }), tiles)).toBe(true);
  });
  it('남의 영토에서는 불가', () => {
    const tiles = indexTiles(grid(5, 5, { [key(2, 2)]: { owner_id: ENEMY } }));
    expect(canFoundCity(unit({ kind: 'settler' }), tiles)).toBe(false);
  });
});

describe('producibleUnits', () => {
  it('진영 전용·기술 요구·영웅 중복을 거른다', () => {
    const fr = producibleUnits(player({ faction: 'france' }), [unit({ kind: 'hero_napoleon' })]);
    expect(fr).toContain('militia');
    expect(fr).not.toContain('hero_napoleon');
    expect(fr).not.toContain('hero_robespierre'); // 계몽사상 필요
    expect(fr).not.toContain('hero_watt');
    const em = producibleUnits(player({ faction: 'empire', researched: ['steam_engine', 'electrification'] }), []);
    expect(em).toEqual(expect.arrayContaining(['machine_gunner', 'ironclad']));
    expect(em).not.toContain('militia');
  });
});

describe('buildableImprovements', () => {
  it('해안이면 항구, 증기기관+도시면 공장', () => {
    const tiles = indexTiles(grid(3, 3, {
      [key(0, 0)]: { terrain: 'water' },
      [key(1, 1)]: { owner_id: ME, is_city: true },
    }));
    const t = tiles.get(key(1, 1))!;
    expect(buildableImprovements(t, player(), tiles)).toEqual(['farm', 'port']);
    expect(buildableImprovements(t, player({ researched: ['steam_engine'] }), tiles)).toEqual([
      'farm', 'port', 'railway', 'factory',
    ]);
  });
});
