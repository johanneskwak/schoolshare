"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleQuestionActiveAction, updateQuestionAction } from "./actions";

export function QuestionRow({ id, text, sortOrder, isActive }: { id: string; text: string; sortOrder: number; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [draftText, setDraftText] = useState(text);
  const [draftOrder, setDraftOrder] = useState(sortOrder);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      await toggleQuestionActiveAction(id, !isActive);
      router.refresh();
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateQuestionAction(id, draftText, draftOrder);
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="field"><label>질문</label><input type="text" value={draftText} onChange={(e) => setDraftText(e.target.value)} /></div>
      <div className="field"><label>정렬 순서</label><input type="number" value={draftOrder} onChange={(e) => setDraftOrder(Number(e.target.value))} /></div>
      {error && <p className="error">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" disabled={pending} onClick={save}>저장</button>
        <button className="btn btn-secondary" disabled={pending} onClick={toggle}>{isActive ? "비활성화" : "활성화"}</button>
      </div>
    </div>
  );
}
