// Stripe calls this on every subscription change. Verifies the
// Stripe-Signature header (Web Crypto, since Deno has no Node crypto —
// see _shared/stripe.ts), is idempotent on the event id (same pattern as
// every other provider id in this project: calls.provider_call_id,
// messages.provider_message_id — here events.provider_event_id), and
// updates subscription_status/trial_ends_at/subscription_status_since.
//
// Deliberately only listens to customer.subscription.* — those events
// carry the subscription's .status directly, so there's no need to also
// handle invoice.payment_failed/checkout.session.completed for the same
// information (SPEC's only ask here is "keep subscription_status and
// trial_ends_at correct").

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { createStripeClient, verifyStripeWebhook, type Stripe } from '../_shared/stripe.ts'
import { mapStripeSubscriptionStatus, stripeTimestampToIso } from '../_shared/subscription-status.ts'
import type { Business } from '../_shared/types.ts'

const SUBSCRIPTION_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const signatureHeader = req.headers.get('Stripe-Signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!signatureHeader || !webhookSecret) {
    return jsonResponse({ error: 'Falta la firma o STRIPE_WEBHOOK_SECRET.' }, signatureHeader ? 500 : 400)
  }

  // Raw text first — constructEventAsync verifies the exact bytes Stripe
  // signed; parsing and re-serializing would change them.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    const stripe = createStripeClient()
    event = await verifyStripeWebhook(stripe, rawBody, signatureHeader, webhookSecret)
  } catch (error) {
    console.error('Firma de Stripe inválida', error)
    return jsonResponse({ error: 'Firma inválida.' }, 400)
  }

  const admin = createAdminClient()

  const { data: alreadyProcessed } = await admin
    .from('events')
    .select('id')
    .eq('provider_event_id', event.id)
    .maybeSingle()
  if (alreadyProcessed) return jsonResponse({ ok: true, duplicate: true }, 200)

  if (!SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
    await admin.from('events').insert({
      business_id: null,
      type: 'stripe.webhook_ignored',
      payload: { event_type: event.type },
      provider_event_id: event.id,
    })
    return jsonResponse({ ok: true, ignored: true }, 200)
  }

  const subscription = event.data.object as Stripe.Subscription
  const stripeCustomerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

  const { data: businessRow } = await admin
    .from('businesses')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle()

  if (!businessRow) {
    await admin.from('events').insert({
      business_id: null,
      type: 'stripe.unmatched_customer',
      payload: { stripe_customer_id: stripeCustomerId, event_type: event.type },
      provider_event_id: event.id,
    })
    return jsonResponse({ ok: true, unmatched: true }, 200)
  }

  const business = businessRow as Business
  const mappedStatus = mapStripeSubscriptionStatus(subscription.status)

  if (!mappedStatus) {
    await admin.from('events').insert({
      business_id: business.id,
      type: 'stripe.unmapped_status',
      payload: { stripe_status: subscription.status, event_type: event.type },
      provider_event_id: event.id,
    })
    return jsonResponse({ ok: true, unmapped: true }, 200)
  }

  const statusChanged = mappedStatus !== business.subscription_status
  const patch: Record<string, unknown> = {
    subscription_status: mappedStatus,
    trial_ends_at: stripeTimestampToIso(subscription.trial_end),
  }
  if (statusChanged) patch.subscription_status_since = new Date().toISOString()

  await admin.from('businesses').update(patch).eq('id', business.id)

  await admin.from('events').insert({
    business_id: business.id,
    type: 'stripe.subscription_status_updated',
    payload: {
      event_type: event.type,
      stripe_status: subscription.status,
      mapped_status: mappedStatus,
      status_changed: statusChanged,
    },
    provider_event_id: event.id,
  })

  return jsonResponse({ ok: true }, 200)
})
