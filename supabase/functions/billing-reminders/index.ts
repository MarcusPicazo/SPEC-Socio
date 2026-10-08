// Runs hourly (see the migration's cron.schedule). SPEC: a subscription
// that's past_due or canceled for more than 7 days never stops the
// assistant from answering — this only tells the owner to go fix their
// payment, via a Stripe Billing Portal link (not a new Checkout Session,
// which would start a SECOND subscription instead of fixing the existing
// one). Reminders repeat at most once a week while the problem persists,
// via the same events-based idempotency as weekly-report.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { verifyCronSecret } from '../_shared/cron-auth.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { createStripeClient } from '../_shared/stripe.ts'
import type { Business } from '../_shared/types.ts'
import { sendTemplateOrFreeText } from '../_shared/whatsapp.ts'
import { PAGO_PENDIENTE_TEMPLATE, TEMPLATE_LANGUAGE } from '../_shared/whatsapp-templates.ts'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const STATUS_LABEL_ES: Record<string, string> = {
  past_due: 'vencida',
  canceled: 'cancelada',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function fetchOverdueBusinesses(admin: SupabaseClient): Promise<Business[]> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const { data, error } = await admin
    .from('businesses')
    .select('*')
    .in('subscription_status', ['past_due', 'canceled'])
    .lte('subscription_status_since', sevenDaysAgo)
  if (error) throw error
  return (data ?? []) as Business[]
}

async function alreadyRemindedThisWeek(admin: SupabaseClient, businessId: string): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const { data } = await admin
    .from('events')
    .select('id')
    .eq('business_id', businessId)
    .eq('type', 'billing.reminder_sent')
    .gte('created_at', sevenDaysAgo)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

async function sendReminder(admin: SupabaseClient, business: Business): Promise<void> {
  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  if (!business.stripe_customer_id || !appBaseUrl) {
    console.error('Falta stripe_customer_id o APP_BASE_URL — no se pudo mandar el aviso de pago.', business.id)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'billing.reminder_failed',
      payload: { reason: 'missing_stripe_customer_id_or_app_base_url' },
    })
    return
  }

  let portalUrl: string
  try {
    const stripe = createStripeClient()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${appBaseUrl}/admin/negocios/${business.id}`,
    })
    portalUrl = portalSession.url
  } catch (error) {
    console.error('No se pudo crear la sesión del portal de Stripe', error)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'billing.reminder_failed',
      payload: { error: error instanceof Error ? error.message : String(error) },
    })
    return
  }

  const statusLabel = STATUS_LABEL_ES[business.subscription_status] ?? business.subscription_status

  const notification = await sendTemplateOrFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    freeText:
      `⚠️ Hola ${business.owner_name}, tu suscripción a Socio está ${statusLabel} desde hace más de 7 días. ` +
      `Tu línea sigue funcionando normalmente — no hemos cortado el servicio. Actualiza tu pago aquí: ${portalUrl}`,
    template: {
      name: PAGO_PENDIENTE_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: [business.owner_name, statusLabel, portalUrl],
    },
  })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'billing.reminder_sent',
    payload: {
      subscription_status: business.subscription_status,
      portal_url: portalUrl,
      whatsapp_sent: notification.success,
      whatsapp_error: notification.error,
    },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)
  if (!verifyCronSecret(req)) return jsonResponse({ error: 'Secreto inválido.' }, 401)

  const admin = createAdminClient()
  const businesses = await fetchOverdueBusinesses(admin)

  let sent = 0
  let skippedAlreadyReminded = 0

  for (const business of businesses) {
    if (await alreadyRemindedThisWeek(admin, business.id)) {
      skippedAlreadyReminded++
      continue
    }
    await sendReminder(admin, business)
    sent++
  }

  return jsonResponse({ ok: true, overdue: businesses.length, sent, skipped_already_reminded: skippedAlreadyReminded }, 200)
})
