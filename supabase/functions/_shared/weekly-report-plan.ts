// The "which businesses get their weekly report right now" logic for the
// weekly-report cron job — same separation as followup-plan.ts, and for
// the same reason: whether "now" is Monday 8am in a business's own
// timezone is exactly the kind of thing worth getting right with tests,
// not just reading the code. The already-sent-this-week idempotency check
// needs a DB read, so it stays in weekly-report/index.ts.
import { isMondayAtLocalHour } from './local-time.ts'

export interface ReportCandidate {
  businessId: string
  businessName: string
  businessTimezone: string
  subscriptionStatus: string
}

export type ReportDecision =
  | { action: 'send'; candidate: ReportCandidate }
  | { action: 'skip_not_window'; candidate: ReportCandidate }
  | { action: 'skip_canceled'; candidate: ReportCandidate }

export function planWeeklyReports(
  candidates: ReportCandidate[],
  now: number = Date.now(),
): ReportDecision[] {
  return candidates.map((candidate) => {
    if (candidate.subscriptionStatus === 'canceled') {
      return { action: 'skip_canceled', candidate }
    }
    if (!isMondayAtLocalHour(candidate.businessTimezone, 8, now)) {
      return { action: 'skip_not_window', candidate }
    }
    return { action: 'send', candidate }
  })
}
