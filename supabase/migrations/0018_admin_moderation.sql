-- 0018: 관리자 콘텐츠 관리(수정/삭제) 권한. 나눔/소모임/게시판 글과 번개모임은 관리자가
-- 자유롭게 수정·삭제할 수 있게 하고, 댓글은 삭제만 허용한다(작성자 아닌 사람의 말을
-- 관리자가 다른 말로 바꿔치기하는 건 모더레이션 도구로 부적절하다고 판단해 제외).
--
-- 되돌리기:
--   drop policy if exists share_posts_delete_admin on share_posts;
--   drop policy if exists share_comments_delete_admin on share_comments;
--   drop policy if exists club_posts_update_admin on club_posts;
--   drop policy if exists club_posts_delete_admin on club_posts;
--   drop policy if exists club_comments_delete_admin on club_comments;
--   drop policy if exists board_posts_update_admin on board_posts;
--   drop policy if exists board_posts_delete_admin on board_posts;
--   drop policy if exists board_comments_delete_admin on board_comments;
--   drop policy if exists club_events_update_admin on club_events;
--   drop policy if exists club_events_delete_admin on club_events;
--   (share_posts_update/share_posts_guard_transition은 0003/0014의 이전 정의로 되돌려야 함)

-- share_posts: 관리자는 상태·소유권과 무관하게 행을 골라 수정을 시도할 수 있어야 한다.
drop policy if exists share_posts_update on share_posts;
create policy share_posts_update on share_posts
  for update
  using (is_approved() and (status = 'available' or author_id = auth.uid() or reserved_by = auth.uid() or is_admin()))
  with check (is_approved());

create policy share_posts_delete_admin on share_posts
  for delete using (is_admin());

-- 트리거도 관리자면 필드 잠금·상태기계 검증을 전부 건너뛰게 한다(전권 수정).
create or replace function share_posts_guard_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

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

create policy share_comments_delete_admin on share_comments for delete using (is_admin());

-- club_posts: 지금까지 작성자 본인도 수정할 수 있는 정책이 없었다. 관리자 전용으로 추가한다.
create policy club_posts_update_admin on club_posts
  for update using (is_admin()) with check (is_admin());

create policy club_posts_delete_admin on club_posts
  for delete using (is_admin());

create policy club_comments_delete_admin on club_comments for delete using (is_admin());

create policy board_posts_update_admin on board_posts
  for update using (is_admin()) with check (is_admin());

create policy board_posts_delete_admin on board_posts
  for delete using (is_admin());

create policy board_comments_delete_admin on board_comments for delete using (is_admin());

-- club_events: 작성자 삭제(club_events_delete_own)는 0013/0011에 이미 있다. 관리자용
-- 수정·삭제를 추가한다.
create policy club_events_update_admin on club_events
  for update using (is_admin()) with check (is_admin());

create policy club_events_delete_admin on club_events
  for delete using (is_admin());
