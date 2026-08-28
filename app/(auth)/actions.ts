"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error: string | null;
}

export async function loginAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  redirect("/share");
}

export async function signupAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const schoolId = String(formData.get("school_id") ?? "");

  if (!email || !password || !fullName || !nickname || !schoolId) {
    return { error: "모든 항목을 입력하고 학교를 검색해 선택해 주세요." };
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? "가입에 실패했습니다." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: signUpData.user.id,
    email,
    full_name: fullName,
    nickname,
    school_id: schoolId,
  });

  if (profileError) {
    if (profileError.code === "23505") {
      return { error: "이미 사용 중인 닉네임입니다." };
    }
    return { error: "프로필 생성에 실패했습니다." };
  }

  redirect("/pending");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
