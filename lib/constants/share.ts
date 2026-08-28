import type { ConditionGrade, SchoolLevel, SharePostStatus, TransactionType } from "@/lib/supabase/types";

/**
 * 나눔/대여(share_posts) 전용 상수. Postgres CHECK 제약(0010_share_rental_schema.sql)과
 * 반드시 동기화한다. 소모임(club_posts)은 계속 lib/constants/categories.ts를 쓴다.
 */

export const TRANSACTION_TYPES: readonly TransactionType[] = ["share", "rental"] as const;

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  share: "나눔",
  rental: "대여",
};

export const SHARE_CATEGORIES = ["학급경영", "수업교구", "교과자료"] as const;
export type ShareCategory = (typeof SHARE_CATEGORIES)[number];

export const GRADE_BANDS = ["1~2학년군", "3~4학년군", "5~6학년군"] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export const SUBJECTS_BY_LEVEL: Record<SchoolLevel, readonly string[]> = {
  elementary: ["국어", "수학", "사회", "과학", "영어", "도덕", "실과", "음악", "미술", "체육"],
  secondary: ["국어", "수학", "사회", "영어", "역사", "과학", "기술", "미술", "음악", "체육", "정보"],
};

/** 필터 바의 교과목 드롭다운은 학교급과 무관하게 하나로 합친 목록을 쓴다. */
export const ALL_SUBJECTS: readonly string[] = Array.from(
  new Set([...SUBJECTS_BY_LEVEL.elementary, ...SUBJECTS_BY_LEVEL.secondary]),
);

export const CONDITION_GRADES: readonly ConditionGrade[] = ["new", "like_new", "good", "fair", "worn"] as const;

export const CONDITION_GRADE_LABELS: Record<ConditionGrade, string> = {
  new: "새 것",
  like_new: "거의 새 것",
  good: "양호",
  fair: "보통",
  worn: "사용감 있음",
};

export const SHARE_STATUS_LABELS: Record<SharePostStatus, string> = {
  available: "나눔중",
  reserved: "예약중",
  completed: "나눔완료",
  renting: "대여중",
  returned: "반납완료",
};

export function isShareCategory(value: string): value is ShareCategory {
  return (SHARE_CATEGORIES as readonly string[]).includes(value);
}

export function requiresGradeBand(level: SchoolLevel): boolean {
  return level === "elementary";
}

export function requiresSubject(category: string): boolean {
  return category === "교과자료";
}

export function isValidGradeBand(level: SchoolLevel, gradeBand: string | null): boolean {
  if (level === "elementary") return !!gradeBand && (GRADE_BANDS as readonly string[]).includes(gradeBand);
  return gradeBand === null;
}

export function isValidSubject(level: SchoolLevel, category: string, subject: string | null): boolean {
  if (!requiresSubject(category)) return subject === null;
  return !!subject && SUBJECTS_BY_LEVEL[level].includes(subject);
}

export function isValidRentalDates(
  type: TransactionType,
  start: string | null,
  end: string | null,
): boolean {
  if (type === "share") return start === null && end === null;
  return !!start && !!end && end >= start;
}
