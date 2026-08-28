-- 0010: 평가 등록/수정을 하나의 트랜잭션으로 처리한다.
-- UPSERT와 답변 교체에 필요한 권한도 본인 평가로만 제한해 연다.
create policy school_reviews_update_own on school_reviews
  for update using (is_approved() and user_id = auth.uid())
  with check (is_approved() and user_id = auth.uid());

create policy school_review_answers_delete_own on school_review_answers
  for delete using (
    is_approved()
    and exists (select 1 from school_reviews r where r.id = review_id and r.user_id = auth.uid())
  );

create or replace function submit_school_review(
  target_school_id uuid,
  answer_scores jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_review_id uuid;
  supplied_count int;
  active_count int;
begin
  if not is_approved() then
    raise exception 'approved account required';
  end if;

  if jsonb_typeof(answer_scores) is distinct from 'object' then
    raise exception 'answers must be an object';
  end if;

  select count(*) into supplied_count from jsonb_each(answer_scores);
  select count(*) into active_count from school_review_questions where is_active;

  if active_count = 0 or supplied_count <> active_count then
    raise exception 'all active questions must be answered';
  end if;

  if exists (
    select 1
    from jsonb_each_text(answer_scores) supplied
    left join school_review_questions q
      on q.id = supplied.key::uuid and q.is_active
    where q.id is null
       or supplied.value !~ '^[1-5]$'
  ) then
    raise exception 'invalid question or score';
  end if;

  insert into school_reviews (school_id, user_id)
  values (target_school_id, auth.uid())
  on conflict (school_id, user_id)
  do update set school_id = excluded.school_id
  returning id into target_review_id;

  delete from school_review_answers where review_id = target_review_id;

  insert into school_review_answers (review_id, question_id, score)
  select target_review_id, supplied.key::uuid, supplied.value::int
  from jsonb_each_text(answer_scores) supplied;

  return target_review_id;
end;
$$;

grant execute on function submit_school_review(uuid, jsonb) to authenticated;
