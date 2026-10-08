// Runs hourly (see the migration's cron.schedule). For each quote that's
// been sent/viewed but not accepted for 3+ days and never followed up:
// sends the customer a reminder email, bumps followup_count (so it's only
// ever sent once), and tells the owner with seguimiento_enviado. Skips
// quotes outside the business's own 9am-6pm local window — they stay
// eligible and get picked up on a later run, same local day or the next.
//
// Deliberately widened from the literal "status sent" in the task to
// "status in (sent, viewed)" — a quote the customer opened but didn't
// accept needs the reminder at least as much as one they never opened.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { verifyCronSecret } from '../_shared/cron-auth.ts'
import { planFollowups, type FollowupCandidate } from '../_shared/followup-plan.ts'
import { formatUsd } from '../_shared/quote-helpers.ts'
import { sendFollowupEmail } from '../_shared/quote-email.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendTemplateOrFreeText } from '../_shared/whatsapp.ts'
import { SEGUIMIENTO_ENVIADO_TEMPLATE, TEMPLATE_LANGUAGE } from '../_shared/whatsapp-templates.ts'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface CandidateRow {
  id: string
  number: string
  total: number
  followup_count: number
  public_token: string
  customer_id: string
  customers: { name: string | null; email: string | null } | null
  businesses: { id: string; name: string; timezone: string; owner_whatsapp: string } | null
}

async function fetchCandidates(admin: SupabaseClient): Promise<CandidateRow[]> {
  const threeDaysAgo = new Date(Date.now() - THREE_DAYS_MS).toISOString()
  const { data, error } = await admin
    .from('quotes')
    .select('id, number, total, followup_count, public_token, customer_id, customers(name, email), businesses(id, name, timezone, owner_whatsapp)')
    .in('status', ['sent', 'viewed'])
    .eq('followup_count', 0)
    .lte('sent_at', threeDaysAgo)
  if (error) throw error
  return (data ?? []) as unknown as CandidateRow[]
}

async function sendReminder(admin: SupabaseClient, row: CandidateRow): Promise<void> {
  const business = row.businesses as NonNullable<CandidateRow['businesses']>
  const customer = row.customers as NonNullable<CandidateRow['customers']>
  const appBaseUrl = Deno.env.get('APP_BASE_URL')

  if (!appBaseUrl) {
    console.error('Falta APP_BASE_URL — no se pudo mandar el recordatorio.')
    return
  }
  // customer.email is guaranteed by planFollowups' skip_no_email branch.
  const email = customer.email as string
  const publicUrl = `${appBaseUrl}/q/${row.public_token}`

  const emailResult = await sendFollowupEmail({
    to: email,
    businessName: business.name,
    customerName: customer.name,
    quoteNumber: row.number,
    total: row.total,
    publicUrl,
  })

  await admin.from('messages').insert({
    business_id: business.id,
    direction: 'outbound',
    channel: 'email',
    to_addr: email,
    from_addr: Deno.env.get('RESEND_FROM_EMAIL') ?? null,
    template: 'quote_followup_email',
    body: publicUrl,
    provider_message_id: emailResult.providerMessageId,
    status: emailResult.success ? 'sent' : 'failed',
  })

  if (!emailResult.success) {
    console.error('No se pudo mandar el recordatorio de la cotización', emailResult.error)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'quote.followup_email_failed',
      payload: { quote_id: row.id, error: emailResult.error },
    })
    return // not bumped — retried on a later run
  }

  await admin.from('quotes').update({ followup_count: row.followup_count + 1 }).eq('id', row.id)

  const amount = formatUsd(row.total)
  const customerName = customer.name ?? 'Tu cliente'
  const notification = await sendTemplateOrFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    freeText: `📨 Le mandé un recordatorio a ${customerName} sobre la cotización ${row.number} (${amount}).`,
    template: {
      name: SEGUIMIENTO_ENVIADO_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: [customerName, row.number, amount],
    },
  })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'quote.followup_sent',
    payload: { quote_id: row.id, number: row.number, whatsapp_sent: notification.success, whatsapp_error: notification.error },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)
  if (!verifyCronSecret(req)) return jsonResponse({ error: 'Secreto inválido.' }, 401)

  const admin = createAdminClient()
  const rows = await fetchCandidates(admin)

  const candidates: FollowupCandidate[] = rows
    .filter((row) => row.businesses)
    .map((row) => ({
      quoteId: row.id,
      quoteNumber: row.number,
      total: row.total,
      customerName: row.customers?.name ?? null,
      customerEmail: row.customers?.email ?? null,
      businessId: (row.businesses as NonNullable<CandidateRow['businesses']>).id,
      businessTimezone: (row.businesses as NonNullable<CandidateRow['businesses']>).timezone,
    }))
  const byQuoteId = new Map(rows.map((row) => [row.id, row]))

  const decisions = planFollowups(candidates)

  let sent = 0
  let skippedOutsideHours = 0
  let skippedNoEmail = 0

  for (const decision of decisions) {
    const row = byQuoteId.get(decision.candidate.quoteId)
    if (!row) continue

    if (decision.action === 'skip_outside_hours') {
      skippedOutsideHours++
      continue
    }
    if (decision.action === 'skip_no_email') {
      skippedNoEmail++
      await admin.from('quotes').update({ followup_count: row.followup_count + 1 }).eq('id', row.id)
      await admin.from('events').insert({
        business_id: row.businesses?.id ?? null,
        type: 'quote.followup_skipped_no_email',
        payload: { quote_id: row.id },
      })
      continue
    }

    await sendReminder(admin, row)
    sent++
  }

  return jsonResponse(
    { ok: true, candidates: rows.length, sent, skipped_outside_hours: skippedOutsideHours, skipped_no_email: skippedNoEmail },
    200,
  )
})
