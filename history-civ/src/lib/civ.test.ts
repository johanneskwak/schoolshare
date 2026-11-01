import { describe, expect, it } from 'vitest';
import { cycleCity, nextCityName, turnsLeft, wonderOptions, wonderRate, WONDERS } from './civ';
import { unitCost } from './leaders';
import type { RoomPlayer, Tile, WonderState } from '../types/game';

const city = (x: number, name: string, owner = 'me'): Tile => ({
  x, y: 0, terrain: 'plains', owner_id: owner, is_city: true, is_capital: false, city_name: name, city_pop: 1, improvement: null, city_hp: 100,
});
const me = (o: Partial<RoomPlayer> = {}): RoomPlayer => ({
  room_id: 'r', user_id: 'me', nickname: '', seat: 0, faction: 'usa', is_ready: true, has_ended_turn: false, is_eliminated: false,
  is_ai: false, stability: 60, gold: 0, food: 0, hammer: 200, innovation: 0, ideology: 0, research_target: null, research_progress: 0,
  researched: ['steam_engine', 'electrification'], score: 0, joined_at: '', ...o,
});

describe('문명별 도시 이름 풀', () => {
  it('미국: 워싱턴 D.C. → 뉴욕 → 보스턴 순서, 이미 있는 이름은 건너뜀', () => {
    expect(nextCityName('usa', [], 'me')).toBe('워싱턴 D.C.');
    expect(nextCityName('usa', [city(0, '워싱턴 D.C.')], 'me')).toBe('뉴욕');
    expect(nextCityName('usa', [city(0, '워싱턴 D.C.'), city(1, '뉴욕', 'foe')], 'me')).toBe('보스턴');
  });
  it('영국·프랑스는 자기 풀을 쓴다', () => {
    expect(nextCityName('britain', [city(0, '런던')], 'me')).toBe('리버풀');
    expect(nextCityName('france', [city(0, '파리')], 'me')).toBe('마르세유');
  });
  it('풀을 다 쓰면 "신도시 N"', () => {
    const all = ['파리', '마르세유', '리옹', '보르도', '툴루즈', '낭트', '릴', '스트라스부르'].map((n, i) => city(i, n));
    expect(nextCityName('france', all, 'me')).toBe('신도시 9');
  });
  it('미국 개척 정신: 개척자 20', () => {
    expect(unitCost('settler', [], 'usa')).toBe(20);
    expect(unitCost('settler', [], 'france')).toBe(30);
  });
});

describe('불가사의', () => {
  const nyc = city(3, '뉴욕');
  it('미국은 엠파이어 스테이트·맨해튼·수정궁만 보이고 에펠탑은 안 보인다', () => {
    const ids = wonderOptions(me(), nyc, []).map((o) => o.id);
    expect(ids).toEqual(['empire_state', 'manhattan', 'crystal_palace']);
  });
  it('조건: 기술 · 중복 · 공사 중 (망치는 매 턴 투입되므로 시작 조건이 아님)', () => {
    const opts = Object.fromEntries(wonderOptions(me({ hammer: 0 }), nyc, []).map((o) => [o.id, o]));
    expect(opts.empire_state!.ok).toBe(true);
    const proj = [{ wonder_id: 'empire_state', player_id: 'me', x: nyc.x, y: nyc.y, progress: 30, cost: 240, rate: 16, started_turn: 1, name_ko: '', icon: '' }];
    expect(wonderOptions(me(), nyc, [], proj).find((o) => o.id === 'crystal_palace')).toMatchObject({ ok: false, reason: '이 도시는 이미 불가사의를 짓는 중' });
    expect(opts.manhattan).toMatchObject({ ok: false, reason: '필요 기술 미연구' });
    expect(opts.crystal_palace!.ok).toBe(true);
    const built: WonderState[] = [{ wonder_id: 'crystal_palace', player_id: 'foe', x: 9, y: 9, built_turn: 3, turns_left: 7, name_ko: '수정궁', icon: '' }];
    expect(wonderOptions(me(), nyc, built).find((o) => o.id === 'crystal_palace')).toMatchObject({ ok: false, reason: '이미 다른 곳에 건설됨' });
  });
});

describe('도시 < > 전환', () => {
  const t = (x: number, y: number, capital = false, owner = 'me') =>
    ({ x, y, terrain: 'plains', owner_id: owner, is_city: true, is_capital: capital, city_name: `${x},${y}`, city_pop: 1, improvement: null, city_hp: 100 }) as const;
  const tiles = [t(5, 5), t(2, 2, true), t(8, 1), t(3, 3, false, 'enemy')];
  it('수도부터 시작해 내 도시만 순환하고 끝에서 처음으로 돌아간다', () => {
    expect(cycleCity(tiles, 'me', null, 1)).toMatchObject({ x: 2, y: 2 });
    expect(cycleCity(tiles, 'me', { x: 2, y: 2 }, 1)).toMatchObject({ x: 8, y: 1 });
    expect(cycleCity(tiles, 'me', { x: 8, y: 1 }, 1)).toMatchObject({ x: 5, y: 5 });
    expect(cycleCity(tiles, 'me', { x: 5, y: 5 }, 1)).toMatchObject({ x: 2, y: 2 });
    expect(cycleCity(tiles, 'me', { x: 2, y: 2 }, -1)).toMatchObject({ x: 5, y: 5 });
    expect(cycleCity(tiles, 'nobody', null, 1)).toBeNull();
  });
});

describe('불가사의 건설 기간', () => {
  it('중반 도시 1곳 생산(문명 64/턴 · 도시 4곳)이면 약 15턴', () => {
    const rate = wonderRate({ hammer_rate: 64 }, 4, 'big_ben');
    expect(rate).toBe(16);
    expect(turnsLeft({ progress: 0, cost: WONDERS.big_ben!.hammer, rate })).toBe(15);
    expect(turnsLeft({ progress: 0, cost: WONDERS.manhattan!.hammer, rate: wonderRate({ hammer_rate: 80 }, 4, 'manhattan') })).toBe(15);
  });
  it('아인슈타인은 맨해튼 프로젝트를 2배 빠르게', () => {
    expect(wonderRate({ hammer_rate: 80 }, 4, 'manhattan', true)).toBe(40);
    expect(wonderRate({ hammer_rate: 0 }, 1, 'eiffel')).toBe(3);
  });
});
