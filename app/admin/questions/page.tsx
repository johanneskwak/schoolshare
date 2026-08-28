import { createClient } from "@/lib/supabase/server";
import { QuestionRow } from "./QuestionRow";
import { AddQuestionForm } from "./AddQuestionForm";

export default async function QuestionsPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("school_review_questions")
    .select("id, text, is_active")
    .order("sort_order");

  return (
    <div className="container">
      <h1 className="title" style={{ fontSize: 18, margin: "16px 0" }}>평가 질문 관리</h1>
      <AddQuestionForm />
      <div style={{ marginTop: 16 }}>
        {questions?.map((q) => (
          <QuestionRow key={q.id} id={q.id} text={q.text} isActive={q.is_active} />
        ))}
      </div>
    </div>
  );
}
