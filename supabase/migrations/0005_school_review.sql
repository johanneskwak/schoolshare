-- 0005: school_review_questions, school_reviews, school_review_answers, RLS,
-- 점수 제약, 평점 요약 뷰
-- 되돌리기:
--   drop view if exists school_rating_summary, school_review_participant_counts;
--   drop table if exists school_review_answers, school_reviews, school_review_questions cascade;

create table if not exists school_review_questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists school_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id),
  user_id uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create index if not exists school_reviews_school_idx on school_reviews (school_id);

create table if not exists school_review_answers (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references school_reviews (id) on delete cascade,
  question_id uuid not null references school_review_questions (id),
  score int not null check (score between 1 and 5),
  unique (review_id, question_id)
);

create index if not exists school_review_answers_review_idx on school_review_answers (review_id);
create index if not exists school_review_answers_question_idx on school_review_answers (question_id);

alter table school_review_questions enable row level security;
alter table school_reviews enable row level security;
alter table school_review_answers enable row level security;

-- 질문 목록은 활성/비활성 모두 승인 사용자에게 보인다. "새 평가 화면에서 숨긴다"는
-- 화면단 필터이며(R26), 기존 평균·답변이 계속 보이려면 여기서 걸러지면 안 된다.
create policy school_review_questions_select_approved on school_review_questions
  for select using (is_approved());

create policy school_review_questions_write_admin on school_review_questions
  for all using (is_admin()) with check (is_admin());

create policy school_reviews_select_approved on school_reviews
  for select using (is_approved());

create policy school_reviews_insert_own on school_reviews
  for insert with check (is_approved() and user_id = auth.uid());

-- 재평가는 기존 리뷰를 지우고 새로 만드는 방식(delete + insert)으로 덮어쓴다. (R24)
create policy school_reviews_delete_own on school_reviews
  for delete using (is_approved() and user_id = auth.uid());

create policy school_review_answers_select_approved on school_review_answers
  for select using (is_approved());

create policy school_review_answers_insert_own on school_review_answers
  for insert with check (
    is_approved()
    and exists (select 1 from school_reviews r where r.id = review_id and r.user_id = auth.uid())
  );

-- 학교당·질문당 평균 별점과 답변 수. security_invoker=true로 기저 테이블의 RLS가
-- 그대로 적용되게 한다. 뷰가 RLS 우회 통로가 되면 미승인 사용자도 통계를 볼 수 있게 된다.
create view school_rating_summary
with (security_invoker = true) as
select
  r.school_id,
  q.id as question_id,
  q.text as question_text,
  round(avg(a.score)::numeric, 1) as avg_score,
  count(a.score) as answer_count
from school_review_questions q
join school_review_answers a on a.question_id = q.id
join school_reviews r on r.id = a.review_id
group by r.school_id, q.id, q.text;

-- 학교별 참여자 수(리뷰를 남긴 사용자 수). 전체 평균은 애플리케이션에서
-- school_rating_summary 행들을 평균하여 계산한다.
create view school_review_participant_counts
with (security_invoker = true) as
select school_id, count(*) as participant_count
from school_reviews
group by school_id;
