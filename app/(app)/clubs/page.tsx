import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CategoryFilter } from "@/components/CategoryFilter";
import type { SchoolLevel } from "@/lib/supabase/types";

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; category?: string }>;
}) {
  const { level, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("club_posts")
    .select("id, title, category, author_id, created_at")
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
      <header className="header">소모임</header>
      <div className="container" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
          <Link href="/clubs" style={{ flex: 1 }}>
            <button className="btn">모집글</button>
          </Link>
          <Link href="/clubs/meetups" style={{ flex: 1 }}>
            <button className="btn btn-secondary">번개모임</button>
          </Link>
        </div>
      </div>
      <Suspense>
        <CategoryFilter basePath="/clubs" />
      </Suspense>
      <div className="container" style={{ paddingTop: 0 }}>
        <Link href="/clubs/new">
          <button className="btn" style={{ marginBottom: 16 }}>소모임 만들기</button>
        </Link>
        {(!posts || posts.length === 0) && <div className="empty">아직 소모임 글이 없어요.</div>}
        {posts?.map((post) => (
          <Link key={post.id} href={`/clubs/${post.id}`} className="card-link">
            <div className="card">
              <p className="title">{post.title}</p>
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
