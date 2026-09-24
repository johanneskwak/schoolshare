-- Supabase 보안 어드바이저 대응
alter function public.hc__valid_action(jsonb) set search_path = public;
-- RLS 정책은 authenticated에만 적용되므로 anon이 멤버십 조회 함수를 호출할 필요가 없다
revoke execute on function public.hc_is_room_member(uuid) from public, anon;
