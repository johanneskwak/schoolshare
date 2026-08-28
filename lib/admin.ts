import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** 현재 로그인한 사용자가 관리자(role='admin')인지 서버에서 확인한다. */
export async function checkIsAdmin(
  supabase: SupabaseClient<Database>,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}
