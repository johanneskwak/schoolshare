import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BoardFilter } from "./BoardFilter";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ major?: string; minor?: string }>;
}) {
  const { major, minor } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("board_posts")
    .select("id, title, major_category, minor_category, author_id, created_at")
    .order("created_at", { ascending: false });

  if (major) query = query.eq("major_category", major);
  if (minor) query = query.eq("minor_category", minor);

  const { data: posts } = await query;

  const authorIds = Array.from(new Set((posts ?? []).map((p) => p.author_id)));
  const { data: authors } = authorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", authorIds)
    : { data: [] };
  const nicknameById = new Map((authors ?? []).map((a) => [a.id, a.nickname]));

  return (
    <>
      <header className="header">게시판</header>
      <Suspense>
        <BoardFilter />
      </Suspense>
      <div className="container" style={{ paddingTop: 0 }}>
        <Link href="/board/new">
          <button className="btn" style={{ marginBottom: 16 }}>글쓰기</button>
        </Link>
        {(!posts || posts.length === 0) && <div className="empty">아직 게시글이 없어요.</div>}
        {posts?.map((post) => (
          <Link key={post.id} href={`/board/${post.id}`} className="card-link">
            <div className="card">
              <span className="tag">{post.major_category}</span>
              <p className="title" style={{ marginTop: 8 }}>{post.title}</p>
              <p className="muted">
                {post.minor_category} · {nicknameById.get(post.author_id) ?? "교사"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
