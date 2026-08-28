import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { signImageUrls } from "@/lib/storage/signed-url";
import { ShareFilterBar } from "./ShareFilterBar";
import { TransactionTypeIcon } from "@/components/TransactionTypeIcon";
import { CONDITION_GRADE_LABELS, SHARE_STATUS_LABELS } from "@/lib/constants/share";
import type { ConditionGrade, SchoolLevel, TransactionType } from "@/lib/supabase/types";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{
    level?: string;
    category?: string;
    grade_band?: string;
    subject?: string;
    transaction_type?: string;
    condition_grade?: string;
  }>;
}) {
  const { level, category, grade_band, subject, transaction_type, condition_grade } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("share_posts")
    .select(
      "id, title, status, school_level, category, grade_band, subject, transaction_type, condition_grade, author_id, created_at",
    )
    .order("created_at", { ascending: false });

  if (level) query = query.eq("school_level", level as SchoolLevel);
  if (category) query = query.eq("category", category);
  if (grade_band) query = query.eq("grade_band", grade_band);
  if (subject) query = query.eq("subject", subject);
  if (transaction_type) query = query.eq("transaction_type", transaction_type as TransactionType);
  if (condition_grade) query = query.eq("condition_grade", condition_grade as ConditionGrade);

  const { data: posts } = await query;

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const { data: authors } = authorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", authorIds)
    : { data: [] };
  const nicknameById = new Map((authors ?? []).map((a) => [a.id, a.nickname]));

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: images } = postIds.length
    ? await supabase
        .from("share_post_images")
        .select("post_id, storage_path, sort_order")
        .in("post_id", postIds)
        .order("sort_order")
    : { data: [] };
  const thumbPathByPost = new Map<string, string>();
  for (const img of images ?? []) {
    if (!thumbPathByPost.has(img.post_id)) thumbPathByPost.set(img.post_id, img.storage_path);
  }
  const signedThumbUrls = await signImageUrls("share-images", Array.from(thumbPathByPost.values()));

  const hasFilter = !!(level || category || grade_band || subject || transaction_type || condition_grade);

  return (
    <>
      <header className="header">나눔</header>
      <Suspense>
        <ShareFilterBar />
      </Suspense>
      <div className="container" style={{ paddingTop: 0 }}>
        <Link href="/share/new">
          <button className="btn" style={{ marginBottom: 16 }}>나눔/대여 글쓰기</button>
        </Link>
        {(!posts || posts.length === 0) && (
          <div className="empty">{hasFilter ? "조건에 맞는 글이 없어요." : "아직 나눔 글이 없어요."}</div>
        )}
        {posts?.map((post) => {
          const thumbPath = thumbPathByPost.get(post.id);
          const thumbUrl = thumbPath ? signedThumbUrls.get(thumbPath) : undefined;
          return (
            <Link key={post.id} href={`/share/${post.id}`} className="card-link">
              <div className="card">
                {thumbUrl && <img className="card-thumb" src={thumbUrl} alt={post.title} />}
                <div className="badge-row">
                  <span className={`tag tag-${post.status}`}>{SHARE_STATUS_LABELS[post.status]}</span>
                  <span className={`tag tag-condition-${post.condition_grade}`}>
                    {CONDITION_GRADE_LABELS[post.condition_grade]}
                  </span>
                  <TransactionTypeIcon type={post.transaction_type} className="muted" />
                </div>
                <p className="title" style={{ marginTop: 8 }}>{post.title}</p>
                <p className="muted">{post.category}</p>
                {post.grade_band && <p className="muted">{post.grade_band}</p>}
                {post.subject && <p className="muted">{post.subject}</p>}
                <p className="muted">{nicknameById.get(post.author_id) ?? "교사"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
