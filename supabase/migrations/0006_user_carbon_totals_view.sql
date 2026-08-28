-- 0006: 사용자별 누적 탄소 절감량 뷰
-- 되돌리기: drop view if exists user_carbon_totals;

-- completed 상태인 나눔 글의 carbon_g 합. (R17) 본인만 조회하도록 security_invoker=true로
-- share_posts의 RLS(is_approved())를 그대로 물려받는다. 다른 사용자의 합계를 노출하는
-- 화면은 만들지 않는다 (Non-Goals) — 뷰 자체는 전체를 계산하지만 앱에서 author_id = 본인
-- 조건으로만 조회한다.
create view user_carbon_totals
with (security_invoker = true) as
select author_id as user_id, coalesce(sum(carbon_g), 0) as total_carbon_g
from share_posts
where status = 'completed'
group by author_id;
