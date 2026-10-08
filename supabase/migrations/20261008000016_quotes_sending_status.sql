-- 'sending' is a short-lived claim status: sendQuoteToCustomer moves a
-- quote from 'draft' to 'sending' (conditioned on it still being 'draft')
-- right before emailing the customer, so a double tap on "Enviar" can't
-- send the same quote twice. It reverts to 'draft' if the send fails.
alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('draft', 'sending', 'sent', 'viewed', 'accepted', 'declined', 'expired'));
