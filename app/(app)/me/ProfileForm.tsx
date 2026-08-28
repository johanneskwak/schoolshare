"use client";

import { useActionState, useState } from "react";
import { updateProfileAction } from "./actions";
import { SchoolPicker } from "@/components/SchoolPicker";
import type { SchoolSearchResult } from "@/app/api/schools/search/route";
import type { FormActionState } from "../share/actions";

const initialState: FormActionState = { error: null };

export function ProfileForm({ nickname, schoolName }: { nickname: string; schoolName: string | null }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);

  return (
    <form action={formAction} className="card">
      <div className="field">
        <label htmlFor="nickname">닉네임</label>
        <input id="nickname" name="nickname" type="text" defaultValue={nickname} required />
      </div>
      <div className="field">
        <label>소속 학교 {schoolName && <span className="muted">(현재: {schoolName})</span>}</label>
        <SchoolPicker onSelect={setSchool} placeholder="학교를 바꾸려면 검색하세요" />
        <input type="hidden" name="school_id" value={school?.id ?? ""} />
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
