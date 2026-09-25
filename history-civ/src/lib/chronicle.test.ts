import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingUnlocked, EVENTS, nextEvent, PERSONS, personsDue, turnOfYear, yearOf } from './chronicle';
import type { BuildingId, Faction } from '../types/game';

/** 1턴부터 60턴까지 서버 규칙대로 돌려 등장 순서를 얻는다 */
function simulate(faction: Faction) {
  const joined = new Set<string>();
  const seen = new Set<string>();
  const persons: { id: string; turn: number }[] = [];
  const events: { id: string; turn: number }[] = [];
  for (let turn = 1; turn <= 60; turn++) {
    const year = yearOf(turn);
    for (const p of personsDue(faction, year, joined)) {
      joined.add(p.id);
      persons.push({ id: p.id, turn });
    }
    const e = nextEvent(faction, year, seen);
    if (e) {
      seen.add(e.id);
      events.push({ id: e.id, turn });
    }
  }
  return { persons, events };
}

describe('연도', () => {
  it('1750년에 시작해 턴마다 5년씩 흐른다', () => {
    expect(yearOf(1)).toBe(1750);
    expect(yearOf(2)).toBe(1755);
    expect(yearOf(60)).toBe(2045);
    expect(turnOfYear(1789)).toBe(9); // 9턴 = 1790년
    expect(yearOf(turnOfYear(1789))).toBeGreaterThanOrEqual(1789);
  });
});

describe('위인 연대기', () => {
  it('영국: 와트(1765) → 스미스 → 디킨스 → 다윈 → … 연도 순서대로 등장', () => {
    const { persons } = simulate('britain');
    const ids = persons.map((p) => p.id);
    expect(ids.slice(0, 5)).toEqual(['bill_of_rights', 'watt', 'adam_smith', 'dickens', 'darwin']);
    expect(ids).toContain('beatles');
    const years = ids.map((id) => PERSONS.find((p) => p.id === id)!.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('위인은 그 연도가 되기 전에는 등장하지 않는다', () => {
    for (const f of ['france', 'britain', 'empire', 'usa'] as Faction[]) {
      for (const p of simulate(f).persons) {
        expect(yearOf(p.turn)).toBeGreaterThanOrEqual(PERSONS.find((x) => x.id === p.id)!.year);
      }
    }
  });

  it('한 턴에 최대 2명, 다른 문명 위인은 오지 않는다', () => {
    const { persons } = simulate('usa');
    const perTurn = new Map<number, number>();
    persons.forEach((p) => perTurn.set(p.turn, (perTurn.get(p.turn) ?? 0) + 1));
    expect(Math.max(...perTurn.values())).toBeLessThanOrEqual(2);
    expect(persons.map((p) => p.id)).not.toContain('napoleon');
    expect(persons.map((p) => p.id)).toEqual(
      expect.arrayContaining(['jefferson', 'lincoln_scholar', 'fdr', 'turing', 'volcker', 'greenspan', 'bernanke']),
    );
  });
});

describe('사건 체인', () => {
  it('연대기 순서가 강제된다: 산업혁명 → 미국 독립 → 프랑스 혁명 → … → AI 시대', () => {
    const { events } = simulate('france');
    expect(events.map((e) => e.id)).toEqual(EVENTS.filter((e) => !e.factions || e.factions.includes('france')).map((e) => e.id));
    const turns = events.map((e) => e.turn);
    expect(new Set(turns).size).toBe(turns.length); // 한 턴에 하나
  });

  it('남북전쟁은 미국에만, 링컨 등장 무렵에 일어난다', () => {
    const { events } = simulate('usa');
    const cw = events.find((e) => e.id === 'civil_war')!;
    expect(yearOf(cw.turn)).toBeGreaterThanOrEqual(1861);
    expect(simulate('britain').events.map((e) => e.id)).not.toContain('civil_war');
  });
});

describe('위인 건물', () => {
  it('도서관은 계몽사상 또는 와트로 해금', () => {
    expect(buildingUnlocked('library', { researched: [] }, new Set())).toBe(false);
    expect(buildingUnlocked('library', { researched: ['enlightenment'] }, new Set())).toBe(true);
    expect(buildingUnlocked('library', { researched: [] }, new Set(['watt']))).toBe(true);
  });

  it('모든 위인 건물은 그 건물을 여는 위인과 연결되어 있다', () => {
    for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
      const person = PERSONS.find((p) => p.id === BUILDINGS[id].person);
      expect(person?.building, id).toBe(id);
      expect(buildingUnlocked(id, { researched: [] }, new Set([person!.id]))).toBe(true);
    }
  });
});

describe('명예혁명 · 보스턴 차 사건 · 독립운동 후원', () => {
  it('영국은 1750년 시작과 동시에 권리 장전을 받는다', () => {
    expect(personsDue('britain', yearOf(1), new Set()).map((p) => p.id)).toEqual(['bill_of_rights']);
    expect(personsDue('france', yearOf(1), new Set())).toEqual([]);
  });

  it('보스턴 차 사건은 1770년대(1773~1779년, 5년/턴 기준 6~7턴)에 영국·미국에만, 산업혁명 뒤·독립 혁명 앞에 일어난다', () => {
    for (const f of ['britain', 'usa'] as Faction[]) {
      const ids = simulate(f).events.map((e) => e.id);
      const boston = simulate(f).events.find((e) => e.id.startsWith('boston_tea'))!;
      expect(boston.id).toBe(`boston_tea_${f}`);
      expect(yearOf(boston.turn)).toBeGreaterThanOrEqual(1773);
      expect(yearOf(boston.turn)).toBeLessThanOrEqual(1779);
      expect(ids.indexOf(boston.id)).toBeGreaterThan(ids.indexOf('industrial_revolution'));
      expect(ids.indexOf(boston.id)).toBeLessThan(ids.indexOf('independence'));
    }
    expect(simulate('france').events.some((e) => e.id.startsWith('boston_tea'))).toBe(false);
  });

  it('후원 사건은 이달고 → 볼리바르 → 가리발디 순, 파쇼다는 영국·프랑스에만', () => {
    const ids = simulate('empire').events.map((e) => e.id);
    expect(ids.indexOf('hidalgo')).toBeLessThan(ids.indexOf('bolivar'));
    expect(ids.indexOf('bolivar')).toBeLessThan(ids.indexOf('garibaldi'));
    expect(ids).not.toContain('fashoda');
    expect(simulate('france').events.map((e) => e.id)).toContain('fashoda');
  });
});
