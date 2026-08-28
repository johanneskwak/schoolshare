-- 0015: 나눔/대여 글 첨부파일. post_attachments 테이블 + post-attachments 스토리지 버킷 정책.
-- 버킷 자체(post-attachments)는 share-images/club-images와 마찬가지로 Supabase 대시보드에서
-- 수동으로 만든다(비공개). 읽기는 서버가 service-role로 서명 URL을 발급한다.
-- 되돌리기:
--   drop policy if exists post_attachments_storage_insert_own on storage.objects;
--   drop policy if exists post_attachments_storage_delete_own on storage.objects;
--   drop table if exists post_attachments cascade;

create table post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references share_posts (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760), -- 10MB
  mime_type text not null,
  created_at timestamptz not null default now(),
  constraint post_attachments_ext_valid check (file_name ~* '\.(pdf|hwp|hwpx|docx|pptx)$')
);

create index post_attachments_post_idx on post_attachments (post_id);

-- enforce_image_limit()은 0003에서 정의된 제네릭 함수(TG_TABLE_NAME/TG_ARGV 기반)를
-- 그대로 재사용한다. 최대 3개.
create trigger post_attachments_limit
  before insert on post_attachments
  for each row execute function enforce_image_limit(3, 'post_id');

alter table post_attachments enable row level security;

create policy post_attachments_select_approved on post_attachments
  for select using (is_approved());

create policy post_attachments_insert_own on post_attachments
  for insert with check (
    is_approved()
    and exists (select 1 from share_posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy post_attachments_delete_own on post_attachments
  for delete using (
    is_approved()
    and exists (select 1 from share_posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy post_attachments_storage_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'post-attachments'
    and is_approved()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy post_attachments_storage_delete_own on storage.objects
  for delete using (
    bucket_id = 'post-attachments'
    and is_approved()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
