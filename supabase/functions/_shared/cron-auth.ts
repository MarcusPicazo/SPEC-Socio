// Verifies that an incoming request to a cron-triggered function (followups,
// weekly-report) actually came from our own pg_cron job and not from
// someone who found the public function URL — same principle as every
// other webhook in this project, applied to our own scheduler instead of
// a third party. The migration's wrapper functions send this as a header
// because the caller's Authorization bearer token is just the public
// anon/publishable key, which isn't a secret by itself.
import { timingSafeEqual } from './meta-signature.ts'

export function verifyCronSecret(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('X-Cron-Secret')
  if (!expected || !provided) return false
  return timingSafeEqual(expected, provided)
}
