/**
 * 게시판/번개모임 피치 데모 데이터.
 * 실행: npm run demo:board (npm run seed를 먼저 실행해뒀어야 함, 0010/0011 마이그레이션 필요)
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey);

async function main() {
  const { data: teacher1 } = await supabase.from("profiles").select("id").eq("email", "teacher1@teachertown.test").single();
  const { data: teacher2 } = await supabase.from("profiles").select("id").eq("email", "teacher2@teachertown.test").single();

  if (!teacher1 || !teacher2) {
    console.error("먼저 `npm run seed`를 실행하세요.");
    process.exit(1);
  }

  const boardPosts = [
    {
      author_id: teacher1.id,
      title: "발령 첫 주, 이것만은 미리 아세요",
      body: "저도 3월 첫 주에 정신없었는데, 교무수첩 정리랑 학부모 연락망부터 챙기시면 한결 편해요.",
      major_category: "신규적응",
      minor_category: "업무",
    },
    {
      author_id: teacher2.id,
      title: "1~2년차 때 수업 자료 어디서 구하세요?",
      body: "인디스쿨도 좋은데, 교과 커뮤니티 카페도 추천드려요. 같이 정보 공유해요!",
      major_category: "저경력",
      minor_category: "수업",
    },
    {
      author_id: teacher1.id,
      title: "명예퇴직 준비, 연금 상담은 언제쯤?",
      body: "명퇴 2년 전부터 공무원연금공단 상담 받아보시는 걸 추천해요. 경험 공유합니다.",
      major_category: "은퇴준비",
      minor_category: "진로",
    },
  ];

  for (const p of boardPosts) {
    const { data: existing } = await supabase.from("board_posts").select("id").eq("title", p.title).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("board_posts").insert(p);
    if (error) console.error("게시글 생성 실패:", p.title, error);
  }

  const events = [
    {
      author_id: teacher1.id,
      title: "저경력 교사 번개",
      event_date: "2026-09-01",
      location: "노량진 KFC",
      description: "퇴근하고 가볍게 치킨 먹으면서 수다떨어요.",
    },
    {
      author_id: teacher2.id,
      title: "신규교사 친목 모임",
      event_date: "2026-09-05",
      location: "노량진 맥도날드",
      description: "발령 첫 해 선생님들 환영합니다!",
    },
  ];

  for (const e of events) {
    const { data: existing } = await supabase
      .from("club_events")
      .select("id")
      .eq("title", e.title)
      .eq("event_date", e.event_date)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("club_events").insert(e);
    if (error) console.error("번개모임 생성 실패:", e.title, error);
  }

  console.log("게시판/번개모임 데모 데이터 생성 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
