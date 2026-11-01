import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import { AdminEditPanel } from "@/components/AdminEditPanel";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { BoardCommentForm } from "./BoardCommentForm";
import { adminDeleteBoardCommentAction, adminDeleteBoardPostAction, adminUpdateBoardPostAction } from "../actions";

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = await checkIsAdmin(supabase, user?.id);

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

        {isAdmin && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <AdminEditPanel
              action={adminUpdateBoardPostAction.bind(null, post.id)}
              fields={[
                { name: "title", label: "제목", defaultValue: post.title },
                { name: "body", label: "내용", type: "textarea", defaultValue: post.body },
              ]}
            />
            <AdminDeleteButton
              onDelete={adminDeleteBoardPostAction.bind(null, post.id)}
              label="관리자: 글 삭제"
              confirmMessage="이 게시글을 삭제할까요? 되돌릴 수 없습니다."
            />
          </div>
        )}

        <h2 className="title" style={{ fontSize: 16, marginTop: 28 }}>댓글</h2>
        <BoardCommentForm postId={post.id} />
        <div style={{ marginTop: 12 }}>
          {(comments ?? []).length === 0 && <p className="muted">아직 댓글이 없어요.</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <p className="author">{nicknameById.get(c.author_id) ?? "교사"}</p>
                {isAdmin && (
                  <AdminDeleteButton
                    onDelete={adminDeleteBoardCommentAction.bind(null, post.id, c.id)}
                    label="삭제"
                    small
                    confirmMessage="이 댓글을 삭제할까요?"
                  />
                )}
              </div>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
