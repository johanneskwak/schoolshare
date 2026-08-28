"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidBoardMajorCategory, isValidBoardMinorCategory } from "@/lib/constants/board";
import type { FormActionState } from "../share/actions";

export async function createBoardPostAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const majorCategory = String(formData.get("major_category") ?? "");
  const minorCategory = String(formData.get("minor_category") ?? "");

  if (!title || !body || !majorCategory || !minorCategory) {
    return { error: "모든 항목을 입력해 주세요." };
  }
  if (!isValidBoardMajorCategory(majorCategory) || !isValidBoardMinorCategory(minorCategory)) {
    return { error: "분류가 올바르지 않습니다." };
  }

  const { data: post, error } = await supabase
    .from("board_posts")
    .insert({ author_id: user.id, title, body, major_category: majorCategory, minor_category: minorCategory })
    .select("id")
    .single();

  if (error || !post) return { error: "게시글 저장에 실패했습니다." };

  revalidatePath("/board");
  redirect(`/board/${post.id}`);
}

export async function addBoardCommentAction(
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

  const { error } = await supabase.from("board_comments").insert({ post_id: postId, author_id: user.id, body });
  if (error) return { error: "댓글 등록에 실패했습니다." };

  revalidatePath(`/board/${postId}`);
  return { error: null };
}

export async function adminUpdateBoardPostAction(
  postId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { error: "제목과 내용은 비워둘 수 없습니다." };

  const { error } = await supabase.from("board_posts").update({ title, body }).eq("id", postId);
  if (error) return { error: "수정 권한이 없거나 저장에 실패했습니다." };

  revalidatePath(`/board/${postId}`);
  return { error: null };
}

export async function adminDeleteBoardPostAction(postId: string) {
  const supabase = await createClient();
  await supabase.from("board_posts").delete().eq("id", postId);
  revalidatePath("/board");
  redirect("/board");
}

export async function adminDeleteBoardCommentAction(postId: string, commentId: string) {
  const supabase = await createClient();
  await supabase.from("board_comments").delete().eq("id", commentId);
  revalidatePath(`/board/${postId}`);
}
