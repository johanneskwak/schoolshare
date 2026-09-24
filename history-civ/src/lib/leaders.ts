// LeaderSystem 클라이언트 정의 — 서버 hc_leader_defs / hc__leader_passives / hc__unit_cost와 같은 규칙
import type { LeaderHolder, LeaderId, UnitKind } from '../types/game';
import { UNIT_TYPES } from './rules';

export interface LeaderDef {
  name: string;
  era: string;
  icon: string;
  /** 초상화 스프라이트 (없으면 icon 사용) */
  portrait?: string;
  effect: string;
  condition: string;
}

export const LEADERS: Record<LeaderId, LeaderDef> = {
  napoleon: {
    name: '나폴레옹 보나파르트', era: '프랑스 혁명', icon: '👑', portrait: '/sprites/unit_hero_napoleon.png',
    effect: '군사 유닛 이동력 +1, 공격력 +2', condition: '계몽사상 연구 (프랑스는 5턴부터)',
  },
  watt: {
    name: '제임스 와트', era: '산업혁명', icon: '⚙️', portrait: '/sprites/unit_hero_watt.png',
    effect: '도시마다 망치 +3, 과학 기술 연구 +4/턴', condition: '증기기관 연구',
  },
  lincoln: {
    name: '에이브러햄 링컨', era: '시민 혁명', icon: '🎩',
    effect: '안정도 +5 · 이념 +2/턴, 시민군 징집 가능 (비용 50%)', condition: '혁명 이념 60 이상',
  },
  bismarck: {
    name: '오토 폰 비스마르크', era: '제국주의', icon: '🪖',
    effect: '골드 +3/턴(외교), 군사 유닛 생산 비용 -25%', condition: '8턴 이후 도시 3개 이상',
  },
};

export const LEADER_ORDER: LeaderId[] = ['napoleon', 'watt', 'lincoln', 'bismarck'];

export function leadersOf(holders: LeaderHolder[], playerId: string): LeaderId[] {
  return holders.filter((h) => h.player_id === playerId).map((h) => h.leader_id);
}

/** 인물 효과를 반영한 생산 비용 (서버 hc__unit_cost와 동일) */
export function unitCost(kind: UnitKind, leaders: LeaderId[]): number {
  const base = UNIT_TYPES[kind].cost;
  if (kind === 'militia' && leaders.includes('lincoln')) return Math.floor(base / 2);
  if (leaders.includes('bismarck') && UNIT_TYPES[kind].attack > 0) return Math.floor((base * 3) / 4);
  return base;
}
