-- Schedules the followups and weekly-report Edge Functions via pg_cron +
-- pg_net, following Supabase's documented pattern (Vault for the secrets a
-- cron job needs, a wrapper SQL function that reads them and calls
-- net.http_post, cron.schedule pointed at that wrapper):
-- https://supabase.com/docs/guides/functions/schedule-functions
--
-- Both run hourly in UTC. That's not literally "Monday 8am" or "9am-6pm" —
-- it's how a single global schedule can still respect each business's own
-- timezone: the function itself checks the business's local time on every
-- run (see _shared/local-time.ts) and only acts during its real local
-- window, picking up again on the next hourly run otherwise.
--
-- This migration only wires the schedule. Before it does anything, set the
-- three Vault secrets it reads (see the deploy instructions):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon-or-publishable-key>', 'anon_key');
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.call_followups() returns bigint
language sql
security definer
set search_path = public
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$;

create or replace function public.call_weekly_report() returns bigint
language sql
security definer
set search_path = public
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$;

-- The function URL is reachable by anyone — these wrappers (and therefore
-- the secrets they read) should only ever run as the cron job itself.
revoke all on function public.call_followups() from public;
revoke all on function public.call_weekly_report() from public;

select cron.schedule('followups-hourly', '0 * * * *', 'select public.call_followups()');
select cron.schedule('weekly-report-hourly', '0 * * * *', 'select public.call_weekly_report()');
