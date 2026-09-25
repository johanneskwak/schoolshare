// DB 스키마(supabase/migrations/20260923000000_init.sql)와 1:1로 맞춘 타입

export type Faction = 'france' | 'britain' | 'empire' | 'usa';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type Terrain = 'plains' | 'grassland' | 'hills' | 'forest' | 'mountain' | 'water';
export type VictoryType = 'conquest' | 'science' | 'culture' | 'score' | 'wonder';
export type TechId =
  | 'enlightenment' | 'rights_declaration' | 'steam_engine' | 'electrification' | 'new_weapons'
  | 'internal_combustion' | 'computing' | 'internet' | 'ai_revolution';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Improvement = 'farm' | 'railway' | 'factory' | 'port' | 'library';
export type UnitKind =
  | 'settler' | 'militia' | 'line_infantry' | 'cavalry' | 'artillery'
  | 'machine_gunner' | 'ironclad' | 'hero_napoleon' | 'hero_robespierre' | 'hero_watt' | 'scholar';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  max_players: number;
  map_width: number;
  map_height: number;
  turn_number: number;
  /** 0 = 시간 무제한 */
  turn_seconds: number;
  turn_deadline: string | null;
  max_turns: number;
  winner_id: string | null;
  victory: VictoryType | null;
  /** AI 대전(1인 프리플레이) 방 */
  is_solo: boolean;
  /** AI 난이도 (솔로) */
  difficulty: Difficulty;
  /** 즉시 행동이 일어날 때마다 증가 → 다른 화면 새로고침 신호 */
  action_seq: number;
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
  /** 사회 안정도 0~100 (30 미만: 폭동으로 골드 손실, 70 이상: 이념 +1) */
  stability: number;
  gold: number;
  food: number;
  hammer: number;
  innovation: number;
  ideology: number;
  research_target: TechId | null;
  research_progress: number;
  researched: TechId[];
  score: number;
  /** 지난 정산의 턴당 망치 (불가사의 건설 속도 계산용) */
  hammer_rate?: number;
  /** 외교 명성 (보스턴 차 사건 유화책 · 독립운동 후원 등) */
  prestige?: number;
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
  /** 도시 성벽 HP 0~100 (0이 되어야 근접 유닛이 입성·점령) */
  city_hp: number;
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
  /** 이번 턴 행동 완료 (흑백 표시) */
  acted: boolean;
  /** 요새화: 방어 +2, 이동하면 풀림 */
  fortified: boolean;
}

export type Action =
  | { type: 'move'; unit_id: string; x: number; y: number }
  | { type: 'found_city'; unit_id: string; name?: string }
  | { type: 'produce'; x: number; y: number; unit_kind: UnitKind }
  | { type: 'build'; x: number; y: number; improvement: Improvement }
  | { type: 'research'; tech: TechId }
  | { type: 'spread' };

export type GameEvent = { type: string } & Record<string, unknown>;

export type LeaderId = 'napoleon' | 'watt' | 'lincoln' | 'bismarck';

export interface LeaderHolder {
  leader_id: LeaderId;
  player_id: string;
  joined_turn: number;
}

/** 나에게 발생해 선택을 기다리는 역사적 사건 (hc_event_defs + 발생 정보) */
export interface PendingEvent {
  pe_id: number;
  id: string;
  turn: number;
  title: string;
  era: string;
  icon: string;
  body: string;
  choice_a_label: string;
  choice_a_desc: string;
  choice_b_label: string;
  choice_b_desc: string;
}

export type PersonCategory = 'thinker' | 'scientist' | 'statesman' | 'economist' | 'artist';

/** 연대기 위인 (hc_scholar_defs + 합류 정보). year가 없으면 옛 도서관 지식인 */
export interface ScholarHolder {
  id: string;
  faction: Faction | null;
  category?: PersonCategory | null;
  year?: number | null;
  unlock_building?: BuildingId | null;
  /** 교육용 3지선다 (정답은 서버만 안다) */
  quiz?: { q: string; choices: string[] } | null;
  quiz_result?: 'correct' | 'wrong' | null;
  ord: number;
  name: string;
  era: string;
  icon: string;
  works: string;
  significance: string;
  effect: string;
  player_id: string;
  joined_turn: number;
  /** 내가 소개 팝업을 확인했는지 (다른 문명 것은 항상 true) */
  seen: boolean;
}

/** 완공된 불가사의와 방어 카운트다운 */
export interface WonderState {
  wonder_id: string;
  player_id: string;
  x: number;
  y: number;
  built_turn: number;
  turns_left: number;
  name_ko: string;
  icon: string;
}

export type BuildingId =
  | 'library' | 'central_bank' | 'concert_hall' | 'national_theatre' | 'natural_history_museum' | 'medical_institute'
  | 'radium_institute' | 'institute_advanced_study' | 'cinema' | 'private_investment' | 'data_lab' | 'stadium'
  | 'federal_reserve' | 'stock_exchange';

export interface CityBuilding {
  x: number;
  y: number;
  building_id: BuildingId;
  built_turn: number;
}

export type ConditionId =
  | 'depression' | 'oil_shock' | 'cholera' | 'subprime' | 'unrest' | 'morale'
  | 'embargo' | 'stagnation' | 'pandemic' | 'latin_market' | 'raw_materials';

export interface PlayerCondition {
  player_id: string;
  cond_id: ConditionId;
  until_turn: number;
}

/** 건설 중인 불가사의 (매 턴 도시 생산이 투입됨) */
export interface WonderProject {
  wonder_id: string;
  player_id: string;
  x: number;
  y: number;
  progress: number;
  cost: number;
  /** 이번 턴 투입될 망치 */
  rate: number;
  started_turn: number;
  name_ko: string;
  icon: string;
}

export interface GameSnapshot {
  server_now: string;
  /** 현재 연도 (1750 + 5 × (턴 − 1)) */
  year: number;
  room: Room;
  players: RoomPlayer[];
  tiles: Tile[];
  units: Unit[];
  my_actions: Action[] | null;
  last_log: GameEvent[] | null;
  leaders: LeaderHolder[];
  my_events: PendingEvent[];
  scholars: ScholarHolder[];
  wonders: WonderState[];
  wonder_projects?: WonderProject[];
  buildings: CityBuilding[];
  conditions: PlayerCondition[];
}

export const FACTIONS: Record<Faction, { name: string; color: string; desc: string }> = {
  france: { name: '혁명 프랑스', color: '#2563eb', desc: '값싼 시민군, 이념 +2, 나폴레옹·로베스피에르' },
  britain: { name: '산업화 영국', color: '#dc2626', desc: '권리 장전(안정 +2·골드 +3), 생산력 +25%, 철도 보너스, 제임스 와트' },
  empire: { name: '독일 (프로이센)', color: '#ca8a04', desc: '철혈 재정(식민 무역 골드), 기관총병 · 칸트·괴테·베토벤·비스마르크·아인슈타인' },
  usa: { name: '신생 미국', color: '#0d9488', desc: '개척 정신(개척자 20), 식량 +2 · 민주주의(이념 +1), 워싱턴·제퍼슨·링컨·엠파이어 스테이트 빌딩' },
};

export const TECHS: Record<TechId, { name: string; cost: number; prereq: TechId | null }> = {
  enlightenment: { name: '계몽사상', cost: 20, prereq: null },
  rights_declaration: { name: '인권선언', cost: 40, prereq: 'enlightenment' },
  steam_engine: { name: '증기기관', cost: 30, prereq: null },
  electrification: { name: '전기화', cost: 60, prereq: 'steam_engine' },
  new_weapons: { name: '신무기', cost: 100, prereq: 'electrification' },
  internal_combustion: { name: '내연기관', cost: 80, prereq: 'electrification' },
  computing: { name: '컴퓨터', cost: 150, prereq: 'electrification' },
  internet: { name: '인터넷', cost: 220, prereq: 'computing' },
  ai_revolution: { name: 'AI 혁명', cost: 320, prereq: 'internet' },
};

export const VICTORY_NAMES: Record<VictoryType, string> = {
  conquest: '정복 승리',
  science: '과학 승리',
  culture: '문화 승리',
  score: '점수 승리',
  wonder: '불가사의 승리',
};
