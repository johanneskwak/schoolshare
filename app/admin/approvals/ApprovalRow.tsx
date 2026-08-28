"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveProfileAction, rejectProfileAction } from "./actions";

interface ApprovalRowProps {
  id: string;
  email: string;
  fullName: string;
  schoolName: string;
  createdAt: string;
}

export function ApprovalRow({ id, email, fullName, schoolName, createdAt }: ApprovalRowProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<void>) {
    startTransition(async () => {
      await action(id);
      router.refresh();
    });
  }

  return (
    <div className="card">
      <p className="title">{fullName}</p>
      <p className="muted">{email}</p>
      <p className="muted">{schoolName} · {new Date(createdAt).toLocaleDateString("ko-KR")}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn" disabled={pending} onClick={() => run(approveProfileAction)}>승인</button>
        <button className="btn btn-danger" disabled={pending} onClick={() => run(rejectProfileAction)}>거절</button>
      </div>
    </div>
  );
}
