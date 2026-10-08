create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text,
  phone text,
  email text,
  address text,
  language text check (language in ('en', 'es')),
  created_at timestamptz not null default now()
);

-- Lets webhooks find-or-create a customer by phone within a business
-- (one phone number maps to one customer per business).
create unique index if not exists customers_business_phone_key
  on public.customers (business_id, phone)
  where phone is not null;

create index if not exists customers_business_id_idx on public.customers (business_id);

alter table public.customers enable row level security;

create policy "customers_operator_all"
  on public.customers
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());
