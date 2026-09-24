import { describe, expect, it } from 'vitest';
import { finalRanking, scienceProgress, victoryProgress } from './victory';
import type { RoomPlayer } from '../types/game';

const p = (o: Partial<RoomPlayer>): RoomPlayer => ({
  room_id: 'r', user_id: 'a', nickname: 'a', seat: 0, faction: 'france', is_ready: true, has_ended_turn: false,
  is_eliminated: false, is_ai: false, stability: 60, gold: 0, food: 0, hammer: 0, innovation: 0, ideology: 0, research_target: null,
  research_progress: 0, researched: [], score: 0, joined_at: '', ...o,
});

describe('scienceProgress', () => {
  it('완료한 과학 테크 비용 + 진행 중인 과학 테크 진행량을 190 대비로 계산', () => {
    expect(scienceProgress(p({}))).toBe(0);
    expect(scienceProgress(p({ researched: ['steam_engine'], research_target: 'electrification', research_progress: 19 }))).toBeCloseTo(49 / 190);
    expect(scienceProgress(p({ researched: ['steam_engine', 'electrification', 'new_weapons'] }))).toBe(1);
  });
  it('문화 테크 연구는 과학 진행도에 들어가지 않는다', () => {
    expect(scienceProgress(p({ researched: ['enlightenment'], research_target: 'rights_declaration', research_progress: 30 }))).toBe(0);
  });
});

describe('victoryProgress', () => {
  it('이념 1위를 표시하고 멸망한 플레이어는 제외', () => {
    const res = victoryProgress([
      p({ user_id: 'a', ideology: 40 }),
      p({ user_id: 'b', ideology: 60 }),
      p({ user_id: 'c', ideology: 90, is_eliminated: true }),
    ]);
    expect(res.map((r) => r.cultureLeader)).toEqual([false, true, false]);
    expect(res[1]!.culture).toBeCloseTo(0.3);
  });
});

describe('finalRanking', () => {
  it('승자가 점수와 관계없이 1위', () => {
    const r = finalRanking([p({ user_id: 'a', score: 90 }), p({ user_id: 'b', score: 40 })], 'b');
    expect(r.map((x) => x.user_id)).toEqual(['b', 'a']);
  });
});
