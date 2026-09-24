import { describe, expect, it } from 'vitest';
import { canUpgrade, previewCombat, upgradeChain } from './units';
import type { RoomPlayer, Tile, Unit } from '../types/game';

const tile = (o: Partial<Tile> = {}): Tile => ({
  x: 8, y: 5, terrain: 'plains', owner_id: null, is_city: false, is_capital: false, city_name: null, city_pop: 0, improvement: null, ...o,
});
const unit = (o: Partial<Unit>): Unit => ({
  id: 'u', owner_id: 'me', kind: 'line_infantry', x: 7, y: 5, hp: 100, moves_left: 1, created_turn: 1, acted: false, fortified: false, ...o,
});
const me = (o: Partial<RoomPlayer> = {}): RoomPlayer => ({
  room_id: 'r', user_id: 'me', nickname: '', seat: 0, faction: 'france', is_ready: true, has_ended_turn: false, is_eliminated: false,
  is_ai: false, stability: 60, gold: 30, food: 0, hammer: 0, innovation: 0, ideology: 0, research_target: null, research_progress: 0,
  researched: [], score: 0, joined_at: '', ...o,
});

describe('previewCombat (서버 전투식과 동일)', () => {
  it('기병 → 포병(HP 80, 평지): 상성 +4 → 적 -62, 아군 -4 (DB 시뮬레이션 값)', () => {
    const p = previewCombat(unit({ kind: 'cavalry' }), unit({ kind: 'artillery', owner_id: 'foe', hp: 80 }), tile());
    expect(p.dmgDef).toBe(62);
    expect(p.dmgAtt).toBe(4);
    expect(p.bonusNotes).toContain('상성 +4');
  });
  it('포병은 반격을 받지 않는다', () => {
    const p = previewCombat(unit({ kind: 'artillery' }), unit({ owner_id: 'foe' }), tile());
    expect(p.dmgAtt).toBe(0);
  });
  it('요새화 + 언덕 + 도시는 방어 +7', () => {
    const plain = previewCombat(unit({}), unit({ owner_id: 'foe' }), tile());
    const fort = previewCombat(unit({}), unit({ owner_id: 'foe', fortified: true }), tile({ terrain: 'hills', is_city: true }));
    expect(fort.dmgDef).toBeLessThan(plain.dmgDef);
    expect(fort.bonusNotes).toContain('적 방어 보너스 +7');
  });
  it('나폴레옹은 공격 +2', () => {
    const base = previewCombat(unit({}), unit({ owner_id: 'foe' }), tile());
    const nap = previewCombat(unit({}), unit({ owner_id: 'foe' }), tile(), ['napoleon']);
    expect(nap.dmgDef).toBeGreaterThan(base.dmgDef);
  });
});

describe('업그레이드 경로', () => {
  it('시민군 → 전열보병 → 기관총병', () => {
    expect(upgradeChain('militia')).toEqual(['militia', 'line_infantry', 'machine_gunner']);
    expect(upgradeChain('line_infantry')).toEqual(['militia', 'line_infantry', 'machine_gunner']);
    expect(upgradeChain('cavalry')).toEqual(['cavalry']);
  });
  it('조건: 기술 · 골드 · 영토 · 행동 여부', () => {
    const own = tile({ owner_id: 'me' });
    expect(canUpgrade(unit({ kind: 'militia' }), me(), own).ok).toBe(true);
    expect(canUpgrade(unit({ kind: 'militia' }), me({ gold: 5 }), own)).toMatchObject({ ok: false, reason: '골드 부족 (5/15)' });
    expect(canUpgrade(unit({ kind: 'militia' }), me(), tile())).toMatchObject({ ok: false, reason: '우리 영토 안에서만 가능' });
    expect(canUpgrade(unit({}), me(), own)).toMatchObject({ ok: false, reason: '필요 기술 미연구' });
    expect(canUpgrade(unit({}), me({ researched: ['steam_engine', 'electrification'] }), own).ok).toBe(true);
    expect(canUpgrade(unit({ kind: 'militia', acted: true }), me(), own).ok).toBe(false);
  });
});
