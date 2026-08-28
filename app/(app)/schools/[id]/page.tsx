import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RatingRadar } from "./RatingRadar";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: school } = await supabase.from("schools").select("id, name, address").eq("id", id).maybeSingle();
  if (!school) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: questions }, { data: summary }, { data: participants }] = await Promise.all([
    supabase
      .from("school_review_questions")
      .select("id, text, sort_order, is_active")
      .order("sort_order"),
    supabase.from("school_rating_summary").select("question_id, question_text, avg_score, answer_count").eq(
      "school_id",
      id,
    ),
    supabase.from("school_review_participant_counts").select("participant_count").eq("school_id", id).maybeSingle(),
  ]);

  const activeQuestions = (questions ?? []).filter((q) => q.is_active);
  const summaryByQuestion = new Map((summary ?? []).map((s) => [s.question_id, s]));
  const participantCount = participants?.participant_count ?? 0;

  const answerCount = (summary ?? []).reduce((sum, item) => sum + item.answer_count, 0);
  const overallAvg = answerCount > 0
    ? (summary ?? []).reduce((sum, item) => sum + (item.avg_score ?? 0) * item.answer_count, 0) / answerCount
    : null;

  let myAnswers: Record<string, number> = {};
  if (user) {
    const { data: myReview } = await supabase
      .from("school_reviews")
      .select("id")
      .eq("school_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (myReview) {
      const { data: answers } = await supabase
        .from("school_review_answers")
        .select("question_id, score")
        .eq("review_id", myReview.id);
      myAnswers = Object.fromEntries((answers ?? []).map((a) => [a.question_id, a.score]));
    }
  }

  return (
    <>
      <header className="header">학교정보</header>
      <div className="container">
        <h1 className="title" style={{ fontSize: 20 }}>{school.name}</h1>
        {school.address && <p className="muted">{school.address}</p>}

        <div className="stat-box">
          <div className="num">{overallAvg != null ? overallAvg.toFixed(1) : "평가 없음"}</div>
          <p className="muted">참여자 {participantCount}명</p>
        </div>

        <div className="card">
          <RatingRadar items={activeQuestions.slice(0, 6).map((q) => ({
            id: q.id,
            label: q.text,
            score: summaryByQuestion.get(q.id)?.avg_score ?? null,
          }))} />
        </div>

        <div className="card">
          {(questions ?? []).map((q) => {
            const s = summaryByQuestion.get(q.id);
            return (
              <div className="rating-row" key={q.id}>
                <span>{q.text}</span>
                <span style={{ fontWeight: 700 }}>{s ? s.avg_score?.toFixed(1) : "평가 없음"}</span>
              </div>
            );
          })}
        </div>

        <Link className="btn" href={`/schools/${school.id}/review`}>
          {Object.keys(myAnswers).length > 0 ? "내 평가 수정" : "평가하기"}
        </Link>
      </div>
    </>
  );
}
