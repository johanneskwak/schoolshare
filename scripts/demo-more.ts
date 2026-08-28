/**
 * 피치 데모 보강: 초등/고등 학교 예시 추가 + 나눔·소모임 글에 사진 첨부.
 * 실행: npm run demo:more (npm run seed, npm run demo를 먼저 실행해뒀어야 함)
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey);
const IMAGE_DIR = "C:\\Users\\halah\\AppData\\Local\\Temp\\claude\\G---------coding-claudecode\\ad6ed78d-5245-4807-8160-c5cb1bea9a6f\\scratchpad\\demo-images";

async function main() {
  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .upsert(
      [
        { kakao_place_id: "demo-school-gabeul-elem", name: "갑을초등학교", address: "서울시 송파구", lat: 37.5145, lng: 127.1058 },
        { kakao_place_id: "demo-school-gabeul-high", name: "갑을고등학교", address: "서울시 노원구", lat: 37.6542, lng: 127.0568 },
      ],
      { onConflict: "kakao_place_id" },
    )
    .select("id, name");
  if (schoolsError) throw schoolsError;
  console.log("학교 추가:", schools);

  const { data: teacher1 } = await supabase.from("profiles").select("id").eq("email", "teacher1@teachertown.test").single();
  const { data: teacher2 } = await supabase.from("profiles").select("id").eq("email", "teacher2@teachertown.test").single();
  const { data: questions } = await supabase.from("school_review_questions").select("id").order("sort_order");

  if (teacher1 && teacher2 && questions && questions.length > 0 && schools) {
    const elem = schools.find((s) => s.name === "갑을초등학교")!;
    const high = schools.find((s) => s.name === "갑을고등학교")!;
    for (const [school, reviewer, scores] of [
      [elem, teacher1.id, [4, 5, 4, 4, 4, 5, 4, 4]],
      [elem, teacher2.id, [5, 5, 4, 5, 4, 5, 5, 4]],
      [high, teacher1.id, [3, 4, 3, 3, 3, 3, 4, 3]],
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

  const shareImagePlan: { postTitle: string; files: string[] }[] = [
    { postTitle: "세계사 보드게임 나눔합니다", files: ["boardgame1.jpg", "boardgame2.jpg"] },
    { postTitle: "학급문고용 동화책 세트 나눔", files: ["booksclub.jpg"] },
    { postTitle: "과학 실험 키트 나눔완료", files: ["sciencekit.jpg"] },
  ];

  for (const plan of shareImagePlan) {
    const { data: post } = await supabase.from("share_posts").select("id, author_id").eq("title", plan.postTitle).maybeSingle();
    if (!post) {
      console.warn("나눔 글을 찾지 못함:", plan.postTitle);
      continue;
    }
    const { data: existingImages } = await supabase.from("share_post_images").select("id").eq("post_id", post.id);
    if (existingImages && existingImages.length > 0) continue;

    for (let i = 0; i < plan.files.length; i++) {
      const file = readFileSync(`${IMAGE_DIR}\\${plan.files[i]}`);
      const path = `${post.author_id}/${post.id}/${i}.jpg`;
      const { error: uploadError } = await supabase.storage.from("share-images").upload(path, file, { contentType: "image/jpeg" });
      if (uploadError) {
        console.error("업로드 실패:", plan.postTitle, uploadError);
        continue;
      }
      await supabase.from("share_post_images").insert({ post_id: post.id, storage_path: path, sort_order: i });
    }
    console.log("사진 첨부 완료:", plan.postTitle);
  }

  const clubImagePlan: { postTitle: string; files: string[] }[] = [
    { postTitle: "서울 사회과 수업연구회 신입 모집", files: ["clubsocial.jpg"] },
    { postTitle: "퇴근 후 러닝 크루", files: ["runningcrew.jpg"] },
  ];

  for (const plan of clubImagePlan) {
    const { data: post } = await supabase.from("club_posts").select("id, author_id").eq("title", plan.postTitle).maybeSingle();
    if (!post) {
      console.warn("소모임 글을 찾지 못함:", plan.postTitle);
      continue;
    }
    const { data: existingImages } = await supabase.from("club_post_images").select("id").eq("post_id", post.id);
    if (existingImages && existingImages.length > 0) continue;

    for (let i = 0; i < plan.files.length; i++) {
      const file = readFileSync(`${IMAGE_DIR}\\${plan.files[i]}`);
      const path = `${post.author_id}/${post.id}/${i}.jpg`;
      const { error: uploadError } = await supabase.storage.from("club-images").upload(path, file, { contentType: "image/jpeg" });
      if (uploadError) {
        console.error("업로드 실패:", plan.postTitle, uploadError);
        continue;
      }
      await supabase.from("club_post_images").insert({ post_id: post.id, storage_path: path, sort_order: i });
    }
    console.log("사진 첨부 완료:", plan.postTitle);
  }

  console.log("보강 데이터 생성 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
