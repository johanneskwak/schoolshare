// DB 스키마(supabase/migrations/20260923000000_init.sql)와 1:1로 맞춘 타입

export type Faction = 'france' | 'britain' | 'empire';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type Terrain = 'plains' | 'grassland' | 'hills' | 'forest' | 'mountain' | 'water';
export type VictoryType = 'conquest' | 'science' | 'culture' | 'score';
export type TechId = 'enlightenment' | 'rights_declaration' | 'steam_engine' | 'electrification' | 'new_weapons';
export type Improvement = 'farm' | 'railway' | 'factory' | 'port';
export type UnitKind =
  | 'settler' | 'militia' | 'line_infantry' | 'cavalry' | 'artillery'
  | 'machine_gunner' | 'ironclad' | 'hero_napoleon' | 'hero_robespierre' | 'hero_watt';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  max_players: number;
  map_width: number;
  map_height: number;
  turn_number: number;
  turn_seconds: number;
  turn_deadline: string | null;
  max_turns: number;
  winner_id: string | null;
  victory: VictoryType | null;
  /** AI 대전(1인 프리플레이) 방 */
  is_solo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomPlayer {
  room_id: string;
  user_id: string;
  nickname: string;
  seat: number;
  faction: Faction;
  is_ready: boolean;
  has_ended_turn: boolean;
  is_eliminated: boolean;
  is_ai: boolean;
  gold: number;
  food: number;
  hammer: number;
  innovation: number;
  ideology: number;
  research_target: TechId | null;
  research_progress: number;
  researched: TechId[];
  score: number;
  joined_at: string;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  owner_id: string | null;
  is_city: boolean;
  is_capital: boolean;
  city_name: string | null;
  city_pop: number;
  improvement: Improvement | null;
}

export interface Unit {
  id: string;
  owner_id: string;
  kind: UnitKind;
  x: number;
  y: number;
  hp: number;
  moves_left: number;
  created_turn: number;
}

export type Action =
  | { type: 'move'; unit_id: string; x: number; y: number }
  | { type: 'found_city'; unit_id: string; name?: string }
  | { type: 'produce'; x: number; y: number; unit_kind: UnitKind }
  | { type: 'build'; x: number; y: number; improvement: Improvement }
  | { type: 'research'; tech: TechId }
  | { type: 'spread' };

export type GameEvent = { type: string } & Record<string, unknown>;

export interface GameSnapshot {
  server_now: string;
  room: Room;
  players: RoomPlayer[];
  tiles: Tile[];
  units: Unit[];
  my_actions: Action[] | null;
  last_log: GameEvent[] | null;
}

export const FACTIONS: Record<Faction, { name: string; color: string; desc: string }> = {
  france: { name: '혁명 프랑스', color: '#2563eb', desc: '값싼 시민군, 이념 +2, 나폴레옹·로베스피에르' },
  britain: { name: '산업화 영국', color: '#dc2626', desc: '생산력 +25%, 철도 보너스, 제임스 와트' },
  empire: { name: '제국주의 열강', color: '#ca8a04', desc: '식민 무역 골드, 기관총병' },
};

export const TECHS: Record<TechId, { name: string; cost: number; prereq: TechId | null }> = {
  enlightenment: { name: '계몽사상', cost: 20, prereq: null },
  rights_declaration: { name: '인권선언', cost: 40, prereq: 'enlightenment' },
  steam_engine: { name: '증기기관', cost: 30, prereq: null },
  electrification: { name: '전기화', cost: 60, prereq: 'steam_engine' },
  new_weapons: { name: '신무기', cost: 100, prereq: 'electrification' },
};

export const VICTORY_NAMES: Record<VictoryType, string> = {
  conquest: '정복 승리',
  science: '과학 승리',
  culture: '문화 승리',
  score: '점수 승리',
};
