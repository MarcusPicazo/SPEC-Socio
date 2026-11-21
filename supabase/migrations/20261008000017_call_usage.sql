-- Call minutes per billing cycle (plan: $199/mo, 14-day trial capped at
-- 150 minutes, 500 minutes included per paid cycle).
--
-- - businesses gets the Stripe subscription id and the paid cycle's dates
--   (stripe-webhook keeps them current), plus trial_cap_status: where the
--   "trial hit 150 minutes" decision stands. Nothing here ever cuts a line.
-- - usage_periods: one row per business per cycle. The trial cycle starts
--   at the business's created_at (minutes count from the day it was set
--   up, even before the owner pays the Checkout link).
-- - calls.usage_period_id marks a call as already counted. record_call_usage
--   only ever counts a call whose usage_period_id is still null, under a
--   row lock, so a redelivered or concurrent Vapi webhook can't count twice.

alter table public.businesses
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_period_start timestamptz,
  add column if not exists billing_period_end timestamptz,
  add column if not exists trial_cap_status text not null default 'none'
    check (trial_cap_status in (
      'none',                 -- trial still under 150 minutes (or never hit it)
      'pending_decision',     -- hit 150 minutes; owner got the button; operator decides
      'owner_started_plan',   -- owner tapped "Empezar mi plan hoy"
      'operator_ended_trial', -- operator ended the trial (and charged) from /admin
      'operator_continue'     -- operator let the trial run to day 15
    )),
  add column if not exists trial_cap_status_since timestamptz;

create table if not exists public.usage_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('trial', 'paid')),
  period_start timestamptz not null,
  period_end timestamptz, -- null while the trial has no Stripe end date yet
  included_minutes int not null check (included_minutes > 0),
  -- Exact seconds. Minutes shown/billed = ceil(used_seconds / 60) for the
  -- whole cycle, never per call.
  used_seconds bigint not null default 0 check (used_seconds >= 0),
  alert_80_sent_at timestamptz,
  alert_100_sent_at timestamptz,
  alert_200_sent_at timestamptz, -- trial only: operator escalation at 300 minutes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, kind, period_start)
);

create index if not exists usage_periods_business_id_idx
  on public.usage_periods (business_id, period_start desc);

alter table public.usage_periods enable row level security;

-- Operators read; only the service role (Edge Functions) writes.
create policy "usage_periods_operator_select"
  on public.usage_periods
  for select
  to authenticated
  using (public.is_operator());

alter table public.calls
  add column if not exists usage_period_id uuid references public.usage_periods (id) on delete set null;

create index if not exists calls_usage_period_id_idx on public.calls (usage_period_id);

-- Counts one call against its business's current cycle. Returns
-- { counted: bool, period: usage_periods row }. counted=false means the
-- call had already been counted — the period is still returned so the
-- caller can (re)check alerts that may not have gone out the first time.
create or replace function public.record_call_usage(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_business public.businesses%rowtype;
  v_call public.calls%rowtype;
  v_kind text;
  v_start timestamptz;
  v_end timestamptz;
  v_included int;
  v_period public.usage_periods%rowtype;
begin
  select business_id into v_business_id from public.calls where id = p_call_id;
  if v_business_id is null then
    raise exception 'record_call_usage: call % not found', p_call_id;
  end if;

  -- Lock the business first: serializes every call of the same business,
  -- so the period upsert and the counter below can't interleave.
  select * into v_business from public.businesses where id = v_business_id for update;
  select * into v_call from public.calls where id = p_call_id for update;

  if v_call.usage_period_id is not null then
    select * into v_period from public.usage_periods where id = v_call.usage_period_id;
    return jsonb_build_object('counted', false, 'period', to_jsonb(v_period));
  end if;

  if v_business.subscription_status = 'trialing' or v_business.billing_period_start is null then
    v_kind := 'trial';
    v_start := v_business.created_at;
    v_end := v_business.trial_ends_at;
    v_included := 150;
  else
    v_kind := 'paid';
    v_start := v_business.billing_period_start;
    v_end := v_business.billing_period_end;
    v_included := 500;
  end if;

  insert into public.usage_periods (business_id, kind, period_start, period_end, included_minutes)
  values (v_business_id, v_kind, v_start, v_end, v_included)
  on conflict (business_id, kind, period_start) do update
    set period_end = coalesce(excluded.period_end, public.usage_periods.period_end)
  returning * into v_period;

  update public.calls set usage_period_id = v_period.id where id = p_call_id;

  update public.usage_periods
    set used_seconds = used_seconds + greatest(coalesce(v_call.duration_sec, 0), 0),
        updated_at = now()
    where id = v_period.id
    returning * into v_period;

  return jsonb_build_object('counted', true, 'period', to_jsonb(v_period));
end;
$$;

-- Same lesson as 20261008000015: Supabase grants EXECUTE on new public
-- functions to anon/authenticated directly, so revoke those explicitly.
revoke all on function public.record_call_usage(uuid) from public;
revoke execute on function public.record_call_usage(uuid) from anon, authenticated;
grant execute on function public.record_call_usage(uuid) to service_role;
