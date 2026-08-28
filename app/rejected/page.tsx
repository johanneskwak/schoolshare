import { logoutAction } from "../(auth)/actions";

export default function RejectedPage() {
  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
        <h1 className="title" style={{ fontSize: 20 }}>가입이 승인되지 않았습니다</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          문의사항이 있으시면 운영자에게 연락해 주세요.
        </p>
        <form action={logoutAction} style={{ marginTop: 32 }}>
          <button className="btn btn-secondary" type="submit">로그아웃</button>
        </form>
      </div>
    </div>
  );
}
