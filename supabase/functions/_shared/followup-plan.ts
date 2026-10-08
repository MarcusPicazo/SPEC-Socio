// The "who gets a follow-up reminder right now, and why not otherwise" logic
// for the followups cron job — kept free of SupabaseClient/fetch so it can
// be tested (and demoed) without a database or network. The SQL query in
// followups/index.ts already filters to eligible candidates (status
// sent/viewed, followup_count = 0, sent_at 3+ days ago); this only decides
// among those, per business-local time and data completeness.
import { isWithinLocalHours } from './local-time.ts'

export interface FollowupCandidate {
  quoteId: string
  quoteNumber: string
  total: number
  customerName: string | null
  customerEmail: string | null
  businessId: string
  businessTimezone: string
}

export type FollowupDecision =
  | { action: 'send'; candidate: FollowupCandidate }
  | { action: 'skip_outside_hours'; candidate: FollowupCandidate }
  | { action: 'skip_no_email'; candidate: FollowupCandidate }

/** `skip_outside_hours` isn't final — the same quote stays eligible and gets reconsidered on a later hourly run. `skip_no_email` bumps followup_count (handled by the caller) since no email will ever appear on its own. */
export function planFollowups(
  candidates: FollowupCandidate[],
  now: number = Date.now(),
): FollowupDecision[] {
  return candidates.map((candidate) => {
    if (!isWithinLocalHours(candidate.businessTimezone, 9, 18, now)) {
      return { action: 'skip_outside_hours', candidate }
    }
    if (!candidate.customerEmail) {
      return { action: 'skip_no_email', candidate }
    }
    return { action: 'send', candidate }
  })
}
