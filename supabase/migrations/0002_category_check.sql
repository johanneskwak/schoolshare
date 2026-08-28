-- 0002: 학교급-카테고리 CHECK 제약을 위한 공용 함수.
-- 되돌리기: drop function valid_school_category;
-- lib/constants/categories.ts와 반드시 동기화한다.

create or replace function valid_school_category(level text, category text)
returns boolean
language sql
immutable
as $$
  select case level
    when 'elementary' then category in ('수업자료', '학급자료')
    when 'secondary' then category in (
      '국어', '수학', '사회', '영어', '역사', '과학', '기술', '미술', '음악', '체육'
    )
    else false
  end;
$$;
