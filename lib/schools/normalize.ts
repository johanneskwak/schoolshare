/**
 * 학교 검색어를 캐시 키로 정규화한다. (R30)
 * 앞뒤 공백 제거, 연속 공백 1칸 축약, 소문자 변환.
 */
export function normalizeSchoolQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export const SCHOOL_SEARCH_CACHE_TTL_DAYS = 90;
