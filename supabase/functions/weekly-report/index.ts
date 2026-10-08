// Runs hourly (see the migration's cron.schedule) and, for each business,
// only actually sends during the one local hour that is Monday 8am for
// that business — a single global cron can't run "once per business, at
// each business's own Monday 8am" any other way. Idempotent via the
// report.weekly_sent event: if the hourly run somehow fires twice inside
// that hour, the second pass is a no-op.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { verifyCronSecret } from '../_shared/cron-auth.ts'
import { computeWeeklyStats } from '../_shared/report-helpers.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'
import type { Business, CallExtraction } from '../_shared/types.ts'
import { sendTemplateOrFreeText } from '../_shared/whatsapp.ts'
import { REPORTE_SEMANAL_TEMPLATE, TEMPLATE_LANGUAGE } from '../_shared/whatsapp-templates.ts'
import { planWeeklyReports, type ReportCandidate } from '../_shared/weekly-report-plan.ts'
import { formatUsd } from '../_shared/quote-helpers.ts'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function alreadySentThisWeek(admin: SupabaseClient, businessId: string): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const { data } = await admin
    .from('events')
    .select('id')
    .eq('business_id', businessId)
    .eq('type', 'report.weekly_sent')
    .gte('created_at', sevenDaysAgo)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

async function sendReportFor(admin: SupabaseClient, business: Business): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

  const { data: calls } = await admin
    .from('calls')
    .select('is_spam, extracted')
    .eq('business_id', business.id)
    .gte('created_at', sevenDaysAgo)

  const { data: sentQuotes } = await admin
    .from('quotes')
    .select('id')
    .eq('business_id', business.id)
    .gte('sent_at', sevenDaysAgo)

  const { data: acceptedQuotes } = await admin
    .from('quotes')
    .select('total')
    .eq('business_id', business.id)
    .gte('accepted_at', sevenDaysAgo)

  const stats = computeWeeklyStats({
    calls: (calls ?? []) as Array<{ is_spam: boolean; extracted: CallExtraction | null }>,
    sentQuoteCount: (sentQuotes ?? []).length,
    acceptedQuotes: (acceptedQuotes ?? []) as Array<{ total: number }>,
  })

  const amountStr = formatUsd(stats.amountAccepted)
  const freeText =
    `📊 *Reporte semanal — ${business.name}*\n` +
    `Llamadas contestadas: ${stats.answered}\n` +
    `Urgentes: ${stats.urgent}\n` +
    `Cotizaciones enviadas: ${stats.quotesSent}\n` +
    `Aceptadas: ${stats.quotesAccepted}\n` +
    `Monto aceptado: ${amountStr}`

  const notification = await sendTemplateOrFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    freeText,
    template: {
      name: REPORTE_SEMANAL_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: [
        business.name,
        String(stats.answered),
        String(stats.urgent),
        String(stats.quotesSent),
        String(stats.quotesAccepted),
        amountStr,
      ],
    },
  })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'report.weekly_sent',
    payload: { ...stats, whatsapp_sent: notification.success, whatsapp_error: notification.error },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)
  if (!verifyCronSecret(req)) return jsonResponse({ error: 'Secreto inválido.' }, 401)

  const admin = createAdminClient()
  const { data: businesses, error } = await admin.from('businesses').select('*')
  if (error) throw error

  const candidates: ReportCandidate[] = ((businesses ?? []) as Business[]).map((business) => ({
    businessId: business.id,
    businessName: business.name,
    businessTimezone: business.timezone,
    subscriptionStatus: business.subscription_status,
  }))
  const byId = new Map(((businesses ?? []) as Business[]).map((business) => [business.id, business]))

  const decisions = planWeeklyReports(candidates)

  let sent = 0
  let skippedNotWindow = 0
  let skippedCanceled = 0
  let skippedAlreadySent = 0

  for (const decision of decisions) {
    if (decision.action === 'skip_not_window') {
      skippedNotWindow++
      continue
    }
    if (decision.action === 'skip_canceled') {
      skippedCanceled++
      continue
    }

    const business = byId.get(decision.candidate.businessId)
    if (!business) continue

    if (await alreadySentThisWeek(admin, business.id)) {
      skippedAlreadySent++
      continue
    }

    await sendReportFor(admin, business)
    sent++
  }

  return jsonResponse(
    {
      ok: true,
      businesses: candidates.length,
      sent,
      skipped_not_window: skippedNotWindow,
      skipped_canceled: skippedCanceled,
      skipped_already_sent: skippedAlreadySent,
    },
    200,
  )
})
