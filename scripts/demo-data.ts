/**
 * 피치용 데모 데이터. Kakao 키 없이도 학교정보 탭을 보여줄 수 있도록 가짜 학교
 * 2곳(갑을중학교, 을갑중학교)과 나눔/소모임 예시 글 몇 개를 만든다.
 * 실행: npm run demo (SUPABASE_SERVICE_ROLE_KEY 필요, npm run seed를 먼저 실행해뒀어야 함)
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
  const { data: teacher1 } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "teacher1@teachertown.test")
    .single();
  const { data: teacher2 } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "teacher2@teachertown.test")
    .single();
  const { data: itemTypes } = await supabase.from("item_types").select("id, label");

  if (!teacher1 || !teacher2 || !itemTypes || itemTypes.length === 0) {
    console.error("먼저 `npm run seed`를 실행해 주세요.");
    process.exit(1);
  }
  const itemTypeByLabel = new Map(itemTypes.map((it) => [it.label, it.id]));

  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .upsert(
      [
        { kakao_place_id: "demo-school-gabeul", name: "갑을중학교", address: "서울시 강남구", lat: 37.4979, lng: 127.0276 },
        { kakao_place_id: "demo-school-eulgab", name: "을갑중학교", address: "서울시 마포구", lat: 37.5563, lng: 126.9236 },
      ],
      { onConflict: "kakao_place_id" },
    )
    .select("id, name");
  if (schoolsError) throw schoolsError;
  console.log("학교 생성:", schools);

  const gabeul = schools!.find((s) => s.name === "갑을중학교")!;
  const eulgab = schools!.find((s) => s.name === "을갑중학교")!;

  // 학교 평가 몇 개씩 남겨서 학교 상세 화면이 비어 보이지 않게 한다.
  const { data: questions } = await supabase.from("school_review_questions").select("id").order("sort_order");
  if (questions && questions.length > 0) {
    for (const [school, reviewer, scores] of [
      [gabeul, teacher1.id, [4, 5, 3, 4, 4, 5, 4, 3]],
      [gabeul, teacher2.id, [5, 4, 4, 4, 5, 4, 5, 4]],
      [eulgab, teacher1.id, [3, 3, 2, 3, 3, 4, 3, 3]],
    ] as const) {
      await supabase.from("school_reviews").delete().eq("school_id", school.id).eq("user_id", reviewer);
      const { data: review } = await supabase
        .from("school_reviews")
        .insert({ school_id: school.id, user_id: reviewer })
        .select("id")
        .single();
      if (review) {
        await supabase.from("school_review_answers").insert(
          questions.map((q, i) => ({ review_id: review.id, question_id: q.id, score: scores[i % scores.length]! })),
        );
      }
    }
  }

  const sharePosts = [
    {
      author_id: teacher1.id,
      title: "세계사 보드게임 나눔합니다",
      description: "세계사 수업에서 3년 썼던 보드게임이에요. 상태 좋습니다. 학기말이라 정리 중이에요.",
      school_level: "secondary" as const,
      category: "교과자료",
      subject: "역사",
      grade_band: null,
      item_type_label: "보드게임",
      status: "available" as const,
      transaction_type: "share" as const,
      condition_grade: "good" as const,
    },
    {
      author_id: teacher2.id,
      title: "저학년 학급문고용 동화책 세트 대여",
      description: "저학년 학급문고로 쓰던 동화책 20권 세트입니다. 상태 양호해요.",
      school_level: "elementary" as const,
      category: "학급경영",
      subject: null,
      grade_band: "1~2학년군",
      item_type_label: "학급 도서",
      status: "reserved" as const,
      transaction_type: "rental" as const,
      condition_grade: "good" as const,
      rental_start_date: "2026-03-02",
      rental_end_date: "2026-03-16",
    },
    {
      author_id: teacher1.id,
      title: "과학 실험 키트 나눔완료",
      description: "화산 실험 키트, 이미 나눔 완료된 예시 글입니다.",
      school_level: "secondary" as const,
      category: "교과자료",
      subject: "과학",
      grade_band: null,
      item_type_label: "교구",
      status: "completed" as const,
      transaction_type: "share" as const,
      condition_grade: "fair" as const,
    },
  ];

  for (const p of sharePosts) {
    const { data: existing } = await supabase.from("share_posts").select("id").eq("title", p.title).maybeSingle();
    if (existing) continue;
    const itemTypeId = itemTypeByLabel.get(p.item_type_label)!;
    const { data: post, error } = await supabase
      .from("share_posts")
      .insert({
        author_id: p.author_id,
        title: p.title,
        description: p.description,
        school_level: p.school_level,
        category: p.category,
        subject: p.subject,
        grade_band: p.grade_band,
        item_type_id: itemTypeId,
        carbon_g: 500,
        transaction_type: p.transaction_type,
        condition_grade: p.condition_grade,
        components_complete: true,
        rental_start_date: "rental_start_date" in p ? p.rental_start_date : null,
        rental_end_date: "rental_end_date" in p ? p.rental_end_date : null,
      })
      .select("id")
      .single();
    if (error || !post) {
      console.error("나눔 글 생성 실패:", p.title, error);
      continue;
    }
    if (p.status === "reserved" || p.status === "completed") {
      const reserver = p.author_id === teacher1.id ? teacher2.id : teacher1.id;
      await supabase.from("share_posts").update({ status: "reserved", reserved_by: reserver }).eq("id", post.id);
    }
    if (p.status === "completed") {
      await supabase.from("share_posts").update({ status: "completed" }).eq("id", post.id);
    }
  }

  const clubPosts: {
    author_id: string;
    title: string;
    description: string;
    school_level: "elementary" | "secondary";
    category: string;
  }[] = [
    {
      author_id: teacher1.id,
      title: "서울 사회과 수업연구회 신입 모집",
      description: "사회과 수업자료와 게이미피케이션 수업 사례를 나누는 모임입니다. 매달 1회 모입니다.",
      school_level: "secondary",
      category: "사회",
    },
    {
      author_id: teacher2.id,
      title: "퇴근 후 러닝 크루",
      description: "일주일에 두 번, 퇴근 후 30분 가볍게 뛰는 모임이에요. 초보 환영합니다.",
      school_level: "elementary",
      category: "학급자료",
    },
  ];

  for (const p of clubPosts) {
    const { data: existing } = await supabase.from("club_posts").select("id").eq("title", p.title).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("club_posts").insert(p);
    if (error) console.error("소모임 글 생성 실패:", p.title, error);
  }

  console.log("데모 데이터 생성 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
