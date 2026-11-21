-- Tests for record_call_usage (migration 20261008000017). Run with
-- scripts/test-sql.sh — it creates a throwaway database, applies the stubs
-- and the migrations, then this file. Any failed assert aborts with an error.
\set ON_ERROR_STOP on

insert into public.businesses (id, name, trade, city, state, timezone, owner_name, owner_whatsapp, created_at)
values ('00000000-0000-0000-0000-000000000001', 'Martinez Roofing', 'roofing', 'Houston', 'TX',
        'America/Chicago', 'Carlos', '+17135550100', '2026-11-01T00:00:00Z');

insert into public.calls (id, business_id, provider_call_id, duration_sec)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'vapi-1', 61),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 'vapi-2', 59),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'vapi-3', null);

do $$
declare
  r jsonb;
begin
  -- First count: trial cycle created from the business's created_at, 150 minutes.
  r := public.record_call_usage('00000000-0000-0000-0000-0000000000a1');
  assert (r->>'counted')::boolean, 'first count must count';
  assert r->'period'->>'kind' = 'trial', 'trialing business counts against the trial cycle';
  assert (r->'period'->>'included_minutes')::int = 150, 'trial includes 150 minutes';
  assert (r->'period'->>'used_seconds')::bigint = 61, 'exact seconds, not rounded per call';
  assert (r->'period'->>'period_start')::timestamptz = '2026-11-01T00:00:00Z', 'trial starts at created_at';

  -- Same call again (Vapi redelivered the webhook): nothing added.
  r := public.record_call_usage('00000000-0000-0000-0000-0000000000a1');
  assert not (r->>'counted')::boolean, 'a repeated call must not count';
  assert (r->'period'->>'used_seconds')::bigint = 61, 'a repeated call must not add seconds';

  -- Second call adds exact seconds: 61 + 59 = 120.
  r := public.record_call_usage('00000000-0000-0000-0000-0000000000a2');
  assert (r->'period'->>'used_seconds')::bigint = 120, 'seconds add up exactly';

  -- A call with no duration counts as 0 seconds but is still marked counted.
  r := public.record_call_usage('00000000-0000-0000-0000-0000000000a3');
  assert (r->>'counted')::boolean, 'null duration still counts (as 0)';
  assert (r->'period'->>'used_seconds')::bigint = 120, 'null duration adds nothing';

  assert (select count(*) from public.usage_periods) = 1, 'one trial row only';
end $$;

-- Paid plan starts: the next call goes to a new 500-minute cycle.
update public.businesses
set subscription_status = 'active',
    billing_period_start = '2026-11-15T00:00:00Z',
    billing_period_end = '2026-12-15T00:00:00Z'
where id = '00000000-0000-0000-0000-000000000001';

insert into public.calls (id, business_id, provider_call_id, duration_sec)
values ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000001', 'vapi-4', 300);

do $$
declare
  r jsonb;
begin
  r := public.record_call_usage('00000000-0000-0000-0000-0000000000a4');
  assert r->'period'->>'kind' = 'paid', 'active business counts against the paid cycle';
  assert (r->'period'->>'included_minutes')::int = 500, 'paid cycle includes 500 minutes';
  assert (r->'period'->>'used_seconds')::bigint = 300, 'paid cycle starts from zero';
  assert (r->'period'->>'period_end')::timestamptz = '2026-12-15T00:00:00Z', 'paid cycle end from Stripe';
  assert (select used_seconds from public.usage_periods where kind = 'trial') = 120, 'trial row untouched';
end $$;

-- Unknown call id is an error, not a silent no-op.
do $$
begin
  perform public.record_call_usage('00000000-0000-0000-0000-00000000dead');
  raise exception 'should have failed';
exception when others then
  assert sqlerrm like 'record_call_usage: call % not found', 'unexpected error: ' || sqlerrm;
end $$;

-- Only the service role may call it.
do $$
begin
  assert not has_function_privilege('anon', 'public.record_call_usage(uuid)', 'execute'), 'anon must not execute';
  assert not has_function_privilege('authenticated', 'public.record_call_usage(uuid)', 'execute'), 'authenticated must not execute';
  assert has_function_privilege('service_role', 'public.record_call_usage(uuid)', 'execute'), 'service_role must execute';
end $$;

\echo 'call_usage.test.sql: all assertions passed'
