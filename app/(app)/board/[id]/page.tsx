import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardCommentForm } from "./BoardCommentForm";

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("board_posts")
    .select("id, title, body, major_category, minor_category, author_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!post) notFound();

  const [{ data: author }, { data: comments }] = await Promise.all([
    supabase.from("public_profiles").select("nickname").eq("id", post.author_id).single(),
    supabase.from("board_comments").select("id, author_id, body, created_at").eq("post_id", id).order("created_at"),
  ]);

  const commentAuthorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id)));
  const { data: commentAuthors } = commentAuthorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", commentAuthorIds)
    : { data: [] };
  const nicknameById = new Map((commentAuthors ?? []).map((a) => [a.id, a.nickname]));

  return (
    <>
      <header className="header">게시판</header>
      <div className="container">
        <span className="tag">{post.major_category}</span>
        <h1 className="title" style={{ fontSize: 20, marginTop: 8 }}>{post.title}</h1>
        <p className="muted">
          {post.minor_category} · {author?.nickname ?? "교사"}
        </p>

        <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{post.body}</p>

        <h2 className="title" style={{ fontSize: 16, marginTop: 28 }}>댓글</h2>
        <BoardCommentForm postId={post.id} />
        <div style={{ marginTop: 12 }}>
          {(comments ?? []).length === 0 && <p className="muted">아직 댓글이 없어요.</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <p className="author">{nicknameById.get(c.author_id) ?? "교사"}</p>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
