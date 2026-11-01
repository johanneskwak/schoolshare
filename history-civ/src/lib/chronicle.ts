// 1750년 연대기: 연도 · 위인 등장표 · 사건 체인 · 위인 건물 (서버 hc__year / hc_scholar_defs / hc_event_defs / hc_building_defs와 같은 데이터)
import type { BuildingId, ConditionId, Difficulty, Faction, PersonCategory, RoomPlayer } from '../types/game';

export const START_YEAR = 1750;
export const YEARS_PER_TURN = 5;

/** 서버 hc__year와 같은 규칙: 1턴 = 1750년, 턴마다 5년 */
export function yearOf(turn: number): number {
  return START_YEAR + YEARS_PER_TURN * (Math.max(turn, 1) - 1);
}

/** 연도가 처음 도달하는 턴 */
export function turnOfYear(year: number): number {
  return Math.max(1, Math.ceil((year - START_YEAR) / YEARS_PER_TURN) + 1);
}

export interface PersonDef {
  id: string;
  name: string;
  year: number;
  ord: number;
  category: PersonCategory;
  /** null = 모든 문명 */
  factions: Faction[] | null;
  building?: BuildingId;
}

export const PERSONS: PersonDef[] = [
  { id: 'bill_of_rights', name: '권리 장전 (명예혁명의 유산)', year: 1750, ord: 1, category: 'statesman', factions: ['britain'] },
  { id: 'washington', name: '조지 워싱턴', year: 1776, ord: 9, category: 'statesman', factions: ['usa'] },
  { id: 'watt', name: '제임스 와트', year: 1765, ord: 10, category: 'scientist', factions: ['britain'], building: 'library' },
  { id: 'jefferson', name: '토머스 제퍼슨', year: 1776, ord: 11, category: 'thinker', factions: ['usa'] },
  { id: 'adam_smith', name: '애덤 스미스', year: 1776, ord: 12, category: 'economist', factions: ['britain'], building: 'central_bank' },
  { id: 'voltaire', name: '볼테르', year: 1780, ord: 13, category: 'thinker', factions: ['france'] },
  { id: 'kant', name: '임마누엘 칸트', year: 1784, ord: 14, category: 'thinker', factions: ['empire'] },
  { id: 'rousseau', name: '장 자크 루소', year: 1785, ord: 15, category: 'thinker', factions: ['france'] },
  { id: 'goethe', name: '괴테', year: 1795, ord: 16, category: 'artist', factions: ['empire'] },
  { id: 'napoleon', name: '나폴레옹', year: 1799, ord: 17, category: 'statesman', factions: ['france'] },
  { id: 'beethoven', name: '베토벤', year: 1805, ord: 18, category: 'artist', factions: ['empire'], building: 'concert_hall' },
  { id: 'hugo', name: '빅토르 위고', year: 1830, ord: 19, category: 'artist', factions: ['france'], building: 'national_theatre' },
  { id: 'dickens', name: '찰스 디킨스', year: 1840, ord: 20, category: 'artist', factions: ['britain'] },
  { id: 'marx', name: '카를 마르크스', year: 1848, ord: 21, category: 'thinker', factions: ['empire'] },
  { id: 'darwin', name: '찰스 다윈', year: 1859, ord: 22, category: 'scientist', factions: ['britain'], building: 'natural_history_museum' },
  { id: 'lincoln_scholar', name: '에이브러햄 링컨', year: 1861, ord: 23, category: 'statesman', factions: ['usa'] },
  { id: 'pasteur', name: '루이 파스퇴르', year: 1865, ord: 24, category: 'scientist', factions: ['france'], building: 'medical_institute' },
  { id: 'bismarck', name: '비스마르크', year: 1871, ord: 25, category: 'statesman', factions: ['empire'] },
  { id: 'curie', name: '마리 퀴리', year: 1903, ord: 26, category: 'scientist', factions: ['france'], building: 'radium_institute' },
  { id: 'einstein', name: '아인슈타인', year: 1930, ord: 27, category: 'scientist', factions: ['empire', 'usa'], building: 'institute_advanced_study' },
  { id: 'fdr', name: '루스벨트', year: 1933, ord: 28, category: 'statesman', factions: ['usa'] },
  { id: 'keynes', name: '케인스', year: 1936, ord: 29, category: 'economist', factions: ['britain'] },
  { id: 'chaplin', name: '찰리 채플린', year: 1936, ord: 30, category: 'artist', factions: ['britain', 'usa'], building: 'cinema' },
  { id: 'picasso', name: '피카소', year: 1937, ord: 31, category: 'artist', factions: ['france'] },
  { id: 'churchill', name: '처칠', year: 1940, ord: 32, category: 'statesman', factions: ['britain'] },
  { id: 'hayek', name: '하이에크', year: 1944, ord: 33, category: 'economist', factions: ['empire', 'britain'], building: 'private_investment' },
  { id: 'turing', name: '튜링 · 폰 노이만', year: 1950, ord: 34, category: 'scientist', factions: null, building: 'data_lab' },
  { id: 'beatles', name: '비틀즈', year: 1964, ord: 35, category: 'artist', factions: ['britain'], building: 'stadium' },
  { id: 'volcker', name: '폴 볼커', year: 1979, ord: 36, category: 'economist', factions: ['usa'], building: 'federal_reserve' },
  { id: 'greenspan', name: '앨런 그린스펀', year: 1990, ord: 37, category: 'economist', factions: ['usa'], building: 'stock_exchange' },
  { id: 'bernanke', name: '벤 버냉키', year: 2008, ord: 38, category: 'economist', factions: ['usa'] },
];

export const CATEGORY_NAMES: Record<PersonCategory, string> = {
  thinker: '사상가·작가',
  scientist: '과학자·발명가',
  statesman: '정치가·군인',
  economist: '경제학자',
  artist: '예술가',
};

/** 서버 hc__check_persons와 같은 규칙: 연도가 된 미등장 위인을 연도·순번 순으로, 한 턴 최대 2명 */
export function personsDue(faction: Faction, year: number, joined: ReadonlySet<string>, max = 2): PersonDef[] {
  return PERSONS.filter((p) => p.year <= year && (!p.factions || p.factions.includes(faction)) && !joined.has(p.id))
    .sort((a, b) => a.year - b.year || a.ord - b.ord)
    .slice(0, max);
}

export interface ChronicleEvent {
  id: string;
  title: string;
  year: number;
  sort: number;
  factions: Faction[] | null;
}

export const EVENTS: ChronicleEvent[] = [
  { id: 'industrial_revolution', title: '1차 산업혁명', year: 1760, sort: 10, factions: null },
  { id: 'boston_tea_britain', title: '보스턴 차 사건 (영국: 봉쇄 vs 유화책)', year: 1773, sort: 15, factions: ['britain'] },
  { id: 'boston_tea_usa', title: '보스턴 차 사건 (미국: 차 투척 vs 불매 운동)', year: 1773, sort: 16, factions: ['usa'] },
  { id: 'independence', title: '미국 독립 혁명', year: 1776, sort: 20, factions: null },
  { id: 'french_revolution', title: '프랑스 혁명', year: 1789, sort: 30, factions: null },
  { id: 'hidalgo', title: '독립운동 후원: 이달고 신부', year: 1810, sort: 35, factions: null },
  { id: 'luddite', title: '러다이트 운동', year: 1811, sort: 40, factions: null },
  { id: 'bolivar', title: '독립운동 후원: 볼리바르 & 산마르틴', year: 1815, sort: 38, factions: null },
  { id: 'cholera', title: '콜레라 유행', year: 1832, sort: 50, factions: null },
  { id: 'great_exhibition', title: '만국 박람회 (수정궁)', year: 1851, sort: 60, factions: null },
  { id: 'garibaldi', title: '독립운동 후원: 가리발디', year: 1860, sort: 65, factions: null },
  { id: 'civil_war', title: '미국 남북전쟁', year: 1861, sort: 70, factions: ['usa'] },
  { id: 'second_industrial', title: '2차 산업혁명', year: 1870, sort: 80, factions: null },
  { id: 'fashoda', title: '파쇼다 사건', year: 1898, sort: 85, factions: ['britain', 'france'] },
  { id: 'spanish_flu', title: '스페인 독감', year: 1918, sort: 88, factions: null },
  { id: 'great_depression', title: '세계 대공황', year: 1929, sort: 90, factions: null },
  { id: 'space_race', title: '아폴로 11호', year: 1969, sort: 100, factions: null },
  { id: 'oil_shock', title: '오일쇼크', year: 1973, sort: 110, factions: null },
  { id: 'subprime', title: '서브프라임 사태', year: 2008, sort: 120, factions: null },
  { id: 'ai_era', title: 'AI 시대', year: 2016, sort: 130, factions: null },
];

/** 서버 hc__trigger_events와 같은 규칙: 연도가 된 미발생 사건 중 가장 이른 하나 (연대기 순서 강제) */
export function nextEvent(faction: Faction, year: number, seen: ReadonlySet<string>): ChronicleEvent | null {
  return (
    EVENTS.filter((e) => e.year <= year && (!e.factions || e.factions.includes(faction)) && !seen.has(e.id))
      .sort((a, b) => a.year - b.year || a.sort - b.sort)[0] ?? null
  );
}

export interface BuildingDef {
  name: string;
  icon: string;
  cost: number;
  /** 기술 또는 위인 중 하나만 있으면 해금 */
  tech?: 'enlightenment';
  person: string;
  desc: string;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  library: { name: '도서관', icon: '📚', cost: 35, tech: 'enlightenment', person: 'watt', desc: '혁신 +3/턴 (계몽사상 또는 제임스 와트)' },
  central_bank: { name: '중앙은행', icon: '🏦', cost: 50, person: 'adam_smith', desc: '골드 +15%' },
  concert_hall: { name: '콘서트홀', icon: '🎼', cost: 40, person: 'beethoven', desc: '안정도 +2, 이념 +1' },
  national_theatre: { name: '국립극장', icon: '🎭', cost: 40, person: 'hugo', desc: '안정도 +2, 이념 +2' },
  natural_history_museum: { name: '자연사박물관', icon: '🦕', cost: 50, person: 'darwin', desc: '혁신 +4/턴' },
  medical_institute: { name: '의학연구소', icon: '⚕️', cost: 50, person: 'pasteur', desc: '식량 +3/턴' },
  radium_institute: { name: '라듐연구소', icon: '☢️', cost: 60, person: 'curie', desc: '혁신 +5/턴' },
  institute_advanced_study: { name: '고등학술원', icon: '🎓', cost: 60, person: 'einstein', desc: '혁신 +6/턴' },
  cinema: { name: '영화관', icon: '🎬', cost: 40, person: 'chaplin', desc: '안정도 +3' },
  private_investment: { name: '민간투자사', icon: '💼', cost: 50, person: 'hayek', desc: '골드 +5/턴' },
  data_lab: { name: '데이터연구소', icon: '💾', cost: 70, person: 'turing', desc: '혁신 +8/턴' },
  stadium: { name: '대형스타디움', icon: '🏟️', cost: 60, person: 'beatles', desc: '골드 +4, 안정도 +2' },
  federal_reserve: { name: '연방준비은행', icon: '🏛️', cost: 70, person: 'volcker', desc: '골드 +15%' },
  stock_exchange: { name: '증권거래소', icon: '📈', cost: 70, person: 'greenspan', desc: '골드 +8/턴' },
};

/** 서버 hc_build_building과 같은 해금 규칙 */
export function buildingUnlocked(id: BuildingId, me: Pick<RoomPlayer, 'researched'>, myPersons: ReadonlySet<string>): boolean {
  const b = BUILDINGS[id];
  return (!!b.tech && me.researched.includes(b.tech)) || myPersons.has(b.person);
}

export const CONDITIONS: Record<ConditionId, { name: string; icon: string; desc: string; good?: boolean }> = {
  depression: { name: '대공황', icon: '📉', desc: '생산 -50% (루스벨트·케인스가 있으면 무효, 채플린은 절반)' },
  oil_shock: { name: '오일쇼크', icon: '🛢️', desc: '골드 수입 -30% (볼커가 있으면 무효)' },
  cholera: { name: '콜레라', icon: '🦠', desc: '식량 -50% (파스퇴르 면역, 디킨스는 절반)' },
  subprime: { name: '금융 위기', icon: '🏚️', desc: '골드 수입 -50% (버냉키가 있으면 무효)' },
  unrest: { name: '반란', icon: '🔥', desc: '안정도 -3·망치 -2/턴 (볼테르·루소·위고가 진정)' },
  morale: { name: '군 사기', icon: '🎺', desc: '모든 공격 +1', good: true },
  embargo: { name: '무역 제재', icon: '⛔', desc: '골드 수입 -30%' },
  stagnation: { name: '혁명 정체', icon: '🐌', desc: '연구 -50%' },
  pandemic: { name: '대유행', icon: '😷', desc: '식량 -50% (파스퇴르 면역)' },
  latin_market: { name: '라틴 아메리카 시장', icon: '🌎', desc: '골드 +5/턴', good: true },
  raw_materials: { name: '원자재 독점권', icon: '🪵', desc: '생산 +10%', good: true },
};

export const DIFFICULTIES: Record<Difficulty, { name: string; desc: string }> = {
  easy: { name: '쉬움', desc: '내 골드·망치 +3/턴, AI 연구 느림, AI 공격은 12턴부터' },
  normal: { name: '보통', desc: '표준 규칙' },
  hard: { name: '어려움', desc: 'AI 생산·연구 +25%, 3턴부터 공격적인 공성' },
};
