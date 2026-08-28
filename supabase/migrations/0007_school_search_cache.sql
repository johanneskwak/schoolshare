-- 0007: school_search_cache, school_search_cache_items, 인덱스, 읽기 전용 RLS
-- 되돌리기: drop table if exists school_search_cache_items, school_search_cache cascade;

create table if not exists school_search_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  fetched_at timestamptz not null default now()
);

create unique index if not exists school_search_cache_query_key_idx
  on school_search_cache (query_key);

create table if not exists school_search_cache_items (
  id uuid primary key default gen_random_uuid(),
  cache_id uuid not null references school_search_cache (id) on delete cascade,
  school_id uuid not null references schools (id),
  rank int not null
);

create index if not exists school_search_cache_items_cache_rank_idx
  on school_search_cache_items (cache_id, rank);

alter table school_search_cache enable row level security;
alter table school_search_cache_items enable row level security;

-- 읽기만 세션 사용자에게 연다. 쓰기 정책은 의도적으로 만들지 않는다 — 정책이 없으면
-- RLS가 켜진 테이블은 모든 쓰기를 거부하므로, 캐시 채우기와 학교 저장은
-- SUPABASE_SERVICE_ROLE_KEY로 만든 서버 클라이언트에서만 가능하다. (R34, AC22)
create policy school_search_cache_select_approved on school_search_cache
  for select using (is_approved());

create policy school_search_cache_items_select_approved on school_search_cache_items
  for select using (is_approved());
