// Pure logic for call minutes and the owner's usage alerts. No I/O here —
// usage-tracking.ts does the database and WhatsApp side.
//
// Plan rules (decided by the operator, 2026-11-21):
// - Trial: 14 days, capped at 150 minutes, counted from the day the
//   business was set up.
// - Paid: $199 USD/month, 500 minutes included per billing cycle, each
//   extra minute $0.25 USD (counted now, charged in a later task).
// - Minutes = exact seconds summed over the whole cycle, rounded UP once
//   (never per call). Spam calls count too — Vapi bills them.
// - Nothing ever cuts the line automatically.

import type { UsageAlertLevel, UsagePeriod, UsagePeriodKind } from './types.ts'

export const TRIAL_INCLUDED_MINUTES = 150
export const PAID_INCLUDED_MINUTES = 500
export const PLAN_PRICE_USD = 199
export const OVERAGE_PRICE_PER_MINUTE_USD = 0.25

/** Whole-cycle rounding: 61s + 59s = 120s = 2 min, not 3. */
export function billedMinutes(usedSeconds: number): number {
  if (!Number.isFinite(usedSeconds) || usedSeconds <= 0) return 0
  return Math.ceil(usedSeconds / 60)
}

export function overageMinutes(usedSeconds: number, includedMinutes: number): number {
  return Math.max(0, billedMinutes(usedSeconds) - includedMinutes)
}

function thresholdMinutes(level: UsageAlertLevel, includedMinutes: number): number {
  return Math.ceil((includedMinutes * level) / 100)
}

export type AlertSentField = 'alert_80_sent_at' | 'alert_100_sent_at' | 'alert_200_sent_at'

const ALERT_SENT_FIELD: Record<UsageAlertLevel, AlertSentField> = {
  80: 'alert_80_sent_at',
  100: 'alert_100_sent_at',
  200: 'alert_200_sent_at',
}

export function alertSentField(level: UsageAlertLevel): AlertSentField {
  return ALERT_SENT_FIELD[level]
}

/**
 * Every alert level the period has reached but not yet sent, lowest first.
 * Based on the period's current state (not on "before vs. after this
 * call"), so an alert that failed to go out is picked up on the next call.
 * 200 % only exists for the trial — it's the operator's second warning at
 * 300 minutes, never an owner message.
 */
export function alertsDue(
  period: Pick<UsagePeriod, 'kind' | 'used_seconds' | 'included_minutes' | 'alert_80_sent_at' | 'alert_100_sent_at' | 'alert_200_sent_at'>,
): UsageAlertLevel[] {
  const levels: UsageAlertLevel[] = period.kind === 'trial' ? [80, 100, 200] : [80, 100]
  const used = billedMinutes(period.used_seconds)
  return levels.filter(
    (level) => used >= thresholdMinutes(level, period.included_minutes) && !period[alertSentField(level)],
  )
}

/**
 * The single owner message to send for the levels just claimed: only the
 * highest of 80/100 (one long call can jump straight past both — the owner
 * shouldn't get "80 %" and "100 %" back to back). 200 never goes to the owner.
 */
export function ownerAlertLevel(claimedLevels: UsageAlertLevel[]): 80 | 100 | null {
  if (claimedLevels.includes(100)) return 100
  if (claimedLevels.includes(80)) return 80
  return null
}

export function trialDaysLeft(trialEndsAtIso: string | null, now: number = Date.now()): number | null {
  if (!trialEndsAtIso) return null
  const end = Date.parse(trialEndsAtIso)
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)))
}

/** "21 de diciembre de 2026", in the business's own time zone. */
export function formatDateEs(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso))
  }
}

const KIND_PHRASE_ES: Record<UsagePeriodKind, string> = {
  trial: 'de tu prueba',
  paid: 'de este mes',
}

export interface OwnerMessage {
  freeText: string
  templateParams: string[]
}

/**
 * aviso_minutos — the 80 % alert (trial or paid) and the 100 % alert of a
 * paid cycle. The trial's 100 % uses buildTrialCapMessage instead (it has
 * the "Empezar mi plan hoy" button).
 * Template body: "⏳ Hola {{1}}, llevas {{2}} de {{3}} minutos {{4}}.\n{{5}}\nCualquier duda, responde este mensaje."
 */
export function buildUsageAlertMessage(args: {
  ownerName: string
  kind: UsagePeriodKind
  level: 80 | 100
  usedMinutes: number
  includedMinutes: number
}): OwnerMessage {
  const detail =
    args.level === 100
      ? `Tu línea sigue funcionando. Cada minuto extra cuesta $${OVERAGE_PRICE_PER_MINUTE_USD.toFixed(2)} USD.`
      : 'Tu línea sigue funcionando normal ✅'
  const params = [
    args.ownerName,
    String(args.usedMinutes),
    String(args.includedMinutes),
    KIND_PHRASE_ES[args.kind],
    detail,
  ]
  const freeText =
    `⏳ Hola ${params[0]}, llevas ${params[1]} de ${params[2]} minutos ${params[3]}.\n` +
    `${detail}\nCualquier duda, responde este mensaje.`
  return { freeText, templateParams: params }
}

export const START_PLAN_BUTTON_TITLE = 'Empezar mi plan hoy'
export const START_PLAN_BUTTON_PREFIX = 'start_plan:'

/**
 * tope_prueba — trial reached 150 minutes. Also reused, unchanged, for the
 * one 24-hour reminder.
 * Template body: "🚦 Hola {{1}}, ya usaste {{2}} de tus 150 minutos de prueba. Tu línea sigue funcionando.\n\nSi quieres empezar tu plan, toca el botón. Se cobran $199 USD hoy y tu plan empieza ya, con 500 minutos al mes."
 */
export function buildTrialCapMessage(args: { ownerName: string; usedMinutes: number }): OwnerMessage {
  const params = [args.ownerName, String(args.usedMinutes)]
  const freeText =
    `🚦 Hola ${params[0]}, ya usaste ${params[1]} de tus ${TRIAL_INCLUDED_MINUTES} minutos de prueba. ` +
    `Tu línea sigue funcionando.\n\n` +
    `Si quieres empezar tu plan, toca el botón. Se cobran $${PLAN_PRICE_USD} USD hoy y tu plan empieza ya, ` +
    `con ${PAID_INCLUDED_MINUTES} minutos al mes.`
  return { freeText, templateParams: params }
}

/** Reply after the owner taps "Empezar mi plan hoy" and Stripe charged. */
export function buildPlanStartedMessage(args: { nextChargeAtIso: string | null; timeZone: string }): string {
  const next = args.nextChargeAtIso
    ? `Tu próximo cobro es el ${formatDateEs(args.nextChargeAtIso, args.timeZone)}.`
    : 'Te avisamos la fecha de tu próximo cobro.'
  return (
    `✅ ¡Listo! Se cobraron $${PLAN_PRICE_USD} USD y tu plan ya empezó. ` +
    `Tienes ${PAID_INCLUDED_MINUTES} minutos este mes. ${next}`
  )
}

export const PLAN_ALREADY_ACTIVE_MESSAGE = '✅ Tu plan ya está activo. No se hizo ningún cobro nuevo.'

export const PLAN_IN_PROGRESS_MESSAGE = '⏳ Ya estoy procesando tu cobro. En un momento te confirmo.'

export const PLAN_NOT_IN_TRIAL_MESSAGE =
  'Tu cuenta no está en prueba ahora mismo, así que no se hizo ningún cobro. ' +
  'El equipo de Socio te va a contactar. Tu línea sigue funcionando.'

export const PLAN_NEEDS_CHECKOUT_MESSAGE =
  '💳 Para empezar tu plan primero hay que registrar tu tarjeta con el link de pago. ' +
  'Ya le avisamos al equipo de Socio para que te lo mande. Tu línea sigue funcionando.'

export const PLAN_PAYMENT_FAILED_MESSAGE =
  '⚠️ No se pudo cobrar tu tarjeta, así que tu plan no empezó. Tu línea sigue funcionando. ' +
  'El equipo de Socio te va a contactar para arreglarlo.'

export const PLAN_START_ERROR_MESSAGE =
  '⚠️ Algo falló y no se hizo el cobro. Tu línea sigue funcionando. ' +
  'Ya le avisamos al equipo de Socio; intenta de nuevo en un rato.'
