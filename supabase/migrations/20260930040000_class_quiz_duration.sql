-- Store a teacher-defined target duration for class quizzes.
-- The existing due_at remains the server-enforced submission deadline; this
-- field is shown to participants as the recommended time for one attempt.
alter table public.class_quizzes
  add column if not exists duration_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_quizzes_duration_minutes_check'
      and conrelid = 'public.class_quizzes'::regclass
  ) then
    alter table public.class_quizzes
      add constraint class_quizzes_duration_minutes_check
      check (duration_minutes is null or duration_minutes between 1 and 480);
  end if;
end $$;
