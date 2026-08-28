import { logoutAction } from "../(auth)/actions";

export default function PendingPage() {
  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <h1 className="title" style={{ fontSize: 20 }}>승인 대기 중입니다</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          관리자가 가입 신청을 확인하는 대로 나눔·소모임·학교정보 탭을 이용하실 수 있어요.
        </p>
        <form action={logoutAction} style={{ marginTop: 32 }}>
          <button className="btn btn-secondary" type="submit">로그아웃</button>
        </form>
      </div>
    </div>
  );
}
