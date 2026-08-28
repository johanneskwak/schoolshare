"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelReservationAction,
  completeSharePostAction,
  reserveSharePostAction,
} from "../actions";
import type { SharePostStatus } from "@/lib/supabase/types";

interface ShareDetailActionsProps {
  postId: string;
  status: SharePostStatus;
  isAuthor: boolean;
  isReserver: boolean;
}

export function ShareDetailActions({ postId, status, isAuthor, isReserver }: ShareDetailActionsProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<void>) {
    startTransition(async () => {
      await action(postId);
      router.refresh();
    });
  }

  if (status === "available" && !isAuthor) {
    return (
      <button className="btn" disabled={pending} onClick={() => run(reserveSharePostAction)}>
        예약하기
      </button>
    );
  }

  if (status === "reserved" && (isAuthor || isReserver)) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => run(cancelReservationAction)}
        >
          예약 취소
        </button>
        {isAuthor && (
          <button className="btn" disabled={pending} onClick={() => run(completeSharePostAction)}>
            나눔완료로 변경
          </button>
        )}
      </div>
    );
  }

  if (status === "completed") {
    return <p className="muted">나눔이 완료된 글입니다.</p>;
  }

  return null;
}
