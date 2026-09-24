-- 신규 enum 값 (같은 트랜잭션에서 바로 쓸 수 없어서 별도 마이그레이션으로 분리)
alter type public.hc_faction_type add value if not exists 'usa';
alter type public.hc_victory_type add value if not exists 'wonder';
