-- 0009: 다른 승인 교사의 닉네임을 볼 수 있게 하는 공개 프로필 뷰.
-- 되돌리기: drop view if exists public_profiles;
--
-- profiles 테이블의 RLS는 본인 행(profiles_select_own)과 관리자(profiles_select_admin)만
-- 읽을 수 있게 되어 있다. 그런데 나눔/소모임/댓글 목록에는 "글쓴이 닉네임"을 보여줘야
-- 하므로(R29), 다른 승인 교사의 프로필 일부를 볼 수 있는 통로가 필요하다.
-- profiles에 "승인 사용자는 전부 읽기 가능" 정책을 추가하면 이메일 같은 민감한 컬럼까지
-- 전부 노출되므로, 대신 id·nickname만 담은 뷰를 만든다. security_invoker를 켜지 않아
-- (기본값 false) 뷰가 정의자 권한으로 실행되고, 그 결과 profiles의 RLS를 우회해서
-- 조회한다 — 단, 뷰 자체가 status='approved' 행의 id·nickname만 내보내므로 노출 범위는
-- 딱 그만큼으로 제한된다.
create view public_profiles as
select id, nickname
from profiles
where status = 'approved';

grant select on public_profiles to authenticated;
