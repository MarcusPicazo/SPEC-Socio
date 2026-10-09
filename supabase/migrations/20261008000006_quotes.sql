create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  call_id uuid references public.calls (id) on delete set null,
  number text not null, -- Q-0001, scoped per business
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  items jsonb not null default '[]'::jsonb, -- [{description_en, qty, unit, unit_price, total}]
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  notes_en text,
  warranty_en text,
  valid_until date,
  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),  pdf_path text,
  source_audio_path text,
  transcript_es text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  followup_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, number)
);

create index if not exists quotes_business_id_idx on public.quotes (business_id);
create index if not exists quotes_customer_id_idx on public.quotes (customer_id);

alter table public.quotes enable row level security;

create policy "quotes_operator_all"
  on public.quotes
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());
