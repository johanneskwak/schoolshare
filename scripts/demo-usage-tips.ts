/**
 * "활용팁"(condition_note) 샘플 데이터. 물건이 어떤 교육과정 성취기준·단원에 쓰기 좋은지
 * 자세히 적은 나눔/대여 글 예시를 만들고, 기존 데모 글에도 활용팁을 채워 넣는다.
 * 실행: npm run demo:tips (npm run seed, npm run demo를 먼저 실행해뒀어야 함, 0017 마이그레이션 필요)
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
  const { data: itemTypes } = await supabase.from("item_types").select("id, label");

  if (!teacher1 || !teacher2 || !itemTypes) {
    console.error("먼저 `npm run seed`와 `npm run demo`를 실행해 주세요.");
    process.exit(1);
  }
  const itemTypeByLabel = new Map(itemTypes.map((it) => [it.label, it.id]));

  // condition_note(활용팁)는 상태 전이 트리거가 생성 후 수정을 막기 때문에(0014의
  // share_posts_guard_transition — status 외 필드는 UPDATE 자체가 거부된다), 기존 글은
  // 건드리지 않고 활용팁이 채워진 새 샘플 글만 만든다.
  const newPosts = [
    {
      author_id: teacher1.id,
      title: "분수 막대 교구 세트 나눔",
      description: "분수 개념 도입용 나무 분수막대 세트입니다. 한 학급 분량(모둠당 1세트, 6세트)이에요.",
      school_level: "elementary" as const,
      category: "교과자료",
      subject: "수학",
      grade_band: "3~4학년군",
      item_type_label: "교구",
      transaction_type: "share" as const,
      condition_grade: "good" as const,
      condition_note:
        "2022 개정 수학과 [4수01-12](분모가 같은 분수의 크기 비교) 단원에 딱 맞습니다. " +
        "모둠별로 막대를 겹쳐보며 1/2, 1/3, 1/4를 직접 비교하게 하면 추상적인 분수 개념이 " +
        "훨씬 쉽게 와닿아요. 3학년 2학기 '분수' 단원 1~2차시(개념 도입)에 활용을 추천합니다. " +
        "수업 후 분수막대로 '같은 크기 만들기' 게임을 추가하면 놀이 수학으로도 이어져요.",
    },
    {
      author_id: teacher2.id,
      title: "세계지도 퍼즐 대여합니다",
      description: "대륙·나라별로 조각난 세계지도 바닥 퍼즐이에요. 가로 1.5m 크기라 모둠 활동에 좋습니다.",
      school_level: "elementary" as const,
      category: "교과자료",
      subject: "사회",
      grade_band: "5~6학년군",
      item_type_label: "교구",
      transaction_type: "rental" as const,
      condition_grade: "like_new" as const,
      rental_start_date: "2026-09-08",
      rental_end_date: "2026-09-19",
      condition_note:
        "사회과 [6사07-01](세계 여러 대륙과 대양의 위치와 범위) 성취기준용 교구입니다. " +
        "모둠을 대륙별로 나눠 퍼즐을 맞춘 뒤, 각 대륙의 대표 나라 3개를 조사해 지도 위에 " +
        "깃발 스티커를 붙이는 활동으로 확장하면 좋아요. 5학년 1학기 세계지리 단원 " +
        "도입 차시(1~2차시)에 추천합니다. 대여 기간 2주 동안 학년 전체 반이 순환해서 쓰기 좋아요.",
    },
    {
      author_id: teacher1.id,
      title: "저학년 낱말카드 세트 나눔",
      description: "그림과 낱말이 짝지어진 한글 낱말카드 100장 세트입니다. 코팅되어 있어 오래 씁니다.",
      school_level: "elementary" as const,
      category: "교과자료",
      subject: "국어",
      grade_band: "1~2학년군",
      item_type_label: "학급 도서",
      transaction_type: "share" as const,
      condition_grade: "good" as const,
      condition_note:
        "국어과 1~2학년군 [2국04-01](한글의 자모 이름과 소릿값) 성취기준과 바로 연결돼요. " +
        "짝 활동으로 그림카드를 보고 낱말을 맞히는 게임, 또는 낱말카드를 자음/모음별로 " +
        "분류하는 활동으로 쓸 수 있습니다. 1학년 1학기 한글 학습 초기(3~4주차)에 특히 유용해요.",
    },
    {
      author_id: teacher2.id,
      title: "아두이노 피지컬컴퓨팅 키트 나눔",
      description: "센서·LED·브레드보드가 포함된 아두이노 기본 키트 5세트입니다. 설명서도 같이 드려요.",
      school_level: "secondary" as const,
      category: "교과자료",
      subject: "정보",
      grade_band: null,
      item_type_label: "교구",
      transaction_type: "share" as const,
      condition_grade: "fair" as const,
      condition_note:
        "정보과 [9정04-02](피지컬 컴퓨팅 장치를 이용한 문제 해결) 성취기준용 실습 키트예요. " +
        "1차시는 LED 점멸 회로로 기초 배선을 익히고, 2~3차시에 온도·조도 센서로 자동 조명을 " +
        "만드는 프로젝트 수업으로 확장하면 좋습니다. 중학교 3학년 정보 교과 피지컬 컴퓨팅 " +
        "단원(중단원 2)에서 실제로 3주간 사용했던 키트입니다.",
    },
  ];

  for (const p of newPosts) {
    const { data: existing } = await supabase.from("share_posts").select("id").eq("title", p.title).maybeSingle();
    if (existing) {
      console.log("이미 있음, 건너뜀:", p.title);
      continue;
    }
    const itemTypeId = itemTypeByLabel.get(p.item_type_label);
    if (!itemTypeId) {
      console.error("품목 유형을 찾지 못함:", p.item_type_label);
      continue;
    }
    const { error } = await supabase.from("share_posts").insert({
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
      condition_note: p.condition_note,
      rental_start_date: "rental_start_date" in p ? p.rental_start_date : null,
      rental_end_date: "rental_end_date" in p ? p.rental_end_date : null,
    });
    if (error) console.error("생성 실패:", p.title, error);
    else console.log("생성 완료:", p.title);
  }

  console.log("활용팁 데모 데이터 생성 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
