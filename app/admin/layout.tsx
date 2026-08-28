import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <header className="header">관리자</header>
      <div className="container" style={{ display: "flex", gap: 12, paddingTop: 0 }}>
        <Link href="/admin/approvals" style={{ fontWeight: 600 }}>가입 승인</Link>
        <Link href="/admin/questions" style={{ fontWeight: 600 }}>평가 질문</Link>
      </div>
      {children}
    </div>
  );
}
