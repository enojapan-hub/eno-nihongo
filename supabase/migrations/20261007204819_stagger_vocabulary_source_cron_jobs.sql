-- Keep both vocabulary source workers active, but avoid starting them together.
-- Job 2 remains at :00/:05/...; job 3 moves to :02/:07/... to reduce DB contention.
select cron.alter_job(3, schedule := '2-59/5 * * * *');
