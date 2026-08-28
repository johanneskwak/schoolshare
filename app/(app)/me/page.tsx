import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../../(auth)/actions";
import { ProfileForm } from "./ProfileForm";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, school_id")
    .eq("id", user.id)
    .single();

  const { data: school } = profile?.school_id
    ? await supabase.from("schools").select("name, address").eq("id", profile.school_id).single()
    : { data: null };

  const { data: carbon } = await supabase
    .from("user_carbon_totals")
    .select("total_carbon_g")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: sharePosts }, { data: clubPosts }] = await Promise.all([
    supabase
      .from("share_posts")
      .select("id, title, status, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("club_posts")
      .select("id, title, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <header className="header">내 설정</header>
      <div className="container">
        <div className="stat-box">
          <div className="num">{Math.round(carbon?.total_carbon_g ?? 0)}g</div>
          <p className="muted">누적 탄소 절감량</p>
        </div>

        <h2 className="title" style={{ fontSize: 16 }}>프로필</h2>
        <ProfileForm nickname={profile?.nickname ?? ""} schoolName={school?.name ?? null} />

        <form action={logoutAction} style={{ marginTop: 8, marginBottom: 24 }}>
          <button className="btn btn-secondary" type="submit">로그아웃</button>
        </form>

        <h2 className="title" style={{ fontSize: 16 }}>내가 쓴 나눔 글</h2>
        {(!sharePosts || sharePosts.length === 0) && <p className="muted">아직 쓴 글이 없어요.</p>}
        {sharePosts?.map((p) => (
          <Link key={p.id} href={`/share/${p.id}`} className="card-link">
            <div className="card">
              <p className="title">{p.title}</p>
            </div>
          </Link>
        ))}

        <h2 className="title" style={{ fontSize: 16, marginTop: 16 }}>내가 쓴 소모임 글</h2>
        {(!clubPosts || clubPosts.length === 0) && <p className="muted">아직 쓴 글이 없어요.</p>}
        {clubPosts?.map((p) => (
          <Link key={p.id} href={`/clubs/${p.id}`} className="card-link">
            <div className="card">
              <p className="title">{p.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
