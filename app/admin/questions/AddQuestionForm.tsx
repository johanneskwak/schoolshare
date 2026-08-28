"use client";

import { useActionState, useEffect, useRef } from "react";
import { addQuestionAction } from "./actions";
import type { FormActionState } from "@/app/(app)/share/actions";

const initialState: FormActionState = { error: null };

export function AddQuestionForm() {
  const [state, formAction, pending] = useActionState(addQuestionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && !pending) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form action={formAction} ref={formRef} className="card">
      <div className="field" style={{ marginBottom: 8 }}>
        <label htmlFor="text">새 질문</label>
        <input id="text" name="text" type="text" required placeholder="예: 관리자 문화는 어땠나요?" />
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>질문 추가</button>
    </form>
  );
}
