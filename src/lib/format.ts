import type { CallStatus, QuoteStatus, SubscriptionStatus, UsagePeriodKind } from '../types'

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago atrasado',
  canceled: 'Cancelado',
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  new: 'Nueva',
  confirmed: 'Confirmada',
  owner_will_call: 'Dueño llama',
  ignored: 'Ignorada (spam)',
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sending: 'Enviando…',
  sent: 'Enviada',
  viewed: 'Vista',
  accepted: 'Aceptada',
  declined: 'Rechazada',
  expired: 'Vencida',
}

export const USAGE_KIND_LABELS: Record<UsagePeriodKind, string> = {
  trial: 'prueba',
  paid: 'mes pagado',
}

/** Operator-facing labels for the usage/billing events shown in a business's card. */
export const USAGE_EVENT_LABELS: Record<string, string> = {
  'usage.alert_sent': 'Aviso de minutos al dueño',
  'usage.trial_cap_reached': 'Llegó al tope de la prueba (botón enviado)',
  'usage.trial_cap_reminder_sent': 'Recordatorio de 24 h del tope de prueba',
  'usage.trial_double_cap': '⚠️ Ya usó el doble del tope de la prueba',
  'usage.record_failed': '❌ No se pudieron contar los minutos de una llamada',
  'billing.end_trial_attempt': 'Intento de terminar la prueba y cobrar',
}

const dateOnlyFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })

export function formatDate(value: string | null): string {
  if (!value) return '—'
  return dateOnlyFormatter.format(new Date(value))
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return dateFormatter.format(new Date(value))
}

export function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

const dateEnFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

/** English, date-only — for customer-facing pages like /q/:token. */
export function formatDateEn(value: string | null): string {
  if (!value) return '—'
  return dateEnFormatter.format(new Date(value))
}
