"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClubEventAction } from "../actions";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      await deleteClubEventAction(eventId);
      router.refresh();
    });
  }

  return (
    <button
      className="btn btn-secondary"
      style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
      disabled={pending}
      onClick={handleDelete}
    >
      취소
    </button>
  );
}
