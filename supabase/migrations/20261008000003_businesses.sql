create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text not null,
  city text not null,
  state text not null,
  timezone text not null,
  owner_name text not null,
  owner_whatsapp text not null unique, -- E.164
  twilio_number text unique,
  vapi_assistant_id text,
  hours jsonb not null default '{}'::jsonb,
  services jsonb not null default '[]'::jsonb,
  emergency_transfer boolean not null default true,
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

create policy "businesses_operator_all"
  on public.businesses
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());
