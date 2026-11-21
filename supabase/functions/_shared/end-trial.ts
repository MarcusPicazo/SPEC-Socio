// Ends a business's trial today, so Stripe charges the $199 plan now and
// starts the first paid cycle. Used by the owner's "Empezar mi plan hoy"
// button (whatsapp-webhook) and by the operator's button in /admin
// (operator-end-trial).
//
// Stripe (docs.stripe.com/billing/subscriptions/trials and
// /billing/subscriptions/change-price, checked 2026-11-21): updating a
// subscription with trial_end: 'now' ends the trial, resets the billing
// cycle anchor and Stripe immediately attempts payment. If that payment
// fails the update still succeeds and the subscription goes to past_due —
// so the returned status, not the absence of an error, says whether the
// owner was actually charged.
//
// Double taps: a claim row in `events` (provider_event_id is unique) makes
// sure only one request ever calls Stripe for the same subscription. It's
// removed again if Stripe errors, so the owner can retry.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { isUniqueViolation } from './postgrest-errors.ts'
import { createStripeClient } from './stripe.ts'
import { mapStripeSubscriptionStatus, stripeTimestampToIso, subscriptionCurrentPeriod } from './subscription-status.ts'
import type { Business, TrialCapStatus } from './types.ts'

export type EndTrialSource = 'owner_button' | 'operator'

export type EndTrialResult =
  | { outcome: 'charged'; periodStart: string | null; nextChargeAt: string | null }
  | { outcome: 'already_active'; nextChargeAt: string | null }
  | { outcome: 'no_subscription' }
  | { outcome: 'not_trialing' }
  | { outcome: 'in_progress' }
  | { outcome: 'payment_failed' }
  | { outcome: 'error'; error: string }

const CAP_STATUS_BY_SOURCE: Record<EndTrialSource, TrialCapStatus> = {
  owner_button: 'owner_started_plan',
  operator: 'operator_ended_trial',
}

export async function endTrialNow(
  admin: SupabaseClient,
  business: Business,
  source: EndTrialSource,
): Promise<EndTrialResult> {
  const result = await runEndTrial(admin, business, source)
  await admin.from('events').insert({
    business_id: business.id,
    type: 'billing.end_trial_attempt',
    payload: { source, ...result },
  })
  return result
}

async function runEndTrial(admin: SupabaseClient, business: Business, source: EndTrialSource): Promise<EndTrialResult> {
  if (business.subscription_status === 'active') {
    return { outcome: 'already_active', nextChargeAt: business.billing_period_end }
  }
  if (!business.stripe_subscription_id) return { outcome: 'no_subscription' }
  if (business.subscription_status !== 'trialing') return { outcome: 'not_trialing' }

  const claimId = `end_trial:${business.stripe_subscription_id}`
  const { error: claimError } = await admin.from('events').insert({
    business_id: business.id,
    type: 'billing.end_trial_claim',
    payload: { source },
    provider_event_id: claimId,
  })
  if (claimError) {
    if (isUniqueViolation(claimError)) return { outcome: 'in_progress' }
    return { outcome: 'error', error: claimError.message }
  }

  let subscription
  try {
    const stripe = createStripeClient()
    subscription = await stripe.subscriptions.update(business.stripe_subscription_id, { trial_end: 'now' })
  } catch (error) {
    await admin.from('events').delete().eq('provider_event_id', claimId)
    return { outcome: 'error', error: error instanceof Error ? error.message : String(error) }
  }

  const mappedStatus = mapStripeSubscriptionStatus(subscription.status) ?? business.subscription_status
  const period = subscriptionCurrentPeriod(subscription)
  const now = new Date().toISOString()

  await admin
    .from('businesses')
    .update({
      subscription_status: mappedStatus,
      subscription_status_since: mappedStatus !== business.subscription_status ? now : business.subscription_status_since,
      trial_ends_at: stripeTimestampToIso(subscription.trial_end),
      billing_period_start: period.start,
      billing_period_end: period.end,
      trial_cap_status: CAP_STATUS_BY_SOURCE[source],
      trial_cap_status_since: now,
    })
    .eq('id', business.id)

  if (subscription.status !== 'active') return { outcome: 'payment_failed' }
  return { outcome: 'charged', periodStart: period.start, nextChargeAt: period.end }
}
