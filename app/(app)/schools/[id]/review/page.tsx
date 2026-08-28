import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SchoolReviewForm } from "../SchoolReviewForm";

export default async function SchoolReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: school }, { data: questions }, { data: auth }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("school_review_questions").select("id, text").eq("is_active", true).order("sort_order"),
    supabase.auth.getUser(),
  ]);
  if (!school) notFound();

  let initialAnswers: Record<string, number> = {};
  if (auth.user) {
    const { data: review } = await supabase.from("school_reviews").select("id").eq("school_id", id).eq("user_id", auth.user.id).maybeSingle();
    if (review) {
      const { data: answers } = await supabase.from("school_review_answers").select("question_id, score").eq("review_id", review.id);
      initialAnswers = Object.fromEntries((answers ?? []).map((answer) => [answer.question_id, answer.score]));
    }
  }

  return (
    <>
      <header className="header">{Object.keys(initialAnswers).length ? "내 평가 수정" : "학교 평가하기"}</header>
      <div className="container">
        <h1 className="title" style={{ marginBottom: 16 }}>{school.name}</h1>
        <SchoolReviewForm schoolId={school.id} questions={questions ?? []} initialAnswers={initialAnswers} />
      </div>
    </>
  );
}
