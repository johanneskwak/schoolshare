-- 0016: user_carbon_totals에 대여 실적(returned) 포함. 사용자 결정: 대여도 나눔과 동일하게
-- 100% 탄소량을 적립하므로, carbon_g는 이미 스냅샷된 값을 그대로 합산하면 된다 — 상태
-- 조건만 completed/returned 양쪽으로 넓히면 충분하다.
-- 되돌리기: 0006의 원래 정의로 create or replace view를 다시 실행.
create or replace view user_carbon_totals
with (security_invoker = true) as
select author_id as user_id, coalesce(sum(carbon_g), 0) as total_carbon_g
from share_posts
where status in ('completed', 'returned')
group by author_id;
