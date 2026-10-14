-- ============================================================================
-- ServeTime: hourly email job
--
-- Run this AFTER the app is online (Vercel), not while testing on localhost:
-- Supabase must be able to reach the app's address.
--
-- 1. Replace the two values below:
--      https://YOUR-APP.vercel.app   -> your live address (no slash at the end)
--      YOUR_CRON_SECRET              -> the same value as CRON_SECRET in Vercel
-- 2. Paste into the Supabase SQL Editor and run.
--
-- Every hour at :07 Supabase calls /api/cron, which sends booking reminders,
-- membership renewal reminders and (on Monday mornings) the weekly report.
-- ============================================================================

create extension if not exists pg_net;

select cron.schedule(
  'servetime-hourly-emails',
  '7 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-APP.vercel.app/api/cron',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it ran:   select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it:        select cron.unschedule('servetime-hourly-emails');
