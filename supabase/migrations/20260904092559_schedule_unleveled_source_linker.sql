do $$
begin
  if not exists (select 1 from cron.job where jobname = 'link-unleveled-vocabulary-sources') then
    perform cron.schedule(
      'link-unleveled-vocabulary-sources',
      '*/5 * * * *',
      'select public.link_unleveled_vocabulary_sources(200);'
    );
  end if;
end $$;
