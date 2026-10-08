// Called by the "Generar link de pago" button in /admin. Creates (or
// reuses) the business's Stripe customer, opens a Checkout Session for
// the Socio Base subscription with its 14-day trial, and sends the link
// to the owner on WhatsApp. Only callable by an authenticated operator —
// same pattern as provision-business.

import { z } from 'npm:zod@3.23.8'
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase-admin.ts'
import { createStripeClient } from '../_shared/stripe.ts'
import type { Business } from '../_shared/types.ts'
import { sendTemplateOrFreeText } from '../_shared/whatsapp.ts'
import { LINK_DE_PAGO_TEMPLATE, TEMPLATE_LANGUAGE } from '../_shared/whatsapp-templates.ts'

const TRIAL_PERIOD_DAYS = 14

const requestSchema = z.object({ business_id: z.string().uuid() })

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Falta autenticación.' }, 401)

  const userClient = createUserClient(authHeader)
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Sesión inválida.' }, 401)

  const { data: operatorRow } = await userClient
    .from('operators')
    .select('id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!operatorRow) return jsonResponse({ error: 'Esta cuenta no tiene permiso de operador.' }, 403)

  let requestBody: unknown
  try {
    requestBody = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400)
  }

  const parsedBody = requestSchema.safeParse(requestBody)
  if (!parsedBody.success) return jsonResponse({ error: 'business_id inválido.' }, 400)

  const admin = createAdminClient()
  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('*')
    .eq('id', parsedBody.data.business_id)
    .single()
  if (businessError || !business) return jsonResponse({ error: 'Negocio no encontrado.' }, 404)

  const typedBusiness = business as Business

  if (typedBusiness.subscription_status === 'active') {
    return jsonResponse({ error: 'Este negocio ya tiene una suscripción activa.' }, 400)
  }

  const priceId = Deno.env.get('STRIPE_PRICE_ID')
  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  if (!priceId || !appBaseUrl) {
    return jsonResponse({ error: 'Faltan STRIPE_PRICE_ID o APP_BASE_URL en los secretos de la función.' }, 500)
  }

  try {
    const stripe = createStripeClient()

    let stripeCustomerId = typedBusiness.stripe_customer_id
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: typedBusiness.name,
        metadata: { business_id: typedBusiness.id },
      })
      stripeCustomerId = customer.id
      await admin.from('businesses').update({ stripe_customer_id: stripeCustomerId }).eq('id', typedBusiness.id)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { business_id: typedBusiness.id },
      },
      client_reference_id: typedBusiness.id,
      success_url: `${appBaseUrl}/admin/negocios/${typedBusiness.id}?pago=exito`,
      cancel_url: `${appBaseUrl}/admin/negocios/${typedBusiness.id}?pago=cancelado`,
    })

    if (!session.url) throw new Error('Stripe no devolvió una URL de Checkout.')

    const notification = await sendTemplateOrFreeText(admin, {
      businessId: typedBusiness.id,
      to: typedBusiness.owner_whatsapp,
      freeText: `💳 Aquí está tu link para activar tu suscripción a Socio (14 días de prueba gratis): ${session.url}`,
      template: {
        name: LINK_DE_PAGO_TEMPLATE.name,
        languageCode: TEMPLATE_LANGUAGE,
        bodyParams: [typedBusiness.owner_name, session.url],
      },
    })

    await admin.from('events').insert({
      business_id: typedBusiness.id,
      type: 'billing.checkout_link_created',
      payload: {
        checkout_session_id: session.id,
        url: session.url,
        whatsapp_sent: notification.success,
        whatsapp_error: notification.error,
      },
    })

    return jsonResponse(
      { url: session.url, whatsapp_sent: notification.success, whatsapp_error: notification.error },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('create-checkout-link failed', message)

    await admin.from('events').insert({
      business_id: typedBusiness.id,
      type: 'billing.checkout_link_failed',
      payload: { error: message },
    })

    return jsonResponse({ error: message }, 502)
  }
})
