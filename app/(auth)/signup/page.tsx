"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction, type AuthActionState } from "../actions";
import { SchoolPicker } from "@/components/SchoolPicker";
import type { SchoolSearchResult } from "@/app/api/schools/search/route";

const initialState: AuthActionState = { error: null };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);

  return (
    <div className="page">
      <div className="container">
        <h1 className="title" style={{ fontSize: 24, margin: "24px 0" }}>
          교사 가입
        </h1>
        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="full_name">성함</label>
            <input id="full_name" name="full_name" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="nickname">닉네임</label>
            <input id="nickname" name="nickname" type="text" required />
            <p className="muted" style={{ marginTop: 4 }}>글과 댓글에는 성함 대신 닉네임이 표시됩니다.</p>
          </div>
          <div className="field">
            <label>소속 학교</label>
            <SchoolPicker onSelect={setSchool} />
            <input type="hidden" name="school_id" value={school?.id ?? ""} />
            {school && <p className="muted" style={{ marginTop: 4 }}>선택됨: {school.name}</p>}
          </div>
          {state.error && <p className="error">{state.error}</p>}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "가입 처리 중..." : "가입하기"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
          이미 계정이 있으신가요? <Link href="/login" style={{ color: "var(--color-accent)" }}>로그인</Link>
        </p>
      </div>
    </div>
  );
}
