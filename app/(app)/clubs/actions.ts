"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidCategory } from "@/lib/constants/categories";
import type { SchoolLevel } from "@/lib/supabase/types";
import type { FormActionState } from "../share/actions";

const CLUB_BUCKET = "club-images";
const MAX_CLUB_IMAGES = 2;

export async function createClubPostAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const schoolLevel = String(formData.get("school_level") ?? "") as SchoolLevel;
  const category = String(formData.get("category") ?? "");
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !description || !schoolLevel || !category) {
    return { error: "모든 항목을 입력해 주세요." };
  }
  if (!isValidCategory(schoolLevel, category)) {
    return { error: "학교급과 카테고리 조합이 올바르지 않습니다." };
  }
  if (images.length > MAX_CLUB_IMAGES) {
    return { error: `사진은 최대 ${MAX_CLUB_IMAGES}장까지 첨부할 수 있습니다.` };
  }

  const { data: post, error: postError } = await supabase
    .from("club_posts")
    .insert({ author_id: user.id, title, description, school_level: schoolLevel, category })
    .select("id")
    .single();

  if (postError || !post) return { error: "소모임 글 저장에 실패했습니다." };

  for (let i = 0; i < images.length; i++) {
    const file = images[i]!;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${post.id}/${i}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(CLUB_BUCKET).upload(path, file);
    if (uploadError) continue;
    await supabase.from("club_post_images").insert({ post_id: post.id, storage_path: path, sort_order: i });
  }

  revalidatePath("/clubs");
  redirect(`/clubs/${post.id}`);
}

export async function addClubCommentAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "댓글 내용을 입력해 주세요." };

  const { error } = await supabase.from("club_comments").insert({ post_id: postId, author_id: user.id, body });
  if (error) return { error: "댓글 등록에 실패했습니다." };

  revalidatePath(`/clubs/${postId}`);
  return { error: null };
}

export async function createClubEventAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title || !eventDate || !location) {
    return { error: "날짜, 장소, 제목을 모두 입력해 주세요." };
  }

  const { error } = await supabase.from("club_events").insert({
    author_id: user.id,
    title,
    event_date: eventDate,
    location,
    description: description || null,
  });

  if (error) return { error: "번개모임 등록에 실패했습니다." };

  revalidatePath("/clubs/meetups");
  redirect("/clubs/meetups");
}

export async function deleteClubEventAction(eventId: string) {
  const supabase = await createClient();
  await supabase.from("club_events").delete().eq("id", eventId);
  revalidatePath("/clubs/meetups");
}
