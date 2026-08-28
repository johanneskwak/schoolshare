"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES_BY_LEVEL, SCHOOL_LEVEL_LABELS, SCHOOL_LEVELS } from "@/lib/constants/categories";
import type { SchoolLevel } from "@/lib/supabase/types";

interface CategoryFilterProps {
  basePath: string;
}

/** 나눔/소모임 목록의 학교급·세부 카테고리 필터. (R8) */
export function CategoryFilter({ basePath }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const level = (searchParams.get("level") as SchoolLevel | null) ?? "";
  const category = searchParams.get("category") ?? "";

  function update(next: { level?: string; category?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.level !== undefined) {
      if (next.level) params.set("level", next.level);
      else params.delete("level");
      params.delete("category");
    }
    if (next.category !== undefined) {
      if (next.category) params.set("category", next.category);
      else params.delete("category");
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="filters">
      <select value={level} onChange={(e) => update({ level: e.target.value })}>
        <option value="">전체 학교급</option>
        {SCHOOL_LEVELS.map((l) => (
          <option key={l} value={l}>
            {SCHOOL_LEVEL_LABELS[l]}
          </option>
        ))}
      </select>
      <select
        value={category}
        onChange={(e) => update({ category: e.target.value })}
        disabled={!level}
      >
        <option value="">전체 카테고리</option>
        {level &&
          CATEGORIES_BY_LEVEL[level].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
      </select>
    </div>
  );
}
