// One-time setup: creates (or reuses) the "Socio Base" product and its
// $199/month price with a 14-day trial. Idempotent — safe to run again,
// it just reports what already exists instead of creating a duplicate.
//
// Run with: STRIPE_SECRET_KEY=sk_... deno run --allow-net --allow-env scripts/stripe-setup.ts
// (or export the var first). Prints the price id to put in STRIPE_PRICE_ID.

import Stripe from 'npm:stripe@23.0.0'

const PRODUCT_NAME = 'Socio Base'
const UNIT_AMOUNT = 19900 // $199.00, in cents
const CURRENCY = 'usd'
const TRIAL_PERIOD_DAYS = 14

const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
if (!secretKey) {
  console.error('Falta STRIPE_SECRET_KEY en el entorno.')
  Deno.exit(1)
}

const apiVersion = Deno.env.get('STRIPE_API_VERSION')
const stripe = new Stripe(secretKey, apiVersion ? { apiVersion: apiVersion as Stripe.LatestApiVersion } : {})

async function findExistingProduct(): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ active: true, limit: 100 })
  return products.data.find((product) => product.name === PRODUCT_NAME) ?? null
}

async function findExistingPrice(productId: string): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  return (
    prices.data.find(
      (price) =>
        price.unit_amount === UNIT_AMOUNT &&
        price.currency === CURRENCY &&
        price.recurring?.interval === 'month',
    ) ?? null
  )
}

async function main() {
  let product = await findExistingProduct()
  if (product) {
    console.log(`Producto ya existe: ${product.id} (${product.name})`)
  } else {
    product = await stripe.products.create({ name: PRODUCT_NAME })
    console.log(`Producto creado: ${product.id} (${product.name})`)
  }

  let price = await findExistingPrice(product.id)
  if (price) {
    console.log(`Precio ya existe: ${price.id} ($${UNIT_AMOUNT / 100}/mes)`)
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: UNIT_AMOUNT,
      currency: CURRENCY,
      recurring: { interval: 'month' },
    })
    console.log(`Precio creado: ${price.id} ($${UNIT_AMOUNT / 100}/mes)`)
  }

  console.log(
    `\nNota: el período de prueba de ${TRIAL_PERIOD_DAYS} días se aplica al crear cada Checkout\n` +
      `Session (subscription_data.trial_period_days), no en el precio — Stripe no soporta un\n` +
      `trial fijo en el Price mismo. Ver supabase/functions/create-checkout-link/index.ts.\n`,
  )
  console.log(`STRIPE_PRICE_ID=${price.id}`)
}

await main()
