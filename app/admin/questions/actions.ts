"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormActionState } from "@/app/(app)/share/actions";

export async function addQuestionAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "질문 내용을 입력해 주세요." };

  const { error } = await supabase.from("school_review_questions").insert({ text });
  if (error) return { error: "질문 추가에 실패했습니다." };

  revalidatePath("/admin/questions");
  return { error: null };
}

export async function toggleQuestionActiveAction(id: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from("school_review_questions").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/questions");
}
