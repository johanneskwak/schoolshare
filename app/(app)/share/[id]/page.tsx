import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signImageUrls } from "@/lib/storage/signed-url";
import { ShareDetailActions } from "./ShareDetailActions";
import { ShareCommentForm } from "./ShareCommentForm";
import type { SharePostStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<SharePostStatus, string> = {
  available: "나눔중",
  reserved: "예약중",
  completed: "나눔완료",
};

export default async function ShareDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("share_posts")
    .select("id, title, description, status, school_level, category, author_id, reserved_by, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!post) notFound();

  const [{ data: images }, { data: author }, { data: comments }] = await Promise.all([
    supabase.from("share_post_images").select("storage_path").eq("post_id", id).order("sort_order"),
    supabase.from("public_profiles").select("nickname").eq("id", post.author_id).single(),
    supabase.from("share_comments").select("id, author_id, body, created_at").eq("post_id", id).order("created_at"),
  ]);

  const signedUrls = await signImageUrls("share-images", (images ?? []).map((i) => i.storage_path));

  const commentAuthorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id)));
  const { data: commentAuthors } = commentAuthorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", commentAuthorIds)
    : { data: [] };
  const nicknameById = new Map((commentAuthors ?? []).map((a) => [a.id, a.nickname]));

  const isAuthor = user?.id === post.author_id;
  const isReserver = user?.id === post.reserved_by;
  const isReserved = post.status === "reserved";

  return (
    <>
      <header className="header">나눔 상세</header>
      <div className="container">
        <span className={`tag tag-${post.status}`}>{STATUS_LABEL[post.status]}</span>
        <h1 className="title" style={{ fontSize: 20, marginTop: 8 }}>{post.title}</h1>
        <p className="muted">
          {post.category} · {author?.nickname ?? "교사"}
        </p>

        {signedUrls.size > 0 && (
          <div className="image-grid" style={{ marginTop: 16 }}>
            {(images ?? []).map((img) => (
              <img key={img.storage_path} src={signedUrls.get(img.storage_path)} alt={post.title} />
            ))}
          </div>
        )}

        <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{post.description}</p>

        <div style={{ marginTop: 20 }}>
          <ShareDetailActions
            postId={post.id}
            status={post.status}
            isAuthor={isAuthor}
            isReserver={isReserver}
          />
        </div>

        <h2 className="title" style={{ fontSize: 16, marginTop: 28 }}>댓글</h2>
        {isReserved && (
          <p className="muted" style={{ marginBottom: 8 }}>예약중인 글에는 새 댓글을 쓸 수 없습니다.</p>
        )}
        <ShareCommentForm postId={post.id} disabled={isReserved} />
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
