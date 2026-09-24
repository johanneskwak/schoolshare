// 승리 조건 진행도 (서버 hc__resolve_turn 8단계 판정과 같은 기준)
import { TECHS, type RoomPlayer, type TechId } from '../types/game';

export const CULTURE_GOAL = 200;
export const SCIENCE_PATH: TechId[] = ['steam_engine', 'electrification', 'new_weapons'];

export interface VictoryProgress {
  userId: string;
  /** 0~1 */
  science: number;
  /** 0~1, 200점 이상이면서 1위여야 승리 */
  culture: number;
  cultureLeader: boolean;
}

/** 과학: 증기기관→전기화→신무기 연구 비용 합 대비 진행량 (현재 연구 중인 과학 테크 포함) */
export function scienceProgress(p: RoomPlayer): number {
  const total = SCIENCE_PATH.reduce((s, t) => s + TECHS[t].cost, 0);
  let done = SCIENCE_PATH.filter((t) => p.researched.includes(t)).reduce((s, t) => s + TECHS[t].cost, 0);
  if (p.research_target && SCIENCE_PATH.includes(p.research_target)) done += Math.min(p.research_progress, TECHS[p.research_target].cost);
  return Math.min(1, done / total);
}

export function victoryProgress(players: RoomPlayer[]): VictoryProgress[] {
  const alive = players.filter((p) => !p.is_eliminated);
  const topIdeology = Math.max(0, ...alive.map((p) => p.ideology));
  return players.map((p) => ({
    userId: p.user_id,
    science: scienceProgress(p),
    culture: Math.min(1, p.ideology / CULTURE_GOAL),
    cultureLeader: !p.is_eliminated && p.ideology > 0 && p.ideology === topIdeology,
  }));
}

/** 최종 순위: 승자 먼저, 그다음 승점 */
export function finalRanking(players: RoomPlayer[], winnerId: string | null): RoomPlayer[] {
  return [...players].sort(
    (a, b) => Number(b.user_id === winnerId) - Number(a.user_id === winnerId) || b.score - a.score,
  );
}

export const VICTORY_DESC = {
  conquest: '상대 문명의 수도를 모두 함락했습니다.',
  science: '증기기관 → 전기화 → 신무기 연구를 가장 먼저 완성했습니다.',
  culture: '혁명 이념 200점 이상으로 이념 전파 1위를 달성했습니다.',
  score: '마지막 턴까지 가장 높은 승점을 얻었습니다.',
} as const;
