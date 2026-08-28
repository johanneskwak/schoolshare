"use client";

import { useActionState, useEffect, useRef } from "react";
import { addClubCommentAction } from "../actions";
import type { FormActionState } from "../../share/actions";

const initialState: FormActionState = { error: null };

export function ClubCommentForm({ postId }: { postId: string }) {
  const [state, formAction, pending] = useActionState(addClubCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && !pending) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form action={formAction} ref={formRef}>
      <input type="hidden" name="post_id" value={postId} />
      <div className="field" style={{ marginBottom: 8 }}>
        <textarea name="body" placeholder="댓글을 남겨보세요" required style={{ minHeight: 60 }} />
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn btn-secondary" type="submit" disabled={pending}>
        댓글 등록
      </button>
    </form>
  );
}
