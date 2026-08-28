-- 0003: item_types, share_posts, share_post_images, share_comments, RLS, 트리거
-- 되돌리기:
--   drop table if exists share_comments, share_post_images, share_posts, item_types cascade;
--   drop function if exists share_posts_guard_transition, enforce_image_limit, block_share_comment_when_reserved;

create table if not exists item_types (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  carbon_g numeric not null check (carbon_g >= 0)
);

create table if not exists share_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id),
  title text not null,
  description text not null,
  school_level text not null,
  category text not null,
  item_type_id uuid not null references item_types (id),
  carbon_g numeric not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'completed')),
  reserved_by uuid references profiles (id),
  reserved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint share_posts_category_valid check (valid_school_category(school_level, category))
);

create index if not exists share_posts_author_idx on share_posts (author_id);
create index if not exists share_posts_status_idx on share_posts (status);
-- 누적 탄소량 집계용 부분 인덱스 (R17)
create index if not exists share_posts_completed_author_idx
  on share_posts (author_id) where status = 'completed';

create table if not exists share_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references share_posts (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0
);

create index if not exists share_post_images_post_idx on share_post_images (post_id);

create table if not exists share_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references share_posts (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists share_comments_post_idx on share_comments (post_id);

-- 예약 전이 상태기계 + 행위자 검증. available -> reserved -> completed 만 허용하고,
-- completed에서 나가는 전이는 모두 거부한다. (R12, R13, R14)
create or replace function share_posts_guard_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 상태 전이 외의 필드는 아무도(작성자 포함) 바꿀 수 없다. RLS는 소유권으로 행을
  -- 걸러내지 않으므로(예약 시도는 타인의 글을 대상으로 해야 하니까), 여기서 막지 않으면
  -- 예약을 요청하는 승인 사용자가 title/carbon_g 같은 다른 컬럼도 함께 덮어쓸 수 있다.
  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.school_level is distinct from old.school_level
    or new.category is distinct from old.category
    or new.item_type_id is distinct from old.item_type_id
    or new.carbon_g is distinct from old.carbon_g
    or new.author_id is distinct from old.author_id
  then
    raise exception 'only status/reservation fields can be updated on share_posts';
  end if;

  if new.status = old.status then
    -- 상태가 안 바뀌었는데 reserved_by/reserved_at/completed_at만 슬쩍 바뀌는 것도 막는다.
    -- 이게 없으면 글쓴이가 이미 예약된 글(status는 그대로 'reserved')의 reserved_by를
    -- 자기 자신으로 덮어써서 남의 예약을 가로챌 수 있다.
    if new.reserved_by is distinct from old.reserved_by
      or new.reserved_at is distinct from old.reserved_at
      or new.completed_at is distinct from old.completed_at
    then
      raise exception 'reservation fields can only change together with a status transition';
    end if;
    return new;
  end if;

  if old.status = 'available' and new.status = 'reserved' then
    if new.author_id = auth.uid() then
      raise exception 'author cannot reserve own post';
    end if;
    if new.reserved_by is distinct from auth.uid() then
      raise exception 'reserved_by must be the reserving user';
    end if;
    new.reserved_at := now();
    new.completed_at := null;
    return new;
  end if;

  if old.status = 'reserved' and new.status = 'available' then
    if auth.uid() is distinct from old.reserved_by and auth.uid() is distinct from old.author_id then
      raise exception 'only the reserver or the author can cancel a reservation';
    end if;
    new.reserved_by := null;
    new.reserved_at := null;
    return new;
  end if;

  if old.status = 'reserved' and new.status = 'completed' then
    if auth.uid() is distinct from old.author_id then
      raise exception 'only the author can mark a post completed';
    end if;
    new.completed_at := now();
    return new;
  end if;

  raise exception 'invalid share_posts status transition from % to %', old.status, new.status;
end;
$$;

create trigger share_posts_guard_transition_trigger
  before update on share_posts
  for each row execute function share_posts_guard_transition();

-- 생성 시점에는 무조건 available 상태로 시작한다. INSERT 문에 status='completed' 같은
-- 값을 직접 실어 보내면 예약/완료 절차 없이 탄소량이 바로 적립되므로 여기서 강제로 막는다.
create or replace function share_posts_force_initial_state()
returns trigger
language plpgsql
as $$
begin
  new.status := 'available';
  new.reserved_by := null;
  new.reserved_at := null;
  new.completed_at := null;
  return new;
end;
$$;

create trigger share_posts_force_initial_state_trigger
  before insert on share_posts
  for each row execute function share_posts_force_initial_state();

-- 사진 개수 제한. TG_ARGV[0]=최대 장수, TG_ARGV[1]=게시글 FK 컬럼명.
create or replace function enforce_image_limit()
returns trigger
language plpgsql
as $$
declare
  max_count int := TG_ARGV[0]::int;
  current_count int;
begin
  execute format('select count(*) from %I where %I = $1', TG_TABLE_NAME, TG_ARGV[1])
    into current_count
    using new.post_id;
  if current_count >= max_count then
    raise exception '% exceeds max image count of %', TG_TABLE_NAME, max_count;
  end if;
  return new;
end;
$$;

create trigger share_post_images_limit
  before insert on share_post_images
  for each row execute function enforce_image_limit(4, 'post_id');

-- 예약중(reserved) 상태의 글에는 새 댓글을 막는다. (R15)
create or replace function block_share_comment_when_reserved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_status text;
begin
  select status into post_status from share_posts where id = new.post_id;
  if post_status = 'reserved' then
    raise exception 'cannot comment while the post is reserved';
  end if;
  return new;
end;
$$;

create trigger share_comments_block_reserved
  before insert on share_comments
  for each row execute function block_share_comment_when_reserved();

alter table item_types enable row level security;
alter table share_posts enable row level security;
alter table share_post_images enable row level security;
alter table share_comments enable row level security;

create policy item_types_select_approved on item_types for select using (is_approved());
create policy item_types_write_admin on item_types for all using (is_admin()) with check (is_admin());

create policy share_posts_select_approved on share_posts for select using (is_approved());

create policy share_posts_insert_own on share_posts
  for insert with check (is_approved() and author_id = auth.uid());

-- 예약/취소/완료를 모두 이 하나의 정책으로 허용하고, 실제 상태기계 검증은 트리거가 한다.
create policy share_posts_update on share_posts
  for update
  using (is_approved() and (status = 'available' or author_id = auth.uid() or reserved_by = auth.uid()))
  with check (is_approved());

create policy share_post_images_select_approved on share_post_images
  for select using (is_approved());

create policy share_post_images_insert_own on share_post_images
  for insert with check (
    is_approved()
    and exists (select 1 from share_posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy share_comments_select_approved on share_comments
  for select using (is_approved());

create policy share_comments_insert_own on share_comments
  for insert with check (is_approved() and author_id = auth.uid());
