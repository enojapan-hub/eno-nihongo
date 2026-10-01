create or replace function public.verify_translation_cron_secret(p_candidate text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    p_candidate is not null
    and p_candidate = substring(
      (select j.command from cron.job j where j.jobname = 'eno-translation-batch' limit 1)
      from 'x-cron-secret[^:]*:\s*\\?"([^"\\]+)'
    ),
    false
  );
$$;

revoke execute on function public.verify_translation_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_translation_cron_secret(text) to service_role;
