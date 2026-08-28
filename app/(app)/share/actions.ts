"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidCategory } from "@/lib/constants/categories";
import type { SchoolLevel } from "@/lib/supabase/types";

export interface FormActionState {
  error: string | null;
}

const SHARE_BUCKET = "share-images";
const MAX_SHARE_IMAGES = 4;

export async function createSharePostAction(
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
  const itemTypeId = String(formData.get("item_type_id") ?? "");
  const carbonG = Number(formData.get("carbon_g") ?? 0);
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !description || !schoolLevel || !category || !itemTypeId) {
    return { error: "모든 항목을 입력해 주세요." };
  }
  if (!isValidCategory(schoolLevel, category)) {
    return { error: "학교급과 카테고리 조합이 올바르지 않습니다." };
  }
  if (images.length < 1 || images.length > MAX_SHARE_IMAGES) {
    return { error: `사진은 1장 이상 ${MAX_SHARE_IMAGES}장 이하로 첨부해 주세요.` };
  }

  const { data: post, error: postError } = await supabase
    .from("share_posts")
    .insert({
      author_id: user.id,
      title,
      description,
      school_level: schoolLevel,
      category,
      item_type_id: itemTypeId,
      carbon_g: carbonG,
    })
    .select("id")
    .single();

  if (postError || !post) {
    return { error: "나눔 글 저장에 실패했습니다." };
  }

  for (let i = 0; i < images.length; i++) {
    const file = images[i]!;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${post.id}/${i}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(SHARE_BUCKET).upload(path, file);
    if (uploadError) continue;
    await supabase.from("share_post_images").insert({ post_id: post.id, storage_path: path, sort_order: i });
  }

  revalidatePath("/share");
  redirect(`/share/${post.id}`);
}

export async function reserveSharePostAction(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("share_posts").update({ status: "reserved", reserved_by: user.id }).eq("id", postId);
  revalidatePath(`/share/${postId}`);
}

export async function cancelReservationAction(postId: string) {
  const supabase = await createClient();
  await supabase.from("share_posts").update({ status: "available" }).eq("id", postId);
  revalidatePath(`/share/${postId}`);
}

export async function completeSharePostAction(postId: string) {
  const supabase = await createClient();
  await supabase.from("share_posts").update({ status: "completed" }).eq("id", postId);
  revalidatePath(`/share/${postId}`);
}

export async function addShareCommentAction(
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

  const { error } = await supabase.from("share_comments").insert({ post_id: postId, author_id: user.id, body });
  if (error) return { error: "예약중인 글에는 댓글을 쓸 수 없습니다." };

  revalidatePath(`/share/${postId}`);
  return { error: null };
}
