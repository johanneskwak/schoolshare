"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ReviewActionState {
  error: string | null;
}

/**
 * 학교 평가를 등록/수정한다. 한 사용자는 한 학교에 하나의 평가만 가지므로(R24),
 * 기존 리뷰가 있으면 지우고(cascade로 answers도 함께 삭제) 새로 만든다.
 */
export async function submitSchoolReviewAction(
  schoolId: string,
  answers: Record<string, number>,
): Promise<ReviewActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const questionIds = Object.keys(answers);
  if (questionIds.length === 0) return { error: "평가 항목이 없습니다." };

  await supabase.from("school_reviews").delete().eq("school_id", schoolId).eq("user_id", user.id);

  const { data: review, error: reviewError } = await supabase
    .from("school_reviews")
    .insert({ school_id: schoolId, user_id: user.id })
    .select("id")
    .single();

  if (reviewError || !review) return { error: "평가 저장에 실패했습니다." };

  const { error: answersError } = await supabase.from("school_review_answers").insert(
    questionIds.map((questionId) => ({
      review_id: review.id,
      question_id: questionId,
      score: answers[questionId]!,
    })),
  );

  if (answersError) return { error: "평가 점수 저장에 실패했습니다." };

  revalidatePath(`/schools/${schoolId}`);
  return { error: null };
}
