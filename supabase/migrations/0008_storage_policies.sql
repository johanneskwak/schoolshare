-- 0008: Storage 업로드 정책. 버킷 자체(share-images, club-images)는 Pre-Work에서
-- Supabase 대시보드에 수동으로 만든다 (비공개). 읽기는 서버가 service-role로 서명 URL을
-- 발급하므로 별도 select 정책이 필요 없다. 여기서는 업로드(insert)만 열어준다.
-- 되돌리기:
--   drop policy if exists share_images_insert_own on storage.objects;
--   drop policy if exists club_images_insert_own on storage.objects;

create policy share_images_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'share-images'
    and is_approved()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy club_images_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'club-images'
    and is_approved()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
