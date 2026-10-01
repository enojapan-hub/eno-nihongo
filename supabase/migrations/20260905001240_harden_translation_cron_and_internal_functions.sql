do $$
declare
  v_id uuid;
  v_new_secret text := encode(gen_random_bytes(32), 'hex');
begin
  select id into v_id from vault.secrets where name = 'eno_translation_cron_secret' limit 1;
  if v_id is null then
    perform vault.create_secret(v_new_secret, 'eno_translation_cron_secret', 'ENO NIHONGO translation cron authentication secret');
  else
    perform vault.update_secret(v_id, v_new_secret);
  end if;
end $$;

create or replace function public.verify_translation_cron_secret(p_candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_candidate is not null
    and p_candidate = (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'eno_translation_cron_secret'
      limit 1
    ),
    false
  );
$$;

revoke execute on function public.verify_translation_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_translation_cron_secret(text) to service_role;

select cron.schedule(
  'eno-translation-batch',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://upxtqsvgppvqpbrjoitz.supabase.co/functions/v1/ai-translate-cron',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'eno_translation_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $cron$
);

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;

revoke execute on function public.process_vocabulary_source_batch(integer) from public, anon, authenticated;
revoke execute on function public.link_unleveled_vocabulary_sources(integer) from public, anon, authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
