-- 0011: 소모임 번개모임(공유 캘린더 이벤트). club_events, RLS.
-- 되돌리기: drop table if exists club_events cascade;
--
-- 특정 소모임 글에 종속되지 않는 독립적인 캘린더다. 승인된 교사라면 누구나
-- 날짜+장소만으로 즉석 모임을 등록할 수 있다.

create table if not exists club_events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id),
  title text not null,
  event_date date not null,
  location text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists club_events_date_idx on club_events (event_date);
create index if not exists club_events_author_idx on club_events (author_id);

alter table club_events enable row level security;

create policy club_events_select_approved on club_events for select using (is_approved());

create policy club_events_insert_own on club_events
  for insert with check (is_approved() and author_id = auth.uid());

-- 등록한 본인이 번개모임을 취소(삭제)할 수 있다.
create policy club_events_delete_own on club_events
  for delete using (is_approved() and author_id = auth.uid());
