-- Stripe billing: tracks how long a business has been in its current
-- subscription_status (so billing-reminders can tell "past_due/canceled
-- for more than 7 days" apart from "just changed a minute ago"), gives
-- stripe-webhook the same provider-id idempotency every other webhook in
-- this project already has, and schedules billing-reminders alongside
-- Day 10's followups/weekly-report cron jobs.

alter table public.businesses
  add column if not exists subscription_status_since timestamptz not null default now();

-- One row per Stripe event id — mirrors calls.provider_call_id and
-- messages.provider_message_id. Nullable + a partial index because most
-- events logged by other functions have no Stripe event to dedupe against.
alter table public.events
  add column if not exists provider_event_id text;

create unique index if not exists events_provider_event_id_idx
  on public.events (provider_event_id)
  where provider_event_id is not null;

create or replace function public.call_billing_reminders() returns bigint
language sql
security definer
set search_path = public
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/billing-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$;

revoke all on function public.call_billing_reminders() from public;

select cron.schedule('billing-reminders-hourly', '0 * * * *', 'select public.call_billing_reminders()');
