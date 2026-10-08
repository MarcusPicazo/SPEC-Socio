-- Adds a status for the "Enviar" button flow: the owner tapped Enviar on
-- a quote whose customer has no email on file, so quote_drafts holds that
-- one pending question the same way it already holds the voice-note
-- questions (customer name, clarification, etc). promoted_quote_id points
-- at the quote waiting to be sent instead of one just promoted.
alter table public.quote_drafts drop constraint if exists quote_drafts_status_check;
alter table public.quote_drafts add constraint quote_drafts_status_check
  check (status in (
    'awaiting_customer',
    'awaiting_customer_list_choice',
    'awaiting_customer_name',
    'awaiting_customer_email',
    'awaiting_clarification',
    'awaiting_send_email',
    'ready'
  ));
