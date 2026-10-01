insert into public.quizzes (slug,title,description,level,skill,question_count,time_limit_seconds,sort_order,is_published)
select 'simulasi-jlpt-'||l, 'Simulasi JLPT '||l, 'Simulasi latihan V1 berbasis bank soal ENO JAPAN untuk level '||l||'.', l::jlpt_level, null, 50, 3600, case l when 'N5' then 1 when 'N4' then 2 when 'N3' then 3 when 'N2' then 4 else 5 end, true
from unnest(array['N5','N4','N3','N2','N1']) as l
on conflict (slug) do update set question_count=excluded.question_count,is_published=true,time_limit_seconds=excluded.time_limit_seconds;

insert into public.quiz_questions (quiz_id,question_id,sort_order)
select qz.id, q.id, row_number() over(partition by qz.id order by q.created_at, q.id)-1
from public.quizzes qz
join lateral (
  select id,created_at from public.questions q
  where q.level=qz.level and q.is_published=true
  order by q.created_at, q.id
  limit 50
) q on true
where qz.slug like 'simulasi-jlpt-%'
on conflict do nothing;

update public.quizzes qz set question_count=(select count(*) from public.quiz_questions qq where qq.quiz_id=qz.id) where qz.slug like 'simulasi-jlpt-%';
