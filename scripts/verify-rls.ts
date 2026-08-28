/**
 * RLS·제약 조건 검증 스크립트. (T20, Verification - Agent 4~7, 12)
 *
 * 이 저장소를 만든 환경에는 Docker가 없어 로컬 Supabase 스택(`supabase start`)을
 * 띄울 수 없었다. 이 스크립트는 실제 실행 전이며, 사람이 다음 순서로 돌려야 한다.
 *
 *   1. Docker 설치 + `npx supabase start` (또는 원격 프로젝트 사용)
 *   2. `npx supabase db reset` 으로 마이그레이션 적용
 *   3. `.env.local`에 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY 채우기
 *   4. `npm run seed`
 *   5. `npm run verify`
 *
 * 카카오 호출 횟수 검증(AC18~AC20)은 실제 KAKAO_REST_API_KEY와 네트워크 호출이 필요해
 * 이 스크립트 범위 밖이다 — `/api/schools/search`를 두 번 호출해 응답 시간/결과로 간접
 * 확인하거나, 별도 통합 테스트에서 fetch를 스텁으로 감싸 확인한다.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("환경 변수가 필요합니다: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const service = createClient<Database>(url, serviceKey);

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS  ${label}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}`);
    failed++;
  }
}

async function signInAs(email: string) {
  const client = createClient<Database>(url!, anonKey!);
  const { error } = await client.auth.signInWithPassword({ email, password: "seed-pass-0001" });
  if (error) throw new Error(`sign in failed for ${email}: ${error.message}`);
  return client;
}

async function main() {
  const { data: teacher1 } = await service.from("profiles").select("id").eq("email", "teacher1@teachertown.test").single();
  const { data: teacher2 } = await service.from("profiles").select("id").eq("email", "teacher2@teachertown.test").single();
  const { data: teacher3 } = await service.from("profiles").select("id").eq("email", "teacher3@teachertown.test").single();
  const { data: school } = await service.from("schools").select("id").eq("kakao_place_id", "seed-school-001").single();
  const { data: itemType } = await service.from("item_types").select("id, carbon_g").eq("label", "보드게임").single();

  if (!teacher1 || !teacher2 || !teacher3 || !school || !itemType) {
    console.error("시드 데이터가 없습니다. 먼저 `npm run seed`를 실행하세요.");
    process.exit(1);
  }

  // AC3: 미승인 토큰으로 share_posts 조회 시 0행
  const unapproved = await signInAs("teacher3@teachertown.test");
  const { data: unapprovedShare } = await unapproved.from("share_posts").select("id");
  check("AC3 미승인 사용자는 share_posts를 0행으로 본다", (unapprovedShare ?? []).length === 0);

  const { data: unapprovedClub } = await unapproved.from("club_posts").select("id");
  check("AC3 미승인 사용자는 club_posts를 0행으로 본다", (unapprovedClub ?? []).length === 0);

  const { data: unapprovedReview } = await unapproved.from("school_reviews").select("id");
  check("AC3 미승인 사용자는 school_reviews를 0행으로 본다", (unapprovedReview ?? []).length === 0);

  const approved1 = await signInAs("teacher1@teachertown.test");
  const approved2 = await signInAs("teacher2@teachertown.test");

  // AC4: 학교급-카테고리 불일치
  const { error: badCategoryError } = await approved1.from("share_posts").insert({
    author_id: teacher1.id,
    title: "제약 테스트",
    description: "설명",
    school_level: "elementary",
    category: "수학",
    item_type_id: itemType.id,
    carbon_g: itemType.carbon_g,
  });
  check("AC4 elementary+수학 조합은 제약 위반으로 거부된다", badCategoryError != null);

  // 정상 나눔 글 생성 (이후 테스트에서 재사용)
  const { data: post, error: postError } = await approved1
    .from("share_posts")
    .insert({
      author_id: teacher1.id,
      title: "RLS 테스트용 글",
      description: "설명",
      school_level: "secondary",
      category: "과학",
      item_type_id: itemType.id,
      carbon_g: itemType.carbon_g,
    })
    .select("id")
    .single();
  check("나눔 글 생성 성공", postError == null && post != null);

  if (post) {
    // AC6: 사진 5장 거부, 4장 허용
    for (let i = 0; i < 4; i++) {
      await approved1.from("share_post_images").insert({ post_id: post.id, storage_path: `t/${i}.jpg`, sort_order: i });
    }
    const { error: fifthImageError } = await approved1
      .from("share_post_images")
      .insert({ post_id: post.id, storage_path: "t/4.jpg", sort_order: 4 });
    check("AC6 사진 5번째 첨부는 거부된다", fifthImageError != null);

    // AC7: 예약 성공 + 중복 예약 실패
    const { error: reserveError } = await approved2
      .from("share_posts")
      .update({ status: "reserved", reserved_by: teacher2.id })
      .eq("id", post.id);
    check("AC7 승인 사용자는 available 글을 예약할 수 있다", reserveError == null);

    const approved3AlreadyReserved = await approved1
      .from("share_posts")
      .update({ status: "reserved", reserved_by: teacher1.id })
      .eq("id", post.id)
      .select();
    check(
      "AC7 이미 reserved인 글은 다시 예약할 수 없다",
      (approved3AlreadyReserved.data ?? []).length === 0 || approved3AlreadyReserved.error != null,
    );

    // AC8: reserved 상태에서 댓글 거부
    const { error: reservedCommentError } = await approved1
      .from("share_comments")
      .insert({ post_id: post.id, author_id: teacher1.id, body: "예약중 댓글" });
    check("AC8 예약중인 글에는 댓글이 거부된다", reservedCommentError != null);

    // AC9: 취소 -> available, completed -> available 되돌리기 실패
    const { error: cancelError } = await approved2
      .from("share_posts")
      .update({ status: "available" })
      .eq("id", post.id);
    check("AC9 예약자는 예약을 취소할 수 있다", cancelError == null);

    await approved2.from("share_posts").update({ status: "reserved", reserved_by: teacher2.id }).eq("id", post.id);
    const { error: completeError } = await approved1
      .from("share_posts")
      .update({ status: "completed" })
      .eq("id", post.id);
    check("AC9/AC10 작성자는 reserved 글을 completed로 바꿀 수 있다", completeError == null);

    const { error: revertError } = await approved1
      .from("share_posts")
      .update({ status: "available" })
      .eq("id", post.id);
    check("AC9 completed에서 되돌리기는 거부된다", revertError != null);

    // AC10: 탄소 합계
    const { data: carbonTotal } = await approved1
      .from("user_carbon_totals")
      .select("total_carbon_g")
      .eq("user_id", teacher1.id)
      .maybeSingle();
    check(
      `AC10 완료된 글의 탄소량이 합산된다 (실측: ${carbonTotal?.total_carbon_g})`,
      Number(carbonTotal?.total_carbon_g ?? 0) >= Number(itemType.carbon_g),
    );
  }

  // AC14: 평균 별점
  const { data: questions } = await service.from("school_review_questions").select("id").limit(1);
  const questionId = questions?.[0]?.id;
  if (questionId) {
    for (const [client, uid, score] of [
      [approved1, teacher1.id, 4],
      [approved2, teacher2.id, 5],
    ] as const) {
      await client.from("school_reviews").delete().eq("school_id", school.id).eq("user_id", uid);
      const { data: review } = await client
        .from("school_reviews")
        .insert({ school_id: school.id, user_id: uid })
        .select("id")
        .single();
      if (review) {
        await client.from("school_review_answers").insert({ review_id: review.id, question_id: questionId, score });
      }
    }
    const { data: summary } = await approved1
      .from("school_rating_summary")
      .select("avg_score")
      .eq("school_id", school.id)
      .eq("question_id", questionId)
      .maybeSingle();
    check(`AC14 평균이 4.5로 계산된다 (실측: ${summary?.avg_score})`, Number(summary?.avg_score) === 4.5);

    await approved1.from("school_reviews").delete().eq("school_id", school.id).eq("user_id", teacher1.id);
    const { data: review2 } = await approved1
      .from("school_reviews")
      .insert({ school_id: school.id, user_id: teacher1.id })
      .select("id")
      .single();
    if (review2) {
      await approved1.from("school_review_answers").insert({ review_id: review2.id, question_id: questionId, score: 3 });
    }
    const { data: summary2 } = await approved1
      .from("school_rating_summary")
      .select("avg_score")
      .eq("school_id", school.id)
      .eq("question_id", questionId)
      .maybeSingle();
    check(`AC14 재평가 후 평균이 4.0으로 바뀐다 (실측: ${summary2?.avg_score})`, Number(summary2?.avg_score) === 4.0);
  }

  // AC16: 닉네임 중복
  const { error: dupNicknameError } = await approved2.from("profiles").update({ nickname: "teacher1" }).eq("id", teacher2.id);
  check("AC16 이미 쓰이는 닉네임으로 저장은 실패한다", dupNicknameError != null);

  // AC22: 승인 교사 토큰으로 schools/cache에 직접 INSERT 시도
  const { error: schoolsInsertError } = await approved1.from("schools").insert({
    kakao_place_id: "should-fail",
    name: "무단 삽입 테스트",
  });
  check("AC22 승인 교사는 schools에 직접 INSERT할 수 없다", schoolsInsertError != null);

  const { error: cacheInsertError } = await approved1.from("school_search_cache").insert({ query_key: "should-fail" });
  check("AC22 승인 교사는 school_search_cache에 직접 INSERT할 수 없다", cacheInsertError != null);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
