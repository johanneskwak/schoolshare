// 문명별 도시 이름 풀 · 불가사의 정의 (서버 hc_city_names / hc_wonder_defs와 같은 데이터)
import type { Faction, RoomPlayer, TechId, Tile, WonderState } from '../types/game';

export const CITY_NAMES: Record<Faction, string[]> = {
  france: ['파리', '마르세유', '리옹', '보르도', '툴루즈', '낭트', '릴', '스트라스부르'],
  britain: ['런던', '리버풀', '맨체스터', '버밍엄', '에든버러', '글래스고', '리즈', '브리스틀'],
  empire: ['베를린', '뮌헨', '함부르크', '쾰른', '프랑크푸르트', '드레스덴', '빈', '프라하'],
  usa: ['워싱턴 D.C.', '뉴욕', '보스턴', '필라델피아', '시카고', '샌프란시스코', '볼티모어', '뉴올리언스'],
};

/** 서버 hc__next_city_name과 같은 규칙: 문명 풀에서 아직 맵에 없는 첫 이름, 다 쓰면 "신도시 N" */
export function nextCityName(faction: Faction, tiles: Tile[], playerId: string): string {
  const used = new Set(tiles.filter((t) => t.is_city).map((t) => t.city_name));
  const name = CITY_NAMES[faction].find((n) => !used.has(n));
  if (name) return name;
  return `신도시 ${tiles.filter((t) => t.is_city && t.owner_id === playerId).length + 1}`;
}

export interface WonderDef {
  name: string;
  icon: string;
  faction: Faction | null;
  hammer: number;
  tech: TechId | null;
  desc: string;
}

export const WONDERS: Record<string, WonderDef> = {
  eiffel: { name: '에펠탑', icon: '🗼', faction: 'france', hammer: 110, tech: 'steam_engine', desc: '1889년 파리 만국박람회를 위해 세운 철탑. 프랑스 혁명 100주년과 산업 기술의 상징.' },
  big_ben: { name: '빅벤', icon: '🕰️', faction: 'britain', hammer: 100, tech: 'steam_engine', desc: '1859년 완공된 영국 국회의사당의 시계탑. 의회 민주주의와 대영 제국의 상징.' },
  empire_state: { name: '엠파이어 스테이트 빌딩', icon: '🏙️', faction: 'usa', hammer: 120, tech: 'electrification', desc: '1931년 뉴욕에 세워진 초고층 빌딩. 미국 산업과 전기 문명의 상징.' },
  manhattan: { name: '맨해튼 프로젝트', icon: '☢️', faction: 'usa', hammer: 150, tech: 'new_weapons', desc: '제2차 세계 대전 중 미국의 원자 폭탄 개발 계획. 과학 기술의 힘과 그 위험성을 보여 준다.' },
  crystal_palace: { name: '수정궁', icon: '🏛️', faction: null, hammer: 100, tech: 'steam_engine', desc: '1851년 런던 만국박람회장. 철과 유리로 지은 산업혁명의 전시장.' },
};

export const WONDER_DEFENSE_TURNS = 10;

export type WonderOption = { id: string; def: WonderDef; ok: boolean; reason?: string };

/** 이 도시에서 지을 수 있는 불가사의 목록 (서버 hc_build_wonder 검사와 같은 순서) */
export function wonderOptions(me: RoomPlayer, city: Tile, built: WonderState[]): WonderOption[] {
  return Object.entries(WONDERS)
    .filter(([, d]) => d.faction === null || d.faction === me.faction)
    .map(([id, def]) => {
      if (built.some((w) => w.wonder_id === id)) return { id, def, ok: false, reason: '이미 다른 곳에 건설됨' };
      if (def.tech && !me.researched.includes(def.tech)) return { id, def, ok: false, reason: '필요 기술 미연구' };
      if (built.some((w) => w.x === city.x && w.y === city.y)) return { id, def, ok: false, reason: '이 도시엔 이미 불가사의가 있음' };
      if (me.hammer < def.hammer) return { id, def, ok: false, reason: `망치 부족 (${me.hammer}/${def.hammer})` };
      return { id, def, ok: true };
    });
}
