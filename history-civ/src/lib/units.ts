// 유닛 도감 · 업그레이드 경로 · 전투 예측 (CombatResolution 미리보기)
// 서버 hc_unit_upgrades / hc__matchup / hc_unit_attack 전투식과 같은 규칙
import { UNIT_TYPES } from './rules';
import type { LeaderId, RoomPlayer, TechId, Terrain, Tile, Unit, UnitKind } from '../types/game';

export interface UnitInfo {
  role: string;
  /** 시야(칸). 현재는 안개가 없어 표시용 */
  vision: number;
  traits: string[];
  strongVs: string[];
  weakVs: string[];
}

export const UNIT_INFO: Record<UnitKind, UnitInfo> = {
  settler: {
    role: '개척 · 비전투', vision: 1,
    traits: ['[도시 건설]로 새 도시를 세웁니다', '다른 도시와 3칸 이상 떨어진 땅이 필요해요'],
    strongVs: [], weakVs: ['모든 군사 유닛 (공격 불가, 방어 1)'],
  },
  militia: {
    role: '혁명 보병', vision: 2,
    traits: ['값싸게 많이 뽑는 시민 군대', '금 15로 전열보병으로 업그레이드'],
    strongVs: [], weakVs: ['기병 (기병 공격 +2)'],
  },
  line_infantry: {
    role: '기본 보병', vision: 2,
    traits: ['공격·방어가 고른 주력 부대', '도시·언덕·숲에서 방어하면 강함'],
    strongVs: [], weakVs: ['기병 (기병 공격 +2)'],
  },
  cavalry: {
    role: '기동 타격', vision: 3,
    traits: ['이동력 3 · 선제권 6: 가장 먼저 움직입니다', '방어가 약해 반격에 조심'],
    strongVs: ['포병 (공격 +4)', '전열보병·시민군 (공격 +2)'], weakVs: ['기관총병 (피격 +3)'],
  },
  artillery: {
    role: '원거리 포격', vision: 2,
    traits: ['사거리 2: 떨어진 적을 반격 없이 포격', '포격 후 제자리에 남습니다'],
    strongVs: ['요새·도시 수비대 (반격 없음)'], weakVs: ['기병 (피격 +4)', '근접 공격 (방어 1)'],
  },
  machine_gunner: {
    role: '제국의 기관총', vision: 2,
    traits: ['사거리 2 원거리 공격 + 높은 방어', '전기화 연구 필요'],
    strongVs: ['기병 (공격 +3)', '나폴레옹 (공격 +3)'], weakVs: ['느린 이동 (1칸)'],
  },
  ironclad: {
    role: '증기 철갑함', vision: 3,
    traits: ['바다와 우리 도시만 이동', '사거리 2로 해안의 적을 포격'],
    strongVs: ['해안 유닛'], weakVs: ['육지로 못 올라감'],
  },
  hero_napoleon: {
    role: '영웅 · 황제', vision: 3,
    traits: ['공격 8 · 선제권 8: 최강의 지휘관', '문명마다 1명'],
    strongVs: ['대부분의 유닛'], weakVs: ['기관총병 (피격 +3)'],
  },
  hero_robespierre: {
    role: '영웅 · 혁명가', vision: 2,
    traits: ['살아 있는 동안 혁명 이념 +3/턴', '전투보다 이념 전파에 쓰세요'],
    strongVs: [], weakVs: ['군사 유닛 전반'],
  },
  hero_watt: {
    role: '영웅 · 발명가', vision: 2,
    traits: ['살아 있는 동안 망치 +3 · 혁신 +3/턴', '공격 불가 — 도시 안에 두세요'],
    strongVs: [], weakVs: ['모든 군사 유닛'],
  },
};

export interface Upgrade {
  to: UnitKind;
  tech: TechId | null;
  gold: number;
}

export const UPGRADES: Partial<Record<UnitKind, Upgrade>> = {
  militia: { to: 'line_infantry', tech: null, gold: 15 },
  line_infantry: { to: 'machine_gunner', tech: 'electrification', gold: 30 },
};

/** 이 유닛이 속한 업그레이드 계보 (예: 시민군 → 전열보병 → 기관총병). 없으면 자기 자신만. */
export function upgradeChain(kind: UnitKind): UnitKind[] {
  let root = kind;
  for (;;) {
    const prev = (Object.keys(UPGRADES) as UnitKind[]).find((k) => UPGRADES[k]!.to === root);
    if (!prev) break;
    root = prev;
  }
  const chain = [root];
  while (UPGRADES[chain[chain.length - 1]!]) chain.push(UPGRADES[chain[chain.length - 1]!]!.to);
  return chain;
}

export type UpgradeCheck = { ok: true; upgrade: Upgrade } | { ok: false; reason: string; upgrade?: Upgrade };

export function canUpgrade(unit: Unit, me: RoomPlayer, tile: Tile | undefined): UpgradeCheck {
  const upgrade = UPGRADES[unit.kind];
  if (!upgrade) return { ok: false, reason: '더 이상 업그레이드할 수 없어요' };
  if (upgrade.tech && !me.researched.includes(upgrade.tech)) return { ok: false, reason: '필요 기술 미연구', upgrade };
  if (me.gold < upgrade.gold) return { ok: false, reason: `골드 부족 (${me.gold}/${upgrade.gold})`, upgrade };
  if (tile?.owner_id !== me.user_id) return { ok: false, reason: '우리 영토 안에서만 가능', upgrade };
  if (unit.acted) return { ok: false, reason: '이번 턴 행동 완료', upgrade };
  return { ok: true, upgrade };
}

// ---------- 전투 예측 ----------
export function matchup(att: UnitKind, def: UnitKind): number {
  if (att === 'cavalry' && def === 'artillery') return 4;
  if (att === 'cavalry' && (def === 'line_infantry' || def === 'militia')) return 2;
  if (att === 'machine_gunner' && (def === 'cavalry' || def === 'hero_napoleon')) return 3;
  return 0;
}

export function defenseBonus(terrain: Terrain, isCity: boolean, fortified: boolean): number {
  return (terrain === 'hills' || terrain === 'forest' ? 2 : 0) + (isCity ? 3 : 0) + (fortified ? 2 : 0);
}

export interface CombatPreview {
  dmgDef: number;
  dmgAtt: number;
  defenderDies: boolean;
  attackerDies: boolean;
  bonusNotes: string[];
}

/** 서버 hc_unit_attack 전투식과 동일 (정수 나눗셈까지 맞춤) */
export function previewCombat(att: Unit, def: Unit, defTile: Tile, attLeaders: LeaderId[] = []): CombatPreview {
  const a = UNIT_TYPES[att.kind], d = UNIT_TYPES[def.kind];
  const bonus = attLeaders.includes('napoleon') ? 2 : 0;
  const m = matchup(att.kind, def.kind);
  const db = defenseBonus(defTile.terrain, defTile.is_city, def.fortified);
  const dmgDef = Math.trunc((Math.max(10, 30 + 4 * (a.attack + bonus + m - d.defense - db)) * (50 + Math.trunc(att.hp / 2))) / 100);
  const dmgAtt = a.range > 1 ? 0 : Math.trunc((Math.max(5, 20 + 4 * (d.defense + db - a.attack)) * (50 + Math.trunc(def.hp / 2))) / 100);
  const bonusNotes = [
    ...(m ? [`상성 +${m}`] : []),
    ...(bonus ? ['나폴레옹 +2'] : []),
    ...(db ? [`적 방어 보너스 +${db}`] : []),
    ...(a.range > 1 ? ['원거리: 반격 없음'] : []),
  ];
  return { dmgDef, dmgAtt, defenderDies: dmgDef >= def.hp, attackerDies: dmgAtt >= att.hp, bonusNotes };
}
