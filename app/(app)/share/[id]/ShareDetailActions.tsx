"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelReservationAction,
  completeSharePostAction,
  reserveSharePostAction,
  returnRentalAction,
  startRentalAction,
} from "../actions";
import type { SharePostStatus, TransactionType } from "@/lib/supabase/types";

interface ShareDetailActionsProps {
  postId: string;
  status: SharePostStatus;
  transactionType: TransactionType;
  isAuthor: boolean;
  isReserver: boolean;
}

export function ShareDetailActions({
  postId,
  status,
  transactionType,
  isAuthor,
  isReserver,
}: ShareDetailActionsProps) {
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
        {transactionType === "rental" ? "대여 신청하기" : "예약하기"}
      </button>
    );
  }

  if (status === "reserved" && (isAuthor || isReserver)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => run(cancelReservationAction)}
        >
          예약 취소
        </button>
        {transactionType === "share" && isAuthor && (
          <button className="btn" disabled={pending} onClick={() => run(completeSharePostAction)}>
            나눔완료로 변경
          </button>
        )}
        {transactionType === "rental" && isAuthor && (
          <button className="btn" disabled={pending} onClick={() => run(startRentalAction)}>
            대여 시작
          </button>
        )}
        {transactionType === "rental" && isReserver && !isAuthor && (
          <p className="muted">대여 신청이 승인되면 대여가 시작됩니다.</p>
        )}
      </div>
    );
  }

  if (status === "renting") {
    if (isAuthor) {
      return (
        <button className="btn" disabled={pending} onClick={() => run(returnRentalAction)}>
          반납 완료로 변경
        </button>
      );
    }
    return <p className="muted">대여 중입니다.</p>;
  }

  if (status === "completed") {
    return <p className="muted">나눔이 완료된 글입니다.</p>;
  }

  if (status === "returned") {
    return <p className="muted">대여가 종료되고 반납이 완료된 글입니다.</p>;
  }

  return null;
}
