-- 0010: 나눔/대여 통합 스키마. share_posts에 거래유형·물건상태·대여·학년군·교과목 컬럼을
-- 추가하고, 카테고리 체계를 학교급 무관 3값으로 교체하며, 상태 전이 트리거를 대여
-- 흐름(available -> reserved -> renting -> returned)까지 확장한다.
-- club_posts/valid_school_category()는 이 마이그레이션에서 전혀 건드리지 않는다(계속 club 전용).
-- 되돌리기:
--   drop index if exists share_posts_returned_author_idx;
--   drop function if exists valid_share_grade_band, valid_share_subject;
--   alter table share_posts
--     drop constraint if exists share_posts_grade_band_valid,
--     drop constraint if exists share_posts_subject_valid,
--     drop constraint if exists share_posts_rental_dates_valid,
--     drop column if exists transaction_type, condition_grade, components_complete,
--       condition_note, rental_start_date, rental_end_date, returned_at, grade_band, subject;
--   (status/category 제약은 0003 당시 정의로 직접 되돌려야 함)

alter table share_posts
  add column transaction_type text not null default 'share',
  add column condition_grade text,
  add column components_complete boolean,
  add column condition_note varchar(300),
  add column rental_start_date date,
  add column rental_end_date date,
  add column returned_at timestamptz,
  add column grade_band text,
  add column subject text;

-- 기존 행이 없다는 전제로 NOT NULL을 뒤늦게 건다(위에서 컬럼을 먼저 nullable로 추가한 뒤
-- 즉시 강제하는 이유는, 이미 행이 있는 환경에서 ALTER 자체가 실패하지 않게 하기 위함).
update share_posts set condition_grade = 'good' where condition_grade is null;
update share_posts set components_complete = true where components_complete is null;
alter table share_posts
  alter column condition_grade set not null,
  alter column components_complete set not null;

alter table share_posts
  add constraint share_posts_transaction_type_valid check (transaction_type in ('share', 'rental'));

alter table share_posts
  add constraint share_posts_condition_grade_valid
    check (condition_grade in ('new', 'like_new', 'good', 'fair', 'worn'));

-- 카테고리 체계 교체: 학교급과 무관한 공통 3값. 기존 세부과목 체계(valid_school_category)는
-- club_posts 전용으로 남기고 share_posts에서만 뗀다.
alter table share_posts drop constraint share_posts_category_valid;
alter table share_posts
  add constraint share_posts_category_valid check (category in ('학급경영', '수업교구', '교과자료'));

-- status CHECK 확장. 0003의 인라인 체크는 이름 없이 선언되어 Postgres 기본 명명 규칙상
-- share_posts_status_check로 생성됐을 것이므로 방어적으로 if exists를 붙인다.
alter table share_posts drop constraint if exists share_posts_status_check;
alter table share_posts
  add constraint share_posts_status_check
    check (status in ('available', 'reserved', 'completed', 'renting', 'returned'));

-- 학년군: 초등일 때만 값이 있어야 하고, 그 외 학교급은 반드시 null이다.
create or replace function valid_share_grade_band(level text, grade_band text)
returns boolean
language sql
immutable
as $$
  select case
    when level = 'elementary' then grade_band in ('1~2학년군', '3~4학년군', '5~6학년군')
    else grade_band is null
  end;
$$;

-- 교과목: 카테고리가 교과자료일 때만 값이 있어야 하고, 학교급별로 허용 목록이 다르다.
create or replace function valid_share_subject(level text, category text, subject text)
returns boolean
language sql
immutable
as $$
  select case
    when category <> '교과자료' then subject is null
    when level = 'elementary' then subject in ('국어', '수학', '사회', '과학', '영어', '도덕', '실과', '음악', '미술', '체육')
    when level = 'secondary' then subject in ('국어', '수학', '사회', '영어', '역사', '과학', '기술', '미술', '음악', '체육', '정보')
    else false
  end;
$$;

alter table share_posts
  add constraint share_posts_grade_band_valid check (valid_share_grade_band(school_level, grade_band));

alter table share_posts
  add constraint share_posts_subject_valid check (valid_share_subject(school_level, category, subject));

-- 대여 전용 날짜: rental이면 시작/종료일이 모두 있어야 하고 종료가 시작보다 앞설 수 없다.
-- share면 두 컬럼 모두 비어 있어야 한다(대여 흔적이 나눔 글에 남지 않게).
alter table share_posts
  add constraint share_posts_rental_dates_valid check (
    (transaction_type = 'rental' and rental_start_date is not null and rental_end_date is not null
      and rental_end_date >= rental_start_date)
    or (transaction_type = 'share' and rental_start_date is null and rental_end_date is null)
  );

-- 나눔 완료 인덱스(0003)와 짝을 이루는 대여 반납 완료 인덱스. user_carbon_totals가
-- completed와 returned를 모두 집계하게 되므로(0012) 두 상태 모두 부분 인덱스가 필요하다.
create index if not exists share_posts_returned_author_idx
  on share_posts (author_id) where status = 'returned';

-- 상태 전이 트리거 재작성. 나눔 경로(available<->reserved<->completed)는 기존 동작을
-- 그대로 유지하고, 대여 경로(reserved->renting->returned)를 추가한다.
create or replace function share_posts_guard_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.school_level is distinct from old.school_level
    or new.category is distinct from old.category
    or new.item_type_id is distinct from old.item_type_id
    or new.carbon_g is distinct from old.carbon_g
    or new.author_id is distinct from old.author_id
    or new.transaction_type is distinct from old.transaction_type
    or new.condition_grade is distinct from old.condition_grade
    or new.components_complete is distinct from old.components_complete
    or new.condition_note is distinct from old.condition_note
    or new.grade_band is distinct from old.grade_band
    or new.subject is distinct from old.subject
    or new.rental_start_date is distinct from old.rental_start_date
    or new.rental_end_date is distinct from old.rental_end_date
  then
    raise exception 'only status/reservation fields can be updated on share_posts';
  end if;

  if new.status = old.status then
    if new.reserved_by is distinct from old.reserved_by
      or new.reserved_at is distinct from old.reserved_at
      or new.completed_at is distinct from old.completed_at
      or new.returned_at is distinct from old.returned_at
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
    new.returned_at := null;
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
    if old.transaction_type <> 'share' then
      raise exception 'completed is only a valid transition for share posts';
    end if;
    if auth.uid() is distinct from old.author_id then
      raise exception 'only the author can mark a post completed';
    end if;
    new.completed_at := now();
    return new;
  end if;

  if old.status = 'reserved' and new.status = 'renting' then
    if old.transaction_type <> 'rental' then
      raise exception 'renting is only a valid transition for rental posts';
    end if;
    if auth.uid() is distinct from old.author_id then
      raise exception 'only the author can start a rental';
    end if;
    return new;
  end if;

  if old.status = 'renting' and new.status = 'returned' then
    if old.transaction_type <> 'rental' then
      raise exception 'returned is only a valid transition for rental posts';
    end if;
    if auth.uid() is distinct from old.author_id then
      raise exception 'only the author can mark a rental returned';
    end if;
    new.returned_at := now();
    return new;
  end if;

  raise exception 'invalid share_posts status transition from % to % (transaction_type=%)',
    old.status, new.status, old.transaction_type;
end;
$$;

-- 생성 시점 강제 상태에 returned_at도 포함시킨다(방어적, force_initial_state가 항상
-- available로 시작시키므로 실무 영향은 없지만 완전성을 위해 추가).
create or replace function share_posts_force_initial_state()
returns trigger
language plpgsql
as $$
begin
  new.status := 'available';
  new.reserved_by := null;
  new.reserved_at := null;
  new.completed_at := null;
  new.returned_at := null;
  return new;
end;
$$;

-- RLS는 변경 불필요: share_posts_update 정책은 author_id=auth.uid()가 상태와 무관하게
-- 참이므로 작성자는 renting/returned 전이도 시도할 수 있고, 실제 행위자 검증(작성자만
-- renting/returned 가능)은 위 트리거가 담당한다. share_post_images/share_comments/
-- item_types의 RLS·트리거는 거래유형과 무관하므로 그대로 둔다.
