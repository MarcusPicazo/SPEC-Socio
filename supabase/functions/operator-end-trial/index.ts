// "Terminar prueba y cobrar hoy" in /admin: the operator's decision for a
// trial that hit 150 minutes. Same Stripe step as the owner's button
// (_shared/end-trial.ts). Only callable by an authenticated operator —
// same pattern as create-checkout-link.
//
// The owner is told by WhatsApp free text. Outside the 24-hour window that
// can't be delivered (there's no template for it); the response says so,
// so the operator can tell the owner directly.

import { z } from 'npm:zod@3.23.8'
import { corsHeaders } from '../_shared/cors.ts'
import { endTrialNow } from '../_shared/end-trial.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase-admin.ts'
import type { Business } from '../_shared/types.ts'
import { buildPlanStartedMessage } from '../_shared/usage.ts'
import { sendFreeText } from '../_shared/whatsapp.ts'

const requestSchema = z.object({ business_id: z.string().uuid() })

const OUTCOME_ERRORS_ES: Record<string, string> = {
  already_active: 'Este negocio ya tiene su plan activo. No se cobró nada.',
  no_subscription: 'Este negocio todavía no tiene tarjeta registrada. Mándale primero el link de pago.',
  not_trialing: 'La suscripción no está en prueba (está vencida o cancelada). No se cobró nada.',
  in_progress: 'Ya hay un cobro en proceso para este negocio.',
  payment_failed: 'Stripe intentó cobrar y la tarjeta falló. La suscripción quedó con pago atrasado.',
}

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
  const { data: businessRow, error: businessError } = await admin
    .from('businesses')
    .select('*')
    .eq('id', parsedBody.data.business_id)
    .single()
  if (businessError || !businessRow) return jsonResponse({ error: 'Negocio no encontrado.' }, 404)
  const business = businessRow as Business

  const result = await endTrialNow(admin, business, 'operator')

  if (result.outcome === 'error') return jsonResponse({ error: `Stripe: ${result.error}` }, 502)
  if (result.outcome !== 'charged') {
    return jsonResponse({ error: OUTCOME_ERRORS_ES[result.outcome] ?? result.outcome }, 409)
  }

  const notification = await sendFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    body: buildPlanStartedMessage({ nextChargeAtIso: result.nextChargeAt, timeZone: business.timezone }),
  })

  return jsonResponse(
    {
      billing_period_start: result.periodStart,
      next_charge_at: result.nextChargeAt,
      whatsapp_sent: notification.success,
      whatsapp_error: notification.error,
    },
    200,
  )
})
