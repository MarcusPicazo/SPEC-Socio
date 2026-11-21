import { describe, expect, it } from 'vitest'
import { latestPeriodByBusiness, needsTrialDecision, summarizeUsage, trialDaysLeft } from './usage-summary'

const trialBusiness = { subscription_status: 'trialing' as const, billing_period_start: null }
const paidBusiness = { subscription_status: 'active' as const, billing_period_start: '2026-11-15T00:00:00+00:00' }

describe('summarizeUsage', () => {
  it('shows 0 of 150 for a trial with no calls yet', () => {
    expect(summarizeUsage(trialBusiness, null)).toMatchObject({
      kind: 'trial',
      usedMinutes: 0,
      includedMinutes: 150,
      level: 'normal',
    })
  })

  it('rounds the cycle total up and flags 80 %', () => {
    const summary = summarizeUsage(trialBusiness, {
      kind: 'trial',
      period_start: '2026-11-01T00:00:00+00:00',
      used_seconds: 119 * 60 + 1,
      included_minutes: 150,
    })
    expect(summary).toMatchObject({ usedMinutes: 120, percent: 80, level: 'alerta' })
  })

  it('shows the overage once a paid cycle passes 500 minutes', () => {
    const summary = summarizeUsage(paidBusiness, {
      kind: 'paid',
      period_start: '2026-11-15T00:00:00+00:00',
      used_seconds: 512 * 60,
      included_minutes: 500,
    })
    expect(summary).toMatchObject({ kind: 'paid', usedMinutes: 512, overageMinutes: 12, level: 'tope' })
  })

  it('ignores the old trial row once the paid plan started', () => {
    const summary = summarizeUsage(paidBusiness, {
      kind: 'trial',
      period_start: '2026-11-01T00:00:00+00:00',
      used_seconds: 150 * 60,
      included_minutes: 150,
    })
    expect(summary).toMatchObject({ kind: 'paid', usedMinutes: 0, includedMinutes: 500 })
  })

  it('ignores last cycle once a new paid cycle started', () => {
    const summary = summarizeUsage(
      { subscription_status: 'active', billing_period_start: '2026-12-15T00:00:00+00:00' },
      { kind: 'paid', period_start: '2026-11-15T00:00:00+00:00', used_seconds: 400 * 60, included_minutes: 500 },
    )
    expect(summary.usedMinutes).toBe(0)
  })
})

describe('trialDaysLeft', () => {
  const now = Date.parse('2026-11-21T12:00:00Z')
  it('rounds up and never goes negative', () => {
    expect(trialDaysLeft('2026-11-28T12:00:00Z', now)).toBe(7)
    expect(trialDaysLeft('2026-11-21T13:00:00Z', now)).toBe(1)
    expect(trialDaysLeft('2026-11-01T00:00:00Z', now)).toBe(0)
  })
  it('is null when there is no Stripe trial yet', () => {
    expect(trialDaysLeft(null, now)).toBeNull()
  })
})

describe('needsTrialDecision', () => {
  it('only while trialing and pending', () => {
    expect(needsTrialDecision({ subscription_status: 'trialing', trial_cap_status: 'pending_decision' })).toBe(true)
    expect(needsTrialDecision({ subscription_status: 'active', trial_cap_status: 'pending_decision' })).toBe(false)
    expect(needsTrialDecision({ subscription_status: 'trialing', trial_cap_status: 'operator_continue' })).toBe(false)
  })
})

describe('latestPeriodByBusiness', () => {
  it('keeps the first (newest) row per business', () => {
    const rows = [
      { business_id: 'a', id: 'a2' },
      { business_id: 'b', id: 'b1' },
      { business_id: 'a', id: 'a1' },
    ]
    expect(latestPeriodByBusiness(rows)).toEqual({ a: rows[0], b: rows[1] })
  })
})
