"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SCHOOL_LEVEL_LABELS, SCHOOL_LEVELS } from "@/lib/constants/categories";
import {
  ALL_SUBJECTS,
  CONDITION_GRADES,
  CONDITION_GRADE_LABELS,
  GRADE_BANDS,
  SHARE_CATEGORIES,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/constants/share";
import type { SchoolLevel } from "@/lib/supabase/types";

/** 나눔/대여 목록의 확장 필터 바. (이슈4) 나눔 전용이며 소모임은 components/CategoryFilter.tsx를 그대로 쓴다. */
export function ShareFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const level = (searchParams.get("level") as SchoolLevel | null) ?? "";
  const category = searchParams.get("category") ?? "";
  const gradeBand = searchParams.get("grade_band") ?? "";
  const subject = searchParams.get("subject") ?? "";
  const transactionType = searchParams.get("transaction_type") ?? "";
  const conditionGrade = searchParams.get("condition_grade") ?? "";

  function update(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/share?${params.toString()}`);
  }

  return (
    <details className="filters-accordion">
      <summary>필터</summary>
      <div className="filters">
        <select
          value={level}
          onChange={(e) => {
            const v = e.target.value;
            update({ level: v, grade_band: v === "elementary" ? gradeBand : undefined });
          }}
        >
          <option value="">전체 학교급</option>
          {SCHOOL_LEVELS.map((l) => (
            <option key={l} value={l}>
              {SCHOOL_LEVEL_LABELS[l]}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => {
            const v = e.target.value;
            update({ category: v, subject: v === "교과자료" ? subject : undefined });
          }}
        >
          <option value="">전체 카테고리</option>
          {SHARE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {level === "elementary" && (
          <select value={gradeBand} onChange={(e) => update({ grade_band: e.target.value })}>
            <option value="">전체 학년군</option>
            {GRADE_BANDS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}

        {category === "교과자료" && (
          <select value={subject} onChange={(e) => update({ subject: e.target.value })}>
            <option value="">전체 교과목</option>
            {ALL_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <select value={transactionType} onChange={(e) => update({ transaction_type: e.target.value })}>
          <option value="">나눔/대여 전체</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select value={conditionGrade} onChange={(e) => update({ condition_grade: e.target.value })}>
          <option value="">전체 상태등급</option>
          {CONDITION_GRADES.map((g) => (
            <option key={g} value={g}>
              {CONDITION_GRADE_LABELS[g]}
            </option>
          ))}
        </select>
      </div>
    </details>
  );
}
