"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface AdminDeleteButtonProps {
  onDelete: () => Promise<void>;
  label?: string;
  confirmMessage?: string;
  small?: boolean;
}

/** 관리자 전용 삭제 버튼. 댓글(작게)과 글(전체 너비) 양쪽에서 재사용한다. */
export function AdminDeleteButton({ onDelete, label = "삭제", confirmMessage, small }: AdminDeleteButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      await onDelete();
      router.refresh();
    });
  }

  return (
    <button
      className="btn btn-danger"
      style={small ? { width: "auto", padding: "6px 10px", fontSize: 13 } : undefined}
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? "삭제 중..." : label}
    </button>
  );
}
