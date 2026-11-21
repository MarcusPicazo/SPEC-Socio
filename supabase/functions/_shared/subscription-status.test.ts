import { assertEquals } from 'jsr:@std/assert@1'
import { mapStripeSubscriptionStatus, stripeTimestampToIso, subscriptionCurrentPeriod } from './subscription-status.ts'

Deno.test('mapStripeSubscriptionStatus maps the statuses our enum has directly', () => {
  assertEquals(mapStripeSubscriptionStatus('trialing'), 'trialing')
  assertEquals(mapStripeSubscriptionStatus('active'), 'active')
  assertEquals(mapStripeSubscriptionStatus('past_due'), 'past_due')
  assertEquals(mapStripeSubscriptionStatus('canceled'), 'canceled')
})

Deno.test('mapStripeSubscriptionStatus treats unpaid like past_due — we never cut service either way', () => {
  assertEquals(mapStripeSubscriptionStatus('unpaid'), 'past_due')
})

Deno.test('mapStripeSubscriptionStatus returns null for statuses outside our enum, instead of guessing', () => {
  assertEquals(mapStripeSubscriptionStatus('incomplete'), null)
  assertEquals(mapStripeSubscriptionStatus('incomplete_expired'), null)
  assertEquals(mapStripeSubscriptionStatus('paused'), null)
  assertEquals(mapStripeSubscriptionStatus('something_stripe_adds_later'), null)
})

Deno.test('stripeTimestampToIso converts Unix seconds to an ISO string', () => {
  assertEquals(stripeTimestampToIso(1700000000), new Date(1700000000 * 1000).toISOString())
})

Deno.test('stripeTimestampToIso returns null for null or undefined', () => {
  assertEquals(stripeTimestampToIso(null), null)
  assertEquals(stripeTimestampToIso(undefined), null)
})

Deno.test('subscriptionCurrentPeriod reads the dates from the first subscription item', () => {
  assertEquals(
    subscriptionCurrentPeriod({ items: { data: [{ current_period_start: 1795219200, current_period_end: 1797811200 }] } }),
    { start: '2026-11-21T00:00:00.000Z', end: '2026-12-21T00:00:00.000Z' },
  )
})

Deno.test('subscriptionCurrentPeriod returns nulls when there are no items', () => {
  assertEquals(subscriptionCurrentPeriod({ items: { data: [] } }), { start: null, end: null })
})
