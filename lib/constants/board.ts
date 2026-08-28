/**
 * 게시판 대분류(경력 단계)/소분류(주제). Postgres CHECK 제약(0010_board.sql)과
 * 반드시 동기화한다. 학교급-카테고리와 달리 대분류-소분류는 짝을 강제하지 않는다 —
 * 소분류는 모든 대분류에 공통으로 적용된다.
 */
export const BOARD_MAJOR_CATEGORIES = ["신규적응", "저경력", "중견", "은퇴준비", "자유"] as const;
export const BOARD_MINOR_CATEGORIES = ["수업", "업무", "인간관계", "진로", "잡담"] as const;

export type BoardMajorCategory = (typeof BOARD_MAJOR_CATEGORIES)[number];
export type BoardMinorCategory = (typeof BOARD_MINOR_CATEGORIES)[number];

export function isValidBoardMajorCategory(v: string): v is BoardMajorCategory {
  return (BOARD_MAJOR_CATEGORIES as readonly string[]).includes(v);
}

export function isValidBoardMinorCategory(v: string): v is BoardMinorCategory {
  return (BOARD_MINOR_CATEGORIES as readonly string[]).includes(v);
}
