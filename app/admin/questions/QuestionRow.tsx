"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleQuestionActiveAction } from "./actions";

export function QuestionRow({ id, text, isActive }: { id: string; text: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      await toggleQuestionActiveAction(id, !isActive);
      router.refresh();
    });
  }

  return (
    <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{text}</span>
      <button className="btn btn-secondary" style={{ width: "auto" }} disabled={pending} onClick={toggle}>
        {isActive ? "비활성화" : "활성화"}
      </button>
    </div>
  );
}
