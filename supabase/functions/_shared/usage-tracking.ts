// Counts a call's minutes and sends the owner's 80 % / 100 % alerts.
// Database side of _shared/usage.ts. Called by voice-webhook after the
// call row exists — including on a redelivered webhook, because
// record_call_usage is idempotent (it only counts a call whose
// usage_period_id is still null) and a redelivery is also the chance to
// finish an alert that a crashed first delivery never sent.
//
// Every step is logged to `events`, so /admin shows why an alert did or
// didn't go out without opening the function logs.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { z } from 'npm:zod@3.23.8'
import type { Business, UsageAlertLevel, UsagePeriod } from './types.ts'
import {
  alertSentField,
  alertsDue,
  billedMinutes,
  buildTrialCapMessage,
  buildUsageAlertMessage,
  ownerAlertLevel,
  START_PLAN_BUTTON_PREFIX,
  START_PLAN_BUTTON_TITLE,
} from './usage.ts'
import { sendTemplateOrFreeText, type SendResult } from './whatsapp.ts'
import { AVISO_MINUTOS_TEMPLATE, TEMPLATE_LANGUAGE, TOPE_PRUEBA_TEMPLATE } from './whatsapp-templates.ts'

const usagePeriodSchema = z.object({
  id: z.string(),
  business_id: z.string(),
  kind: z.enum(['trial', 'paid']),
  period_start: z.string(),
  period_end: z.string().nullable(),
  included_minutes: z.number().int().positive(),
  used_seconds: z.number().nonnegative(),
  alert_80_sent_at: z.string().nullable(),
  alert_100_sent_at: z.string().nullable(),
  alert_200_sent_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const recordResultSchema = z.object({ counted: z.boolean(), period: usagePeriodSchema })

/** Marks one alert level as sent, atomically. False if another delivery already claimed it. */
async function claimAlert(admin: SupabaseClient, periodId: string, level: UsageAlertLevel): Promise<boolean> {
  const field = alertSentField(level)
  const { data, error } = await admin
    .from('usage_periods')
    .update({ [field]: new Date().toISOString() })
    .eq('id', periodId)
    .is(field, null)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

/** tope_prueba with the "Empezar mi plan hoy" button. Also used for the 24 h reminder. */
export async function sendTrialCapMessage(
  admin: SupabaseClient,
  business: Business,
  usedMinutes: number,
): Promise<SendResult> {
  const message = buildTrialCapMessage({ ownerName: business.owner_name, usedMinutes })
  const payload = `${START_PLAN_BUTTON_PREFIX}${business.id}`
  return await sendTemplateOrFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    freeText: message.freeText,
    freeTextButtons: [{ id: payload, title: START_PLAN_BUTTON_TITLE }],
    template: {
      name: TOPE_PRUEBA_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: message.templateParams,
      buttonPayloads: [{ payload }],
    },
  })
}

async function sendUsageAlert(
  admin: SupabaseClient,
  business: Business,
  period: UsagePeriod,
  level: 80 | 100,
): Promise<SendResult> {
  const message = buildUsageAlertMessage({
    ownerName: business.owner_name,
    kind: period.kind,
    level,
    usedMinutes: billedMinutes(period.used_seconds),
    includedMinutes: period.included_minutes,
  })
  return await sendTemplateOrFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    freeText: message.freeText,
    template: {
      name: AVISO_MINUTOS_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: message.templateParams,
    },
  })
}

export async function recordCallUsage(admin: SupabaseClient, business: Business, callRowId: string): Promise<void> {
  const { data, error } = await admin.rpc('record_call_usage', { p_call_id: callRowId })
  if (error) throw error

  const parsed = recordResultSchema.safeParse(data)
  if (!parsed.success) throw new Error(`record_call_usage devolvió una forma inesperada: ${parsed.error.message}`)
  const { counted, period } = parsed.data
  const usedMinutes = billedMinutes(period.used_seconds)

  if (counted) {
    await admin.from('events').insert({
      business_id: business.id,
      type: 'usage.call_counted',
      payload: {
        call_row_id: callRowId,
        period_id: period.id,
        kind: period.kind,
        used_seconds: period.used_seconds,
        used_minutes: usedMinutes,
        included_minutes: period.included_minutes,
      },
    })
  }

  const claimed: UsageAlertLevel[] = []
  for (const level of alertsDue(period)) {
    if (await claimAlert(admin, period.id, level)) claimed.push(level)
  }
  if (claimed.length === 0) return

  const basePayload = {
    period_id: period.id,
    kind: period.kind,
    used_minutes: usedMinutes,
    included_minutes: period.included_minutes,
  }

  if (claimed.includes(200)) {
    // Operator-only: trial already at double its cap and still undecided.
    await admin.from('events').insert({
      business_id: business.id,
      type: 'usage.trial_double_cap',
      payload: basePayload,
    })
  }

  const level = ownerAlertLevel(claimed)
  if (level === null) return

  if (period.kind === 'trial' && level === 100) {
    const sinceIso = new Date().toISOString()
    await admin
      .from('businesses')
      .update({ trial_cap_status: 'pending_decision', trial_cap_status_since: sinceIso })
      .eq('id', business.id)
      .eq('trial_cap_status', 'none')

    const result = await sendTrialCapMessage(admin, business, usedMinutes)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'usage.trial_cap_reached',
      payload: { ...basePayload, whatsapp_sent: result.success, whatsapp_error: result.error },
    })
    return
  }

  const result = await sendUsageAlert(admin, business, period, level)
  await admin.from('events').insert({
    business_id: business.id,
    type: 'usage.alert_sent',
    payload: { ...basePayload, level, whatsapp_sent: result.success, whatsapp_error: result.error },
  })
}
