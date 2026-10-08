import { assertEquals } from 'jsr:@std/assert@1'
import { planFollowups, type FollowupCandidate } from './followup-plan.ts'

const MONDAY_14_CHICAGO = Date.UTC(2026, 0, 12, 20, 0, 0) // 14:00 Chicago, 12:00 LA
const SUNDAY_20_CHICAGO = Date.UTC(2026, 0, 12, 2, 0, 0) // 20:00 Chicago (after hours)

const base: FollowupCandidate = {
  quoteId: 'q1',
  quoteNumber: 'Q-0001',
  total: 500,
  customerName: 'Sarah',
  customerEmail: 'sarah@example.com',
  businessId: 'b1',
  businessTimezone: 'America/Chicago',
}

Deno.test('planFollowups sends when within business hours and the email is known', () => {
  const [decision] = planFollowups([base], MONDAY_14_CHICAGO)
  assertEquals(decision, { action: 'send', candidate: base })
})

Deno.test('planFollowups skips outside the 9am-6pm local window, without consuming the attempt', () => {
  const [decision] = planFollowups([base], SUNDAY_20_CHICAGO)
  assertEquals(decision?.action, 'skip_outside_hours')
})

Deno.test('planFollowups skips when the customer has no email, even inside the window', () => {
  const noEmail = { ...base, customerEmail: null }
  const [decision] = planFollowups([noEmail], MONDAY_14_CHICAGO)
  assertEquals(decision?.action, 'skip_no_email')
})

Deno.test('planFollowups respects each candidate\'s own business timezone', () => {
  const chicago = { ...base, quoteId: 'q1', businessTimezone: 'America/Chicago' }
  const tokyo = { ...base, quoteId: 'q2', businessTimezone: 'Asia/Tokyo' }
  const decisions = planFollowups([chicago, tokyo], MONDAY_14_CHICAGO)
  // 14:00 Chicago Mon == 05:00 Tokyo Tue — inside hours for Chicago, outside for Tokyo.
  assertEquals(decisions[0]?.action, 'send')
  assertEquals(decisions[1]?.action, 'skip_outside_hours')
})
