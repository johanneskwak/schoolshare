/**
 * 시드 스크립트. 관리자 1명, 승인 교사 2명, 미승인 교사 1명, 기본 item_types,
 * 기본 평가 질문을 만든다. (T20)
 *
 * 실행: Supabase 로컬/원격 프로젝트의 .env.local이 채워진 뒤 `npm run seed`.
 * SUPABASE_SERVICE_ROLE_KEY가 필요하다 (auth.admin API 사용).
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

async function createUser(email: string, password: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function main() {
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .upsert(
      { kakao_place_id: "seed-school-001", name: "서울 시드중학교", address: "서울시 중구", lat: 37.56, lng: 126.99 },
      { onConflict: "kakao_place_id" },
    )
    .select("id")
    .single();
  if (schoolError) throw schoolError;

  const adminId = await createUser("admin@teachertown.test", "seed-pass-0001");
  const teacher1Id = await createUser("teacher1@teachertown.test", "seed-pass-0001");
  const teacher2Id = await createUser("teacher2@teachertown.test", "seed-pass-0001");
  const teacher3Id = await createUser("teacher3@teachertown.test", "seed-pass-0001");

  await supabase.from("profiles").upsert([
    {
      id: adminId,
      email: "admin@teachertown.test",
      full_name: "관리자",
      nickname: "admin",
      school_id: school.id,
      role: "admin",
      status: "approved",
    },
    {
      id: teacher1Id,
      email: "teacher1@teachertown.test",
      full_name: "교사1",
      nickname: "teacher1",
      school_id: school.id,
      role: "teacher",
      status: "approved",
    },
    {
      id: teacher2Id,
      email: "teacher2@teachertown.test",
      full_name: "교사2",
      nickname: "teacher2",
      school_id: school.id,
      role: "teacher",
      status: "approved",
    },
    {
      id: teacher3Id,
      email: "teacher3@teachertown.test",
      full_name: "교사3(미승인)",
      nickname: "teacher3",
      school_id: school.id,
      role: "teacher",
      status: "pending",
    },
  ]);

  await supabase.from("item_types").insert([
    { label: "보드게임", carbon_g: 500 },
    { label: "학급 도서", carbon_g: 300 },
    { label: "교구", carbon_g: 800 },
  ]);

  await supabase.from("school_review_questions").insert([
    { text: "시설", sort_order: 1 },
    { text: "동료교사 분위기", sort_order: 2 },
    { text: "관리자 문화", sort_order: 3 },
    { text: "업무 합리성", sort_order: 4 },
    { text: "복무 사용 편의성", sort_order: 5 },
    { text: "육아친화 문화", sort_order: 6 },
    { text: "수업 자율성", sort_order: 7 },
    { text: "회의·행정 효율", sort_order: 8 },
  ]);

  console.log("시드 완료");
  console.log({ adminId, teacher1Id, teacher2Id, teacher3Id, schoolId: school.id });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
