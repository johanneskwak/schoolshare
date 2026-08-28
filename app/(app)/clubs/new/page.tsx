"use client";

import { useActionState, useState } from "react";
import { createClubPostAction } from "../actions";
import { CATEGORIES_BY_LEVEL, SCHOOL_LEVEL_LABELS, SCHOOL_LEVELS } from "@/lib/constants/categories";
import type { SchoolLevel } from "@/lib/supabase/types";
import type { FormActionState } from "../../share/actions";

const initialState: FormActionState = { error: null };

export default function NewClubPostPage() {
  const [state, formAction, pending] = useActionState(createClubPostAction, initialState);
  const [level, setLevel] = useState<SchoolLevel | "">("");

  return (
    <>
      <header className="header">소모임 만들기</header>
      <div className="container">
        <form action={formAction}>
          <div className="field">
            <label htmlFor="title">제목</label>
            <input id="title" name="title" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="description">소모임 설명</label>
            <textarea id="description" name="description" required />
          </div>
          <div className="field">
            <label htmlFor="school_level">학교급</label>
            <select
              id="school_level"
              name="school_level"
              required
              value={level}
              onChange={(e) => setLevel(e.target.value as SchoolLevel)}
            >
              <option value="">선택하세요</option>
              {SCHOOL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {SCHOOL_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">세부 카테고리</label>
            <select id="category" name="category" required disabled={!level}>
              <option value="">선택하세요</option>
              {level &&
                CATEGORIES_BY_LEVEL[level].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="images">사진 (선택, 최대 2장)</label>
            <input id="images" name="images" type="file" accept="image/*" multiple />
          </div>
          {state.error && <p className="error">{state.error}</p>}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "등록 중..." : "소모임 등록"}
          </button>
        </form>
      </div>
    </>
  );
}
