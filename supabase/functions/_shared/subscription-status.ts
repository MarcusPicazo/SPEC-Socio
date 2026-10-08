import type { SubscriptionStatus } from './types.ts'

/**
 * Stripe's subscription.status values that map directly onto our own
 * enum. `unpaid` (Smart Retries exhausted, collection method automatic)
 * is treated the same as past_due — SPEC never cuts service either way,
 * so the distinction doesn't change what we do with it. Anything else
 * (incomplete, incomplete_expired, paused — none of which this project's
 * trial-based Checkout flow should ever actually produce) returns null
 * so the caller can log it and skip the update instead of guessing.
 */
export function mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus | null {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return null
  }
}

/** Stripe timestamps are Unix seconds, or null/undefined when not set. */
export function stripeTimestampToIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds === null || unixSeconds === undefined) return null
  return new Date(unixSeconds * 1000).toISOString()
}
