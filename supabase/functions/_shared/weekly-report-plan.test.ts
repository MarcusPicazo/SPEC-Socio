import { assertEquals } from 'jsr:@std/assert@1'
import { planWeeklyReports, type ReportCandidate } from './weekly-report-plan.ts'

const MONDAY_08_CHICAGO = Date.UTC(2026, 0, 12, 14, 0, 0) // 08:00 Chicago, 06:00 LA
const MONDAY_14_CHICAGO = Date.UTC(2026, 0, 12, 20, 0, 0) // 14:00 Chicago — right day, wrong hour

const base: ReportCandidate = {
  businessId: 'b1',
  businessName: 'Martinez Roofing',
  businessTimezone: 'America/Chicago',
  subscriptionStatus: 'active',
}

Deno.test('planWeeklyReports sends at Monday 8am local', () => {
  const [decision] = planWeeklyReports([base], MONDAY_08_CHICAGO)
  assertEquals(decision, { action: 'send', candidate: base })
})

Deno.test('planWeeklyReports skips the same business at a different local hour', () => {
  const [decision] = planWeeklyReports([base], MONDAY_14_CHICAGO)
  assertEquals(decision?.action, 'skip_not_window')
})

Deno.test('planWeeklyReports skips a canceled business even during its own window', () => {
  const canceled = { ...base, subscriptionStatus: 'canceled' }
  const [decision] = planWeeklyReports([canceled], MONDAY_08_CHICAGO)
  assertEquals(decision?.action, 'skip_canceled')
})

Deno.test('planWeeklyReports evaluates each business in its own timezone independently', () => {
  const chicago = { ...base, businessId: 'b1', businessTimezone: 'America/Chicago' }
  const laAt8 = { ...base, businessId: 'b2', businessTimezone: 'America/Los_Angeles' }
  // At this instant it's 8am in Chicago but only 6am in LA.
  const decisions = planWeeklyReports([chicago, laAt8], MONDAY_08_CHICAGO)
  assertEquals(decisions[0]?.action, 'send')
  assertEquals(decisions[1]?.action, 'skip_not_window')
})
