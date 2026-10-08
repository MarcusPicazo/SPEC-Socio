import type { CallExtraction } from './types.ts'

export interface WeeklyStats {
  answered: number
  urgent: number
  quotesSent: number
  quotesAccepted: number
  amountAccepted: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * SPEC weekly report fields, from the week's raw rows. "Answered" means
 * every non-spam call — by the time a call reaches `calls` it was already
 * handled by the voice agent, spam excluded since those were never real
 * business.
 */
export function computeWeeklyStats(args: {
  calls: Array<{ is_spam: boolean; extracted: CallExtraction | null }>
  sentQuoteCount: number
  acceptedQuotes: Array<{ total: number }>
}): WeeklyStats {
  const answeredCalls = args.calls.filter((call) => !call.is_spam)
  const urgent = answeredCalls.filter((call) => call.extracted?.urgency === 'emergency').length
  const amountAccepted = roundMoney(args.acceptedQuotes.reduce((sum, quote) => sum + quote.total, 0))

  return {
    answered: answeredCalls.length,
    urgent,
    quotesSent: args.sentQuoteCount,
    quotesAccepted: args.acceptedQuotes.length,
    amountAccepted,
  }
}
