"use client";

import { useActionState, useState } from "react";
import { createSharePostAction, type FormActionState } from "../actions";
import { SCHOOL_LEVEL_LABELS, SCHOOL_LEVELS } from "@/lib/constants/categories";
import {
  CONDITION_GRADES,
  CONDITION_GRADE_LABELS,
  GRADE_BANDS,
  SHARE_CATEGORIES,
  SUBJECTS_BY_LEVEL,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/constants/share";
import type { ConditionGrade, SchoolLevel, TransactionType } from "@/lib/supabase/types";

interface ItemType {
  id: string;
  label: string;
  carbon_g: number;
}

const initialState: FormActionState = { error: null };

export function NewSharePostForm({ itemTypes }: { itemTypes: ItemType[] }) {
  const [state, formAction, pending] = useActionState(createSharePostAction, initialState);
  const [level, setLevel] = useState<SchoolLevel | "">("");
  const [category, setCategory] = useState<string>("");
  const [transactionType, setTransactionType] = useState<TransactionType>("share");
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
          onChange={(e) => {
            setLevel(e.target.value as SchoolLevel);
            setCategory("");
          }}
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
        <label htmlFor="category">카테고리</label>
        <select
          id="category"
          name="category"
          required
          disabled={!level}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">선택하세요</option>
          {SHARE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {level === "elementary" && (
        <div className="field">
          <label htmlFor="grade_band">학년군</label>
          <select id="grade_band" name="grade_band" required>
            <option value="">선택하세요</option>
            {GRADE_BANDS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}
      {category === "교과자료" && level && (
        <div className="field">
          <label htmlFor="subject">교과목</label>
          <select id="subject" name="subject" required>
            <option value="">선택하세요</option>
            {SUBJECTS_BY_LEVEL[level].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
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

      <fieldset className="field-group">
        <legend>나눔/대여 유형</legend>
        <div className="field">
          {TRANSACTION_TYPES.map((t) => (
            <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 16 }}>
              <input
                type="radio"
                name="transaction_type"
                value={t}
                checked={transactionType === t}
                onChange={() => setTransactionType(t)}
              />
              {TRANSACTION_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        {transactionType === "rental" && (
          <>
            <div className="field">
              <label htmlFor="rental_start_date">대여 시작일</label>
              <input id="rental_start_date" name="rental_start_date" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="rental_end_date">대여 종료일</label>
              <input id="rental_end_date" name="rental_end_date" type="date" required />
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="field-group">
        <legend>물건 상태</legend>
        <div className="field">
          <label htmlFor="condition_grade">상태 등급</label>
          <select id="condition_grade" name="condition_grade" required>
            {CONDITION_GRADES.map((g: ConditionGrade) => (
              <option key={g} value={g}>
                {CONDITION_GRADE_LABELS[g]}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-field" htmlFor="components_complete">
          <input id="components_complete" name="components_complete" type="checkbox" />
          구성품이 모두 있어요
        </label>
        <div className="field">
          <label htmlFor="condition_note">비고</label>
          <textarea id="condition_note" name="condition_note" maxLength={300} placeholder="선택 입력" />
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>사진 (1~4장)</legend>
        <div className="field">
          <input id="images" name="images" type="file" accept="image/*" multiple required />
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>첨부파일</legend>
        <div className="field">
          <input
            id="attachments"
            name="attachments"
            type="file"
            accept=".pdf,.hwp,.hwpx,.docx,.pptx"
            multiple
          />
          <p className="muted" style={{ marginTop: 6 }}>
            선택, 최대 3개, 개당 10MB (pdf, hwp, hwpx, docx, pptx)
          </p>
        </div>
      </fieldset>

      {state.error && <p className="error">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "등록 중..." : "글 등록"}
      </button>
    </form>
  );
}
