-- 0017: condition_note를 "활용팁"(교육적 활용 방법) 용도로 넓힌다. 기존에는 물건 상태
-- 비고용 varchar(300)이었는데, 커리큘럼 연계·수업 활용법 등 자세한 설명을 담기엔 너무
-- 짧아서 text로 바꾸고 상한만 넉넉하게(2000자) 둔다. 컬럼 이름은 유지한다 — DB 레벨에서는
-- 여전히 "물건 관련 비고"이고, 어떻게 쓸지는 애플리케이션 레이어(레이블="활용팁")의 문제다.
-- 되돌리기:
--   alter table share_posts drop constraint if exists share_posts_condition_note_length;
--   alter table share_posts alter column condition_note type varchar(300);

alter table share_posts alter column condition_note type text;

alter table share_posts
  add constraint share_posts_condition_note_length check (char_length(condition_note) <= 2000);
