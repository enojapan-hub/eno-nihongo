create or replace function public.verify_translation_cron_secret(p_candidate text)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_command text;
begin
  -- Local databases may not have pg_cron installed.
  if to_regclass('cron.job') is null then
    return false;
  end if;
  execute 'select j.command from cron.job j where j.jobname = $1 limit 1'
    into v_command using 'eno-translation-batch';
  return coalesce(
    p_candidate is not null
    and p_candidate = substring(v_command from 'x-cron-secret[^:]*:\\s*\\\\?"([^"\\\\]+)'),
    false
  );
end;
$$;

revoke execute on function public.verify_translation_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_translation_cron_secret(text) to service_role;
