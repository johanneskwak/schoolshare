import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signImageUrls } from "@/lib/storage/signed-url";
import { formatDate, formatFileSize } from "@/lib/format";
import { CONDITION_GRADE_LABELS, SHARE_STATUS_LABELS } from "@/lib/constants/share";
import { TransactionTypeIcon } from "@/components/TransactionTypeIcon";
import { ShareDetailActions } from "./ShareDetailActions";
import { ShareCommentForm } from "./ShareCommentForm";

export default async function ShareDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("share_posts")
    .select(
      "id, title, description, status, school_level, category, grade_band, subject, author_id, reserved_by, created_at, transaction_type, condition_grade, components_complete, condition_note, rental_start_date, rental_end_date",
    )
    .eq("id", id)
    .maybeSingle();

  if (!post) notFound();

  const [{ data: images }, { data: author }, { data: comments }, { data: attachments }] = await Promise.all([
    supabase.from("share_post_images").select("storage_path").eq("post_id", id).order("sort_order"),
    supabase.from("public_profiles").select("nickname").eq("id", post.author_id).single(),
    supabase.from("share_comments").select("id, author_id, body, created_at").eq("post_id", id).order("created_at"),
    supabase
      .from("post_attachments")
      .select("id, file_name, storage_path, file_size")
      .eq("post_id", id)
      .order("created_at"),
  ]);

  const signedUrls = await signImageUrls("share-images", (images ?? []).map((i) => i.storage_path));
  const signedAttachmentUrls = await signImageUrls(
    "post-attachments",
    (attachments ?? []).map((a) => a.storage_path),
  );

  const commentAuthorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id)));
  const { data: commentAuthors } = commentAuthorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", commentAuthorIds)
    : { data: [] };
  const nicknameById = new Map((commentAuthors ?? []).map((a) => [a.id, a.nickname]));

  const isAuthor = user?.id === post.author_id;
  const isReserver = user?.id === post.reserved_by;
  const isReserved = post.status === "reserved";
  const isRental = post.transaction_type === "rental";
  const isOverdue =
    isRental && post.status === "renting" && !!post.rental_end_date && post.rental_end_date < new Date().toISOString().slice(0, 10);

  return (
    <>
      <header className="header">{isRental ? "대여 상세" : "나눔 상세"}</header>
      <div className="container">
        <div className="badge-row">
          <span className={`tag tag-${post.status}`}>{SHARE_STATUS_LABELS[post.status]}</span>
          <span className={`tag tag-condition-${post.condition_grade}`}>
            {CONDITION_GRADE_LABELS[post.condition_grade]}
          </span>
          <TransactionTypeIcon type={post.transaction_type} className="muted" />
        </div>
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

        <table className="info-table">
          <tbody>
            <tr>
              <th>상태등급</th>
              <td>{CONDITION_GRADE_LABELS[post.condition_grade]}</td>
            </tr>
            <tr>
              <th>구성품</th>
              <td>{post.components_complete ? "구성품 모두 있음" : "구성품 일부 없음"}</td>
            </tr>
            <tr>
              <th>비고</th>
              <td>{post.condition_note ?? "-"}</td>
            </tr>
            {isRental && post.rental_start_date && post.rental_end_date && (
              <>
                <tr>
                  <th>대여 가능 기간</th>
                  <td>
                    {formatDate(post.rental_start_date)} ~ {formatDate(post.rental_end_date)}
                  </td>
                </tr>
                <tr>
                  <th>반납 예정일</th>
                  <td>{formatDate(post.rental_end_date)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {isOverdue && (
          <p className="error">반납 예정일이 지났습니다. 대여자와 반납 일정을 확인해 주세요.</p>
        )}

        {(attachments ?? []).length > 0 && (
          <>
            <h2 className="title" style={{ fontSize: 16, marginTop: 20 }}>첨부파일</h2>
            {attachments?.map((a) => (
              <a
                key={a.id}
                href={signedAttachmentUrls.get(a.storage_path)}
                target="_blank"
                rel="noreferrer"
                className="attachment-card"
              >
                <span>📎</span>
                <span className="file-name">{a.file_name}</span>
                <span className="muted">{formatFileSize(a.file_size)}</span>
              </a>
            ))}
          </>
        )}

        <div style={{ marginTop: 20 }}>
          <ShareDetailActions
            postId={post.id}
            status={post.status}
            transactionType={post.transaction_type}
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
