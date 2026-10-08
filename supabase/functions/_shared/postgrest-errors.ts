/**
 * Postgres' unique_violation error code (23505). PostgREST passes it
 * straight through, and supabase-js surfaces it on `error.code` instead of
 * throwing — so an insert that lost a race against a `unique` constraint
 * (provider_call_id, provider_message_id, …) looks like this, not a crash.
 */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505'
}
