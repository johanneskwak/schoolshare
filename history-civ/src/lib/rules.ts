// 서버 hc__resolve_turn 규칙의 클라이언트 미러. 미리보기용이며 최종 판정은 서버가 한다.
import type { Faction, Improvement, LeaderId, RoomPlayer, TechId, Terrain, Tile, Unit, UnitKind } from '../types/game';

export interface UnitType {
  name: string;
  icon: string;
  attack: number;
  defense: number;
  moves: number;
  initiative: number;
  range: number;
  cost: number;
  naval: boolean;
  hero: boolean;
  faction: Faction | null;
  requires: TechId | null;
}

// supabase/migrations/20260923000000_hc_init.sql 의 hc_unit_types 시드와 동일하게 유지
export const UNIT_TYPES: Record<UnitKind, UnitType> = {
  settler:          { name: '개척자',       icon: '⛺', attack: 0, defense: 1, moves: 2, initiative: 1, range: 1, cost: 30, naval: false, hero: false, faction: null,      requires: null },
  militia:          { name: '시민군',       icon: '🔱', attack: 3, defense: 3, moves: 2, initiative: 4, range: 1, cost: 10, naval: false, hero: false, faction: 'france',  requires: null },
  line_infantry:    { name: '전열보병',     icon: '🪖', attack: 4, defense: 4, moves: 1, initiative: 3, range: 1, cost: 20, naval: false, hero: false, faction: null,      requires: null },
  cavalry:          { name: '기병',         icon: '🐎', attack: 5, defense: 2, moves: 3, initiative: 6, range: 1, cost: 28, naval: false, hero: false, faction: null,      requires: null },
  artillery:        { name: '포병',         icon: '💣', attack: 6, defense: 1, moves: 1, initiative: 2, range: 2, cost: 35, naval: false, hero: false, faction: null,      requires: null },
  machine_gunner:   { name: '기관총병',     icon: '🔫', attack: 7, defense: 5, moves: 1, initiative: 3, range: 2, cost: 45, naval: false, hero: false, faction: 'empire',  requires: 'electrification' },
  ironclad:         { name: '철갑함',       icon: '🚢', attack: 6, defense: 5, moves: 4, initiative: 5, range: 2, cost: 50, naval: true,  hero: false, faction: null,      requires: 'steam_engine' },
  hero_napoleon:    { name: '나폴레옹',     icon: '👑', attack: 8, defense: 6, moves: 3, initiative: 8, range: 1, cost: 60, naval: false, hero: true,  faction: 'france',  requires: null },
  hero_robespierre: { name: '로베스피에르', icon: '📜', attack: 2, defense: 4, moves: 2, initiative: 5, range: 1, cost: 40, naval: false, hero: true,  faction: 'france',  requires: 'enlightenment' },
  hero_watt:        { name: '제임스 와트',  icon: '⚙️', attack: 0, defense: 3, moves: 2, initiative: 3, range: 1, cost: 40, naval: false, hero: true,  faction: 'britain', requires: null },
  // 도서관 완공 때만 등장 (생산 불가)
  scholar:          { name: '학자',         icon: '📖', attack: 0, defense: 1, moves: 1, initiative: 1, range: 1, cost: 999, naval: false, hero: true, faction: null,      requires: null },
};

export const TERRAIN: Record<Terrain, { name: string; color: string; yields: string }> = {
  plains:    { name: '평원', color: '#a3b565', yields: '식량1 망치1' },
  grassland: { name: '초원', color: '#6fa84f', yields: '식량2' },
  hills:     { name: '언덕', color: '#a08a5c', yields: '망치2 · 방어+2' },
  forest:    { name: '숲',   color: '#3f7a3a', yields: '식량1 망치1 · 방어+2' },
  mountain:  { name: '산',   color: '#7c7470', yields: '통행 불가' },
  water:     { name: '바다', color: '#3b6fa8', yields: '식량1 골드1' },
};

export const IMPROVEMENTS: Record<Improvement, { name: string; cost: number; desc: string }> = {
  farm:    { name: '농장', cost: 10, desc: '식량 +2' },
  port:    { name: '항구', cost: 15, desc: '골드 +2 (바다 인접)' },
  railway: { name: '철도', cost: 15, desc: '망치 +1 (증기기관)' },
  factory: { name: '공장', cost: 30, desc: '망치 +3 (도시, 증기기관)' },
  library: { name: '도서관', cost: 35, desc: '혁신 +2 · 지식인 합류 (도시, 계몽사상)' },
};

export const chebyshev = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export type TileIndex = Map<string, Tile>;
export const key = (x: number, y: number) => `${x},${y}`;
export const indexTiles = (tiles: Tile[]): TileIndex => new Map(tiles.map((t) => [key(t.x, t.y), t]));

function canEnter(unit: Unit, tile: Tile): boolean {
  const naval = UNIT_TYPES[unit.kind].naval;
  if (tile.terrain === 'mountain') return false;
  if (tile.terrain === 'water') return naval;
  return !naval || (tile.is_city && tile.owner_id === unit.owner_id);
}

export interface Targets {
  moves: Set<string>;
  attacks: Set<string>;
}

/** 선택한 유닛이 이번 턴에 이동/공격할 수 있는 칸 (서버 3단계 규칙과 동일). */
export function unitTargets(unit: Unit, tiles: TileIndex, units: Unit[]): Targets {
  const t = UNIT_TYPES[unit.kind];
  const occupied = new Map(units.map((u) => [key(u.x, u.y), u]));
  const reach = Math.max(unit.moves_left, t.range > 1 ? t.range : 0);
  const moves = new Set<string>();
  const attacks = new Set<string>();
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      if (dx === 0 && dy === 0) continue;
      const k = key(unit.x + dx, unit.y + dy);
      const tile = tiles.get(k);
      if (!tile) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const other = occupied.get(k);
      if (other) {
        if (other.owner_id !== unit.owner_id && t.attack > 0 && (dist <= unit.moves_left || (t.range > 1 && dist <= t.range)))
          attacks.add(k);
      } else if (tile.is_city && tile.owner_id && tile.owner_id !== unit.owner_id) {
        // 빈 적 도시: 성벽(도시 HP)이 남아 있으면 공성, 0이면 근접 유닛이 입성해 점령 (서버 hc_unit_attack / hc_unit_move)
        const inRange = dist <= unit.moves_left || (t.range > 1 && dist <= t.range);
        if ((tile.city_hp ?? 100) > 0) {
          if (t.attack > 0 && inRange) attacks.add(k);
        } else if (t.attack > 0 && t.range <= 1 && dist <= unit.moves_left && canEnter(unit, tile)) {
          moves.add(k);
        }
      } else if (dist <= unit.moves_left && canEnter(unit, tile)) {
        moves.add(k);
      }
    }
  }
  return { moves, attacks };
}

/** 개척자가 지금 위치에 도시를 세울 수 있는지 (서버 2단계 규칙). */
export function canFoundCity(unit: Unit, tiles: TileIndex): boolean {
  if (unit.kind !== 'settler') return false;
  const here = tiles.get(key(unit.x, unit.y));
  if (!here || here.terrain === 'water' || here.terrain === 'mountain') return false;
  if (here.owner_id && here.owner_id !== unit.owner_id) return false;
  for (const t of tiles.values()) if (t.is_city && chebyshev(t.x, t.y, unit.x, unit.y) <= 2) return false;
  return true;
}

/** 이 플레이어가 생산할 수 있는 유닛 (진영/기술/영웅 중복 조건). 망치 부족은 별도 표시. */
export function producibleUnits(me: RoomPlayer, myUnits: Unit[], leaders: LeaderId[] = []): UnitKind[] {
  return (Object.keys(UNIT_TYPES) as UnitKind[]).filter((k) => {
    const t = UNIT_TYPES[k];
    // 링컨: 어느 진영이든 시민군 징집 가능
    if (t.faction && t.faction !== me.faction && !(k === 'militia' && leaders.includes('lincoln'))) return false;
    if (t.requires && !me.researched.includes(t.requires)) return false;
    if (k === 'scholar') return false; // 도서관 완공으로만 등장
    if (t.hero && myUnits.some((u) => u.kind === k)) return false;
    return true;
  });
}

/** 선택한 칸에 지을 수 있는 시설 (서버 5단계 규칙). */
export function buildableImprovements(tile: Tile, me: RoomPlayer, tiles: TileIndex): Improvement[] {
  if (tile.owner_id !== me.user_id || tile.improvement || tile.terrain === 'water' || tile.terrain === 'mountain') return [];
  const steam = me.researched.includes('steam_engine');
  const coastal = [-1, 0, 1].some((dx) =>
    [-1, 0, 1].some((dy) => (dx || dy) && tiles.get(key(tile.x + dx, tile.y + dy))?.terrain === 'water'),
  );
  return (Object.keys(IMPROVEMENTS) as Improvement[]).filter((i) => {
    if (i === 'port') return coastal;
    if (i === 'railway') return steam;
    if (i === 'factory') return steam && tile.is_city;
    if (i === 'library') return false; // 도서관은 이제 도시 건물 (lib/chronicle BUILDINGS)
    return true;
  });
}
