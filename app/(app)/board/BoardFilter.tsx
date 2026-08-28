"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BOARD_MAJOR_CATEGORIES, BOARD_MINOR_CATEGORIES } from "@/lib/constants/board";

/** 게시판의 대분류(경력 단계)/소분류(주제) 필터. 학교급-카테고리와 달리 서로 독립적이라
 * 소분류가 대분류에 종속되지 않는다. */
export function BoardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const major = searchParams.get("major") ?? "";
  const minor = searchParams.get("minor") ?? "";

  function update(next: { major?: string; minor?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.major !== undefined) {
      if (next.major) params.set("major", next.major);
      else params.delete("major");
    }
    if (next.minor !== undefined) {
      if (next.minor) params.set("minor", next.minor);
      else params.delete("minor");
    }
    router.push(`/board?${params.toString()}`);
  }

  return (
    <div className="filters">
      <select value={major} onChange={(e) => update({ major: e.target.value })}>
        <option value="">전체 경력 단계</option>
        {BOARD_MAJOR_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select value={minor} onChange={(e) => update({ minor: e.target.value })}>
        <option value="">전체 주제</option>
        {BOARD_MINOR_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
