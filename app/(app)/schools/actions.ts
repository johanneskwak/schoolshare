"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ReviewActionState {
  error: string | null;
}

/** 평가와 답변을 DB 함수의 단일 트랜잭션에서 등록/수정한다. */
export async function submitSchoolReviewAction(
  schoolId: string,
  answers: Record<string, number>,
): Promise<ReviewActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  if (Object.keys(answers).length === 0 || Object.values(answers).some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
    return { error: "모든 항목에 1~5점의 별점을 매겨주세요." };
  }

  const { error } = await supabase.rpc("submit_school_review", { target_school_id: schoolId, answer_scores: answers });
  if (error) return { error: "평가 저장에 실패했습니다. 질문 항목을 확인해 주세요." };

  revalidatePath(`/schools/${schoolId}`);
  return { error: null };
}
