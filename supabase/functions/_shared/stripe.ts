// Stripe client factory, shared by create-checkout-link, stripe-webhook,
// and billing-reminders. STRIPE_API_VERSION is optional and left unset by
// default — the npm:stripe SDK pins its own default API version, which is
// safer than this code guessing a date string that might not exist.
import Stripe from 'npm:stripe@23.0.0'

export function createStripeClient(): Stripe {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    throw new Error('Falta STRIPE_SECRET_KEY en el entorno de la función.')
  }
  const apiVersion = Deno.env.get('STRIPE_API_VERSION')
  return new Stripe(secretKey, apiVersion ? { apiVersion: apiVersion as Stripe.LatestApiVersion } : {})
}

/**
 * Deno has no Node `crypto` module, so webhook signature verification must
 * run on Web Crypto instead — Stripe's SDK supports this via
 * constructEventAsync plus an explicit SubtleCryptoProvider (the sync
 * constructEvent assumes Node crypto and doesn't work here).
 */
export async function verifyStripeWebhook(
  stripe: Stripe,
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<Stripe.Event> {
  const cryptoProvider = Stripe.createSubtleCryptoProvider()
  return await stripe.webhooks.constructEventAsync(rawBody, signatureHeader, webhookSecret, undefined, cryptoProvider)
}

export type { Stripe }
