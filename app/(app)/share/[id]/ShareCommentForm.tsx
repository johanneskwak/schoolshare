"use client";

import { useActionState, useEffect, useRef } from "react";
import { addShareCommentAction, type FormActionState } from "../actions";

const initialState: FormActionState = { error: null };

export function ShareCommentForm({ postId, disabled }: { postId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(addShareCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && !pending) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form action={formAction} ref={formRef}>
      <input type="hidden" name="post_id" value={postId} />
      <div className="field" style={{ marginBottom: 8 }}>
        <textarea
          name="body"
          placeholder={disabled ? "예약중에는 댓글을 쓸 수 없습니다" : "댓글을 남겨보세요"}
          disabled={disabled}
          required
          style={{ minHeight: 60 }}
        />
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn btn-secondary" type="submit" disabled={disabled || pending}>
        댓글 등록
      </button>
    </form>
  );
}
