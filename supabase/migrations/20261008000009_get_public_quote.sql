-- Only entry point for the public /q/:token page (SPEC §5.3). It runs as
-- the function owner (security definer) so it can read across businesses,
-- customers and quotes while those tables stay closed to anon/authenticated
-- via RLS. It must only ever return the public subset of fields below —
-- never owner_whatsapp, twilio_number, vapi_assistant_id, stripe fields,
-- customer phone/email, source_audio_path or transcript_es.
create or replace function public.get_public_quote(token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'number', q.number,
    'status', q.status,
    'items', q.items,
    'subtotal', q.subtotal,
    'tax', q.tax,
    'total', q.total,
    'currency', q.currency,
    'notes_en', q.notes_en,
    'warranty_en', q.warranty_en,
    'valid_until', q.valid_until,
    'pdf_path', q.pdf_path,
    'sent_at', q.sent_at,
    'viewed_at', q.viewed_at,
    'accepted_at', q.accepted_at,
    'customer', jsonb_build_object('name', c.name),
    'business', jsonb_build_object(
      'name', b.name,
      'trade', b.trade,
      'city', b.city,
      'state', b.state
    )
  )
  into result
  from public.quotes q
  join public.customers c on c.id = q.customer_id
  join public.businesses b on b.id = q.business_id
  where q.public_token = token
    -- a quote is only visible once the owner has sent it; drafts stay private.
    and q.status in ('sent', 'viewed', 'accepted', 'declined', 'expired');

  return result; -- null when the token doesn't match anything visible
end;
$$;

revoke all on function public.get_public_quote(text) from public;
grant execute on function public.get_public_quote(text) to anon, authenticated;
