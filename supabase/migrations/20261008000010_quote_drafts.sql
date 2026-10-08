-- Staging area for building a quote from a WhatsApp voice note across
-- several messages (customer lookup, clarifying questions). quotes.
-- customer_id is not null, so nothing can go into quotes until the
-- customer is actually known — this table is what we have in the
-- meantime. Once fully resolved it gets promoted into a real quotes row
-- (status stays 'ready' here as the audit trail, see promoted_quote_id).
create table if not exists public.quote_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  status text not null default 'awaiting_customer'
    check (status in (
      'awaiting_customer',
      'awaiting_customer_list_choice',
      'awaiting_customer_name',
      'awaiting_customer_email',
      'awaiting_clarification',
      'ready'
    )),
  customer_hint text,
  customer_id uuid references public.customers (id) on delete set null,
  candidate_customer_ids jsonb not null default '[]'::jsonb, -- customer ids offered in the list message, so we can validate the reply
  pending_customer_name text, -- held between awaiting_customer_name and awaiting_customer_email
  items jsonb not null default '[]'::jsonb, -- QuoteExtractionItem[]
  warranty_en text,
  warranty_es text,
  notes_en text,
  notes_es text,
  needs_clarification jsonb not null default '[]'::jsonb, -- string[], always re-derived by Claude, never patched by hand
  qa_history jsonb not null default '[]'::jsonb, -- [{question, answer}], fed back into every re-extraction
  transcript_es text,
  source_audio_path text,
  promoted_quote_id uuid references public.quotes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_drafts_business_id_idx on public.quote_drafts (business_id);

-- At most one draft in progress per business at a time. Once promoted
-- (status = 'ready') it's history, so a new voice note can start another.
create unique index if not exists quote_drafts_one_active_per_business
  on public.quote_drafts (business_id)
  where status <> 'ready';

alter table public.quote_drafts enable row level security;

create policy "quote_drafts_operator_all"
  on public.quote_drafts
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- Private bucket for the owner's original quote voice notes. Only the
-- service role (Edge Functions) ever reads or writes it — no storage.objects
-- policy is added because service role bypasses RLS the same way it does
-- for ordinary tables.
insert into storage.buckets (id, name, public)
values ('quotes-audio', 'quotes-audio', false)
on conflict (id) do nothing;
