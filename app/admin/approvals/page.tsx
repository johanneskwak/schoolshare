import { createClient } from "@/lib/supabase/server";
import { ApprovalRow } from "./ApprovalRow";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at, school_id")
    .eq("status", "pending")
    .order("created_at");

  const schoolIds = Array.from(new Set((pending ?? []).map((p) => p.school_id).filter((v): v is string => !!v)));
  const { data: schools } = schoolIds.length
    ? await supabase.from("schools").select("id, name").in("id", schoolIds)
    : { data: [] };
  const schoolNameById = new Map((schools ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="container">
      <h1 className="title" style={{ fontSize: 18, margin: "16px 0" }}>가입 승인 대기</h1>
      {(!pending || pending.length === 0) && <p className="empty">대기 중인 가입이 없습니다.</p>}
      {pending?.map((p) => (
        <ApprovalRow
          key={p.id}
          id={p.id}
          email={p.email}
          fullName={p.full_name}
          schoolName={p.school_id ? schoolNameById.get(p.school_id) ?? "-" : "-"}
          createdAt={p.created_at}
        />
      ))}
    </div>
  );
}
