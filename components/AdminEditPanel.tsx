"use client";

import { useActionState, useState } from "react";
import type { FormActionState } from "@/app/(app)/share/actions";

interface Field {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date";
  defaultValue: string;
}

interface AdminEditPanelProps {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  fields: Field[];
}

/** 관리자 전용 인라인 수정 폼. 나눔/소모임/게시판 글, 번개모임에서 필드 구성만 바꿔 재사용한다. */
export function AdminEditPanel({ action, fields }: AdminEditPanelProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { error: null } as FormActionState);

  if (!open) {
    return (
      <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>
        관리자: 수정
      </button>
    );
  }

  return (
    <form action={formAction} className="card">
      {fields.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          {f.type === "textarea" ? (
            <textarea id={f.name} name={f.name} defaultValue={f.defaultValue} style={{ minHeight: 100 }} />
          ) : (
            <input id={f.name} name={f.name} type={f.type ?? "text"} defaultValue={f.defaultValue} />
          )}
        </div>
      ))}
      {state.error && <p className="error">{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
    </form>
  );
}
