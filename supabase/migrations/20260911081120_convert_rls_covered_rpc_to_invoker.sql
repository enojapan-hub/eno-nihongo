alter function public.create_or_replace_study_plan(public.jlpt_level,date,integer) security invoker;
alter function public.ensure_active_study_plan() security invoker;
alter function public.generate_daily_study_tasks(date) security invoker;
alter function public.sync_daily_study_task_progress(date) security invoker;
