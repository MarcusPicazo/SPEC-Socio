create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  provider_call_id text not null unique, -- Vapi/Twilio call id, for webhook idempotency
  from_number text,
  started_at timestamptz,
  duration_sec int,
  recording_url text,
  transcript text,
  extracted jsonb, -- SPEC §6.2
  summary_es text,
  is_spam boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'confirmed', 'owner_will_call', 'ignored')),
  created_at timestamptz not null default now()
);

create index if not exists calls_business_id_idx on public.calls (business_id);
create index if not exists calls_customer_id_idx on public.calls (customer_id);

alter table public.calls enable row level security;

create policy "calls_operator_all"
  on public.calls
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());
