"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSchoolReviewAction } from "../actions";

interface Question {
  id: string;
  text: string;
}

interface SchoolReviewFormProps {
  schoolId: string;
  questions: Question[];
  initialAnswers: Record<string, number>;
}

export function SchoolReviewForm({ schoolId, questions, initialAnswers }: SchoolReviewFormProps) {
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setScore(questionId: string, score: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  }

  function submit() {
    if (Object.keys(answers).length < questions.length) {
      setError("모든 항목에 별점을 매겨주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitSchoolReviewAction(schoolId, answers);
      if (result.error) setError(result.error);
      else router.push(`/schools/${schoolId}`);
    });
  }

  if (questions.length === 0) {
    return <p className="muted">등록된 평가 질문이 없습니다.</p>;
  }

  return (
    <div className="card">
      {questions.map((q) => (
        <div className="rating-row" key={q.id}>
          <span>{q.text}</span>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`star-btn ${(answers[q.id] ?? 0) >= n ? "filled" : ""}`}
                onClick={() => setScore(q.id, n)}
                aria-label={`${n}점`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
      <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={pending}>
        {pending ? "저장 중..." : Object.keys(initialAnswers).length ? "평가 수정" : "평가 제출"}
      </button>
    </div>
  );
}
