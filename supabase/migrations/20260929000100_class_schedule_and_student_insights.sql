-- Read-only aggregates used by public class cards and teacher preparation.
create or replace function public.get_public_class_enrollment_counts()
returns table (class_id uuid, participant_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select c.id, count(e.id)::bigint
  from public.classes c
  left join public.class_enrollments e
    on e.class_id = c.id and e.status = 'active'
  where c.status = 'published'
    and (select auth.uid()) is not null
  group by c.id;
$$;

revoke all on function public.get_public_class_enrollment_counts() from public, anon;
grant execute on function public.get_public_class_enrollment_counts() to authenticated;

create or replace function public.get_teacher_class_question_insights(p_class_id uuid)
returns table (
  user_id uuid,
  display_name text,
  quiz_title text,
  question_id uuid,
  question text,
  attempts_count bigint,
  correct_count bigint,
  accuracy numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if (select auth.uid()) is null or not public.can_manage_class(p_class_id) then
    raise exception 'Akses kelas ditolak';
  end if;

  return query
  select
    a.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Peserta')::text,
    qz.title,
    qq.id,
    qq.question,
    count(*)::bigint,
    count(*) filter (
      where case
        when (a.answers ->> qq.id::text) ~ '^[0-9]+$'
          then (a.answers ->> qq.id::text)::integer
        else -1
      end = qq.correct_index
    )::bigint,
    round(
      100.0 * count(*) filter (
        where case
          when (a.answers ->> qq.id::text) ~ '^[0-9]+$'
            then (a.answers ->> qq.id::text)::integer
          else -1
        end = qq.correct_index
      ) / nullif(count(*), 0),
      1
    )
  from public.class_quiz_attempts a
  join public.class_quizzes qz on qz.id = a.quiz_id
  join public.class_quiz_questions qq on qq.quiz_id = qz.id
  left join public.profiles p on p.id = a.user_id
  where qz.class_id = p_class_id
  group by a.user_id, p.display_name, qz.title, qq.id, qq.question, qq.sort_order
  order by a.user_id, accuracy asc, qz.title, qq.sort_order;
end;
$$;

revoke all on function public.get_teacher_class_question_insights(uuid) from public, anon;
grant execute on function public.get_teacher_class_question_insights(uuid) to authenticated;
