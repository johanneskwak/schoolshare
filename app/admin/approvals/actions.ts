"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveProfileAction(profileId: string) {
  const supabase = await createClient();
  await supabase.from("profiles").update({ status: "approved" }).eq("id", profileId);
  revalidatePath("/admin/approvals");
}

export async function rejectProfileAction(profileId: string) {
  const supabase = await createClient();
  await supabase.from("profiles").update({ status: "rejected" }).eq("id", profileId);
  revalidatePath("/admin/approvals");
}
