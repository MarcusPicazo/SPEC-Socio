import { assertEquals } from 'jsr:@std/assert@1'
import { computeWeeklyStats } from './report-helpers.ts'

const call = (is_spam: boolean, urgency: 'emergency' | 'soon' | 'flexible' | null) => ({
  is_spam,
  extracted:
    urgency === null && is_spam
      ? null
      : {
          caller_name: null,
          callback_number: null,
          address: null,
          service_type: null,
          description: null,
          urgency,
          preferred_time: null,
          language: 'es' as const,
          is_spam,
        },
})

Deno.test('computeWeeklyStats counts answered calls, excluding spam', () => {
  const stats = computeWeeklyStats({
    calls: [call(false, 'soon'), call(false, 'flexible'), call(true, null)],
    sentQuoteCount: 0,
    acceptedQuotes: [],
  })
  assertEquals(stats.answered, 2)
})

Deno.test('computeWeeklyStats counts urgent calls only among non-spam', () => {
  const stats = computeWeeklyStats({
    calls: [call(false, 'emergency'), call(false, 'emergency'), call(false, 'soon'), call(true, 'emergency')],
    sentQuoteCount: 0,
    acceptedQuotes: [],
  })
  assertEquals(stats.urgent, 2)
})

Deno.test('computeWeeklyStats sums accepted amounts and rounds to the cent', () => {
  const stats = computeWeeklyStats({
    calls: [],
    sentQuoteCount: 5,
    acceptedQuotes: [{ total: 100.1 }, { total: 50.333 }],
  })
  assertEquals(stats.quotesSent, 5)
  assertEquals(stats.quotesAccepted, 2)
  assertEquals(stats.amountAccepted, 150.43)
})

Deno.test('computeWeeklyStats returns zeros for an empty week', () => {
  const stats = computeWeeklyStats({ calls: [], sentQuoteCount: 0, acceptedQuotes: [] })
  assertEquals(stats, { answered: 0, urgent: 0, quotesSent: 0, quotesAccepted: 0, amountAccepted: 0 })
})
