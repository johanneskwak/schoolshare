"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormActionState } from "../share/actions";

export async function updateProfileAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const nickname = String(formData.get("nickname") ?? "").trim();
  const schoolId = String(formData.get("school_id") ?? "");

  if (!nickname) return { error: "닉네임을 입력해 주세요." };

  const update: { nickname: string; school_id?: string } = { nickname };
  if (schoolId) update.school_id = schoolId;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "이미 사용 중인 닉네임입니다." };
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/me");
  return { error: null };
}
