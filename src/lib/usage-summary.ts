// Pure helpers for the minutes card in /admin. Mirror of the rules in
// supabase/functions/_shared/usage.ts — keep the constants in sync.
import type { Business, UsagePeriod, UsagePeriodKind } from '../types'

export const TRIAL_INCLUDED_MINUTES = 150
export const PAID_INCLUDED_MINUTES = 500

/** Whole-cycle rounding up, same as the backend. */
export function billedMinutes(usedSeconds: number): number {
  if (!Number.isFinite(usedSeconds) || usedSeconds <= 0) return 0
  return Math.ceil(usedSeconds / 60)
}

export function trialDaysLeft(trialEndsAtIso: string | null, now: number = Date.now()): number | null {
  if (!trialEndsAtIso) return null
  const end = Date.parse(trialEndsAtIso)
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)))
}

function sameInstant(a: string, b: string | null): boolean {
  return b !== null && Date.parse(a) === Date.parse(b)
}

export type UsageLevel = 'normal' | 'alerta' | 'tope'

export interface UsageSummary {
  kind: UsagePeriodKind
  usedMinutes: number
  includedMinutes: number
  percent: number
  overageMinutes: number
  level: UsageLevel
}

/**
 * The cycle shown in /admin. Uses the latest usage_periods row when it
 * matches the business's current plan; before the first call of a cycle
 * there's no row yet, so it shows 0 of the plan's included minutes.
 */
export function summarizeUsage(
  business: Pick<Business, 'subscription_status' | 'billing_period_start'>,
  latestPeriod: Pick<UsagePeriod, 'kind' | 'period_start' | 'used_seconds' | 'included_minutes'> | null,
): UsageSummary {
  const currentKind: UsagePeriodKind =
    business.subscription_status === 'trialing' || !business.billing_period_start ? 'trial' : 'paid'

  const periodIsCurrent =
    latestPeriod !== null &&
    latestPeriod.kind === currentKind &&
    (currentKind === 'trial' || sameInstant(latestPeriod.period_start, business.billing_period_start))

  const includedMinutes = periodIsCurrent
    ? latestPeriod.included_minutes
    : currentKind === 'trial'
      ? TRIAL_INCLUDED_MINUTES
      : PAID_INCLUDED_MINUTES
  const usedMinutes = periodIsCurrent ? billedMinutes(latestPeriod.used_seconds) : 0
  const percent = Math.round((usedMinutes / includedMinutes) * 100)

  return {
    kind: currentKind,
    usedMinutes,
    includedMinutes,
    percent,
    overageMinutes: Math.max(0, usedMinutes - includedMinutes),
    level: percent >= 100 ? 'tope' : percent >= 80 ? 'alerta' : 'normal',
  }
}

/** True while the trial hit 150 minutes and nobody has decided yet. */
export function needsTrialDecision(business: Pick<Business, 'subscription_status' | 'trial_cap_status'>): boolean {
  return business.subscription_status === 'trialing' && business.trial_cap_status === 'pending_decision'
}

/** Latest row per business, from rows already sorted by period_start desc. */
export function latestPeriodByBusiness<T extends Pick<UsagePeriod, 'business_id'>>(rows: T[]): Record<string, T> {
  const latest: Record<string, T> = {}
  for (const row of rows) {
    if (!latest[row.business_id]) latest[row.business_id] = row
  }
  return latest
}
