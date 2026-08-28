"use client";

import { useActionState, useState } from "react";
import { createSharePostAction, type FormActionState } from "../actions";
import { CATEGORIES_BY_LEVEL, SCHOOL_LEVEL_LABELS, SCHOOL_LEVELS } from "@/lib/constants/categories";
import type { SchoolLevel } from "@/lib/supabase/types";

interface ItemType {
  id: string;
  label: string;
  carbon_g: number;
}

const initialState: FormActionState = { error: null };

export function NewSharePostForm({ itemTypes }: { itemTypes: ItemType[] }) {
  const [state, formAction, pending] = useActionState(createSharePostAction, initialState);
  const [level, setLevel] = useState<SchoolLevel | "">("");
  const [carbonG, setCarbonG] = useState("");

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="title">제목</label>
        <input id="title" name="title" type="text" required />
      </div>
      <div className="field">
        <label htmlFor="description">물건 설명</label>
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
        <label htmlFor="item_type_id">품목 유형</label>
        <select
          id="item_type_id"
          name="item_type_id"
          required
          onChange={(e) => {
            const selected = itemTypes.find((it) => it.id === e.target.value);
            setCarbonG(selected ? String(selected.carbon_g) : "");
          }}
        >
          <option value="">선택하세요</option>
          {itemTypes.map((it) => (
            <option key={it.id} value={it.id}>
              {it.label} ({it.carbon_g}g 절감)
            </option>
          ))}
        </select>
        <input type="hidden" name="carbon_g" value={carbonG} readOnly />
      </div>
      <div className="field">
        <label htmlFor="images">사진 (1~4장)</label>
        <input id="images" name="images" type="file" accept="image/*" multiple required />
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "등록 중..." : "나눔 글 등록"}
      </button>
    </form>
  );
}
