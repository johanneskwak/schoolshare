"use client";

import { useActionState } from "react";
import { createBoardPostAction } from "../actions";
import { BOARD_MAJOR_CATEGORIES, BOARD_MINOR_CATEGORIES } from "@/lib/constants/board";
import type { FormActionState } from "../../share/actions";

const initialState: FormActionState = { error: null };

export default function NewBoardPostPage() {
  const [state, formAction, pending] = useActionState(createBoardPostAction, initialState);

  return (
    <>
      <header className="header">게시판 글쓰기</header>
      <div className="container">
        <form action={formAction}>
          <div className="field">
            <label htmlFor="title">제목</label>
            <input id="title" name="title" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="body">내용</label>
            <textarea id="body" name="body" required style={{ minHeight: 160 }} />
          </div>
          <div className="field">
            <label htmlFor="major_category">경력 단계</label>
            <select id="major_category" name="major_category" required>
              <option value="">선택하세요</option>
              {BOARD_MAJOR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="minor_category">주제</label>
            <select id="minor_category" name="minor_category" required>
              <option value="">선택하세요</option>
              {BOARD_MINOR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {state.error && <p className="error">{state.error}</p>}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "등록 중..." : "게시글 등록"}
          </button>
        </form>
      </div>
    </>
  );
}
