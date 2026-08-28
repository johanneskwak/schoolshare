-- 0004: club_posts, club_post_images, club_comments, RLS, 사진 2장 트리거
-- 되돌리기: drop table if exists club_comments, club_post_images, club_posts cascade;

create table if not exists club_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id),
  title text not null,
  description text not null,
  school_level text not null,
  category text not null,
  created_at timestamptz not null default now(),
  constraint club_posts_category_valid check (valid_school_category(school_level, category))
);

create index if not exists club_posts_author_idx on club_posts (author_id);

create table if not exists club_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references club_posts (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0
);

create index if not exists club_post_images_post_idx on club_post_images (post_id);

create table if not exists club_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references club_posts (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists club_comments_post_idx on club_comments (post_id);

-- enforce_image_limit()은 0003에서 정의됨 (share_post_images와 공유)
create trigger club_post_images_limit
  before insert on club_post_images
  for each row execute function enforce_image_limit(2, 'post_id');

alter table club_posts enable row level security;
alter table club_post_images enable row level security;
alter table club_comments enable row level security;

create policy club_posts_select_approved on club_posts for select using (is_approved());

create policy club_posts_insert_own on club_posts
  for insert with check (is_approved() and author_id = auth.uid());

create policy club_post_images_select_approved on club_post_images
  for select using (is_approved());

create policy club_post_images_insert_own on club_post_images
  for insert with check (
    is_approved()
    and exists (select 1 from club_posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- 소모임 댓글은 상태 개념이 없으므로(R20) 예약중 차단 트리거가 없다.
create policy club_comments_select_approved on club_comments
  for select using (is_approved());

create policy club_comments_insert_own on club_comments
  for insert with check (is_approved() and author_id = auth.uid());
