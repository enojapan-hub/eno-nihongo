-- Stop the completed Indonesian vocabulary enrichment poller.
-- The job was id 5 in production and its pending predicate was verified at 0 before removal.
do $$
begin
  if exists (select 1 from cron.job where jobid = 5) then
    perform cron.unschedule(5);
  end if;
end $$;
