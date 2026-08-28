-- 0012: 경력단계(대분류) x 주제(소분류) 게시판. board_posts, board_comments, RLS.
-- 되돌리기: drop table if exists board_comments, board_posts cascade;
--
-- 대분류와 소분류는 학교급-카테고리와 달리 서로 독립적인 값 목록이다 (짝을 강제하지 않음).
-- lib/constants/board.ts와 반드시 동기화한다.

create table if not exists board_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id),
  title text not null,
  body text not null,
  major_category text not null check (
    major_category in ('신규적응', '저경력', '중견', '은퇴준비', '자유')
  ),
  minor_category text not null check (
    minor_category in ('수업', '업무', '인간관계', '진로', '잡담')
  ),
  created_at timestamptz not null default now()
);

create index if not exists board_posts_category_idx on board_posts (major_category, minor_category);
create index if not exists board_posts_author_idx on board_posts (author_id);

create table if not exists board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references board_posts (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists board_comments_post_idx on board_comments (post_id);

alter table board_posts enable row level security;
alter table board_comments enable row level security;

create policy board_posts_select_approved on board_posts for select using (is_approved());

create policy board_posts_insert_own on board_posts
  for insert with check (is_approved() and author_id = auth.uid());

create policy board_comments_select_approved on board_comments
  for select using (is_approved());

create policy board_comments_insert_own on board_comments
  for insert with check (is_approved() and author_id = auth.uid());
