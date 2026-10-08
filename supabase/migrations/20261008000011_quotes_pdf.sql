-- Public bucket for generated quote PDFs. Unlike quotes-audio (private —
-- the owner's raw voice notes), the PDF is meant to be downloadable from
-- the already-token-gated /q/:token page, so a stable public Storage URL
-- is simplest. The real access boundary is still the quote's own
-- public_token: nothing links to this file without it.
insert into storage.buckets (id, name, public)
values ('quotes-pdf', 'quotes-pdf', true)
on conflict (id) do nothing;

-- Separate from get_public_quote, which stays a pure read. Called once by
-- the public page on first load; safe to call repeatedly (no-ops once
-- viewed_at is set, and never downgrades status away from accepted/etc).
create or replace function public.mark_quote_viewed(token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
  set
    viewed_at = coalesce(viewed_at, now()),
    status = case when status = 'sent' then 'viewed' else status end
  where public_token = token;
end;
$$;

revoke all on function public.mark_quote_viewed(text) from public;
grant execute on function public.mark_quote_viewed(text) to anon, authenticated;
