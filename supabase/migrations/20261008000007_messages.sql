-- Log of every inbound/outbound message to an external provider
-- (WhatsApp, email, SMS), per CLAUDE.md: todo lo que entra y sale se registra.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  to_addr text,
  from_addr text,
  template text,
  body text,
  provider_message_id text unique, -- idempotency for webhook retries
  status text,
  created_at timestamptz not null default now()
);

create index if not exists messages_business_id_idx on public.messages (business_id);

alter table public.messages enable row level security;

create policy "messages_operator_all"
  on public.messages
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());
