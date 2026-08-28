-- 0001: profiles, schools, 헬퍼 함수, RLS
-- 되돌리기: drop table if exists profiles, schools cascade; drop function is_approved, is_admin;

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  kakao_place_id text not null unique,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  nickname text not null unique,
  school_id uuid references schools (id),
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_school_id_idx on profiles (school_id);
create index if not exists profiles_status_idx on profiles (status);

-- 현재 세션 사용자가 승인된 교사인지. SECURITY DEFINER + STABLE로 RLS 정책에서 재사용해도
-- 행마다 재평가되지 않게 한다.
create or replace function is_approved()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

-- 본인이 직접 쓰는 insert/update 경로(가입, 내 설정)에서 role·status·id·email을 스스로
-- 바꿀 수 없게 막는다. RLS의 with check만으로는 "본인 행"이라는 조건만 걸릴 뿐 어떤 컬럼이
-- 바뀌는지는 막지 못하므로, 이 트리거가 없으면 가입 시 role='admin'을 보내거나 내 설정에서
-- status='approved'로 자가 승인하는 것을 막을 수 없다. service_role(서버 스크립트), 관리자
-- (is_admin()), 그리고 JWT 컨텍스트가 없는 직접 SQL 접근(Supabase Studio, 마이그레이션,
-- 최초 관리자 수동 승격)은 그대로 통과시킨다. 이 트리거는 PostgREST를 통해 authenticated
-- 역할로 들어오는 셀프 서비스 쓰기만 제한한다.
create or replace function profiles_guard_self_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' or is_admin() then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.role := 'teacher';
    new.status := 'pending';
    return new;
  end if;

  new.id := old.id;
  new.email := old.email;
  new.role := old.role;
  new.status := old.status;
  return new;
end;
$$;

create trigger profiles_guard_self_write_trigger
  before insert or update on profiles
  for each row execute function profiles_guard_self_write();

alter table profiles enable row level security;
alter table schools enable row level security;

-- profiles: 본인 행은 상태와 무관하게 읽을 수 있다 (승인 대기 화면이 자기 상태를 읽어야 함).
-- 이 예외는 profiles 정책에만 존재하고 다른 테이블로 새면 안 된다.
create policy profiles_select_own on profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (is_admin());

create policy profiles_insert_own on profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_admin on profiles
  for update using (is_admin()) with check (true);

-- schools: 승인된 사용자는 읽기만 가능. 쓰기 정책은 두지 않는다 (service-role 전용, R34).
create policy schools_select_approved on schools
  for select using (is_approved());
