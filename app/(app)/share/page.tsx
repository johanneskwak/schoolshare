import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CategoryFilter } from "@/components/CategoryFilter";
import type { SchoolLevel, SharePostStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<SharePostStatus, string> = {
  available: "나눔중",
  reserved: "예약중",
  completed: "나눔완료",
};

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; category?: string }>;
}) {
  const { level, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("share_posts")
    .select("id, title, status, school_level, category, author_id, created_at")
    .order("created_at", { ascending: false });

  if (level) query = query.eq("school_level", level as SchoolLevel);
  if (category) query = query.eq("category", category);

  const { data: posts } = await query;

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const { data: authors } = authorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", authorIds)
    : { data: [] };
  const nicknameById = new Map((authors ?? []).map((a) => [a.id, a.nickname]));

  return (
    <>
      <header className="header">나눔</header>
      <Suspense>
        <CategoryFilter basePath="/share" />
      </Suspense>
      <div className="container" style={{ paddingTop: 0 }}>
        <Link href="/share/new">
          <button className="btn" style={{ marginBottom: 16 }}>나눔 글쓰기</button>
        </Link>
        {(!posts || posts.length === 0) && <div className="empty">아직 나눔 글이 없어요.</div>}
        {posts?.map((post) => (
          <Link key={post.id} href={`/share/${post.id}`} className="card-link">
            <div className="card">
              <span className={`tag tag-${post.status}`}>{STATUS_LABEL[post.status]}</span>
              <p className="title" style={{ marginTop: 8 }}>{post.title}</p>
              <p className="muted">
                {post.category} · {nicknameById.get(post.author_id) ?? "교사"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
