"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthActionState } from "../actions";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="page">
      <div className="container">
        <h1 className="title" style={{ fontSize: 24, margin: "24px 0" }}>
          TeacherTown 로그인
        </h1>
        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {state.error && <p className="error">{state.error}</p>}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
          아직 계정이 없으신가요? <Link href="/signup" style={{ color: "var(--color-accent)" }}>가입하기</Link>
        </p>
      </div>
    </div>
  );
}
