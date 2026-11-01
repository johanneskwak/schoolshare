"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CONDITION_GRADES,
  TRANSACTION_TYPES,
  isShareCategory,
  isValidGradeBand,
  isValidRentalDates,
  isValidSubject,
  requiresGradeBand,
  requiresSubject,
} from "@/lib/constants/share";
import type { ConditionGrade, SchoolLevel, TransactionType } from "@/lib/supabase/types";

export interface FormActionState {
  error: string | null;
}

const SHARE_BUCKET = "share-images";
const MAX_SHARE_IMAGES = 4;

const ATTACHMENT_BUCKET = "post-attachments";
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_EXTENSIONS = ["pdf", "hwp", "hwpx", "docx", "pptx"];

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
  const transactionType = String(formData.get("transaction_type") ?? "") as TransactionType;
  const conditionGrade = String(formData.get("condition_grade") ?? "") as ConditionGrade;
  const componentsComplete = formData.get("components_complete") === "on";
  const conditionNote = String(formData.get("condition_note") ?? "").trim() || null;
  const gradeBandInput = String(formData.get("grade_band") ?? "").trim() || null;
  const subjectInput = String(formData.get("subject") ?? "").trim() || null;
  const rentalStartInput = String(formData.get("rental_start_date") ?? "").trim() || null;
  const rentalEndInput = String(formData.get("rental_end_date") ?? "").trim() || null;
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const attachments = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !description || !schoolLevel || !category || !itemTypeId) {
    return { error: "모든 항목을 입력해 주세요." };
  }
  if (!isShareCategory(category)) {
    return { error: "카테고리가 올바르지 않습니다." };
  }
  if (!(TRANSACTION_TYPES as readonly string[]).includes(transactionType)) {
    return { error: "나눔/대여 유형을 선택해 주세요." };
  }
  if (!(CONDITION_GRADES as readonly string[]).includes(conditionGrade)) {
    return { error: "물건 상태를 선택해 주세요." };
  }
  if (conditionNote && conditionNote.length > 2000) {
    return { error: "활용팁은 2000자 이하로 입력해 주세요." };
  }

  const gradeBand = requiresGradeBand(schoolLevel) ? gradeBandInput : null;
  if (!isValidGradeBand(schoolLevel, gradeBand)) {
    return { error: "학년군을 선택해 주세요." };
  }

  const subject = requiresSubject(category) ? subjectInput : null;
  if (!isValidSubject(schoolLevel, category, subject)) {
    return { error: "교과목을 선택해 주세요." };
  }

  const rentalStartDate = transactionType === "rental" ? rentalStartInput : null;
  const rentalEndDate = transactionType === "rental" ? rentalEndInput : null;
  if (!isValidRentalDates(transactionType, rentalStartDate, rentalEndDate)) {
    return { error: "대여 가능 기간(시작~종료일)을 올바르게 입력해 주세요." };
  }

  if (images.length < 1 || images.length > MAX_SHARE_IMAGES) {
    return { error: `사진은 1장 이상 ${MAX_SHARE_IMAGES}장 이하로 첨부해 주세요.` };
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    return { error: `첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 첨부할 수 있습니다.` };
  }
  for (const file of attachments) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ATTACHMENT_EXTENSIONS.includes(ext)) {
      return { error: "첨부파일은 pdf, hwp, hwpx, docx, pptx만 가능합니다." };
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return { error: "첨부파일은 개당 10MB 이하만 가능합니다." };
    }
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
      transaction_type: transactionType,
      condition_grade: conditionGrade,
      components_complete: componentsComplete,
      condition_note: conditionNote,
      grade_band: gradeBand,
      subject,
      rental_start_date: rentalStartDate,
      rental_end_date: rentalEndDate,
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

  for (let i = 0; i < attachments.length; i++) {
    const file = attachments[i]!;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const path = `${user.id}/${post.id}/attachments/${i}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file);
    if (uploadError) continue;
    await supabase.from("post_attachments").insert({
      post_id: post.id,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
    });
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

export async function startRentalAction(postId: string) {
  const supabase = await createClient();
  await supabase.from("share_posts").update({ status: "renting" }).eq("id", postId);
  revalidatePath(`/share/${postId}`);
}

export async function returnRentalAction(postId: string) {
  const supabase = await createClient();
  await supabase.from("share_posts").update({ status: "returned" }).eq("id", postId);
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

export async function adminUpdateSharePostAction(
  postId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const conditionNote = String(formData.get("condition_note") ?? "").trim() || null;

  if (!title || !description) return { error: "제목과 설명은 비워둘 수 없습니다." };
  if (conditionNote && conditionNote.length > 2000) {
    return { error: "활용팁은 2000자 이하로 입력해 주세요." };
  }

  const { error } = await supabase
    .from("share_posts")
    .update({ title, description, condition_note: conditionNote })
    .eq("id", postId);
  if (error) return { error: "수정 권한이 없거나 저장에 실패했습니다." };

  revalidatePath(`/share/${postId}`);
  return { error: null };
}

export async function adminDeleteSharePostAction(postId: string) {
  const supabase = await createClient();
  await supabase.from("share_posts").delete().eq("id", postId);
  revalidatePath("/share");
  redirect("/share");
}

export async function adminDeleteShareCommentAction(postId: string, commentId: string) {
  const supabase = await createClient();
  await supabase.from("share_comments").delete().eq("id", commentId);
  revalidatePath(`/share/${postId}`);
}
