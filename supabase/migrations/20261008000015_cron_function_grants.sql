-- `revoke all on function ... from public` does NOT revoke a privilege
-- that was granted directly to a role — and Supabase's own default
-- privileges on the public schema grant EXECUTE on new functions to
-- anon and authenticated explicitly, independent of PUBLIC. The previous
-- migrations' revokes (20261008000013, 20261008000014) therefore left
-- anon/authenticated still able to call these — fix that explicitly here.
revoke execute on function public.call_followups() from anon, authenticated;
revoke execute on function public.call_weekly_report() from anon, authenticated;
revoke execute on function public.call_billing_reminders() from anon, authenticated;

-- is_operator() only ever returns a boolean and is already security
-- definer, so anon being able to call it was never a data leak (anon has
-- no auth.uid(), so it's always false) — revoked anyway for the same
-- reason: a grant to a specific role survives a `from public` revoke, and
-- this function was never meant to be anon-callable in the first place.
revoke execute on function public.is_operator() from anon;
