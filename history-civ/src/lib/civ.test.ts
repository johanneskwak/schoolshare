import { describe, expect, it } from 'vitest';
import { nextCityName, wonderOptions } from './civ';
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
  it('조건: 기술 · 중복 · 망치', () => {
    const opts = Object.fromEntries(wonderOptions(me({ hammer: 110 }), nyc, []).map((o) => [o.id, o]));
    expect(opts.empire_state).toMatchObject({ ok: false, reason: '망치 부족 (110/120)' });
    expect(opts.manhattan).toMatchObject({ ok: false, reason: '필요 기술 미연구' });
    expect(opts.crystal_palace!.ok).toBe(true);
    const built: WonderState[] = [{ wonder_id: 'crystal_palace', player_id: 'foe', x: 9, y: 9, built_turn: 3, turns_left: 7, name_ko: '수정궁', icon: '' }];
    expect(wonderOptions(me(), nyc, built).find((o) => o.id === 'crystal_palace')).toMatchObject({ ok: false, reason: '이미 다른 곳에 건설됨' });
  });
});
