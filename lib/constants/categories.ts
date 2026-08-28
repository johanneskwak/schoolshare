import type { SchoolLevel } from "@/lib/supabase/types";

/**
 * 학교급-카테고리 매핑. Postgres CHECK 제약(0002_category_check.sql)과 반드시 동기화한다.
 * 값을 바꿀 때는 이 파일과 마이그레이션을 같이 고친다.
 */
export const CATEGORIES_BY_LEVEL: Record<SchoolLevel, readonly string[]> = {
  elementary: ["수업자료", "학급자료"],
  secondary: ["국어", "수학", "사회", "영어", "역사", "과학", "기술", "미술", "음악", "체육"],
} as const;

export const SCHOOL_LEVELS: readonly SchoolLevel[] = ["elementary", "secondary"] as const;

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  elementary: "초등",
  secondary: "중등",
};

export function categoriesFor(level: SchoolLevel): readonly string[] {
  return CATEGORIES_BY_LEVEL[level];
}

export function isValidCategory(level: SchoolLevel, category: string): boolean {
  return (CATEGORIES_BY_LEVEL[level] as readonly string[]).includes(category);
}
