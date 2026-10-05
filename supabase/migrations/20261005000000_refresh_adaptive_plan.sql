-- Satu round-trip untuk rangkaian yang sebelumnya dipanggil klien berurutan:
-- ensure_active_study_plan -> generate_weekly_study_plan(p_date) -> sync_daily_study_task_progress(p_date).
-- SECURITY INVOKER (RLS dan auth.uid() sama seperti pemanggilan terpisah); hanya komposisi, tanpa logika baru.
create or replace function public.refresh_adaptive_plan(p_date date)
returns void
language plpgsql
set search_path to 'pg_catalog', 'public', 'auth'
as $$
begin
  perform public.ensure_active_study_plan();
  perform public.generate_weekly_study_plan(p_date);
  perform public.sync_daily_study_task_progress(p_date);
end;
$$;

revoke all on function public.refresh_adaptive_plan(date) from public, anon;
grant execute on function public.refresh_adaptive_plan(date) to authenticated, service_role;
