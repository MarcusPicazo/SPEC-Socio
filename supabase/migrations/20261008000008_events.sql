-- Generic audit log for everything that happens server-side (webhook
-- received, LLM call, cron run, error), so failures are visible without
-- opening the Edge Function console.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_business_id_idx on public.events (business_id);
create index if not exists events_type_idx on public.events (type);

alter table public.events enable row level security;

create policy "events_operator_all"
  on public.events
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());
