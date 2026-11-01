"use client";

import { useActionState } from "react";
import { createClubEventAction } from "../../actions";
import type { FormActionState } from "../../../share/actions";

const initialState: FormActionState = { error: null };

export default function NewMeetupPage() {
  const [state, formAction, pending] = useActionState(createClubEventAction, initialState);

  return (
    <>
      <header className="header">번개모임 등록</header>
      <div className="container">
        <form action={formAction}>
          <div className="field">
            <label htmlFor="event_date">날짜</label>
            <input id="event_date" name="event_date" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="location">장소</label>
            <input id="location" name="location" type="text" required placeholder="예: 노량진 KFC" />
          </div>
          <div className="field">
            <label htmlFor="title">제목</label>
            <input id="title" name="title" type="text" required placeholder="예: 저경력 교사 번개모임" />
          </div>
          <div className="field">
            <label htmlFor="description">설명 (선택)</label>
            <textarea id="description" name="description" placeholder="시간, 준비물 등" />
          </div>
          {state.error && <p className="error">{state.error}</p>}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "등록 중..." : "번개모임 등록"}
          </button>
        </form>
      </div>
    </>
  );
}
