import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import {
  alertsDue,
  billedMinutes,
  buildPlanStartedMessage,
  buildTrialCapMessage,
  buildUsageAlertMessage,
  overageMinutes,
  ownerAlertLevel,
  trialDaysLeft,
} from './usage.ts'
import type { UsagePeriod } from './types.ts'

function period(overrides: Partial<UsagePeriod>): UsagePeriod {
  return {
    id: 'p1',
    business_id: 'b1',
    kind: 'trial',
    period_start: '2026-11-01T00:00:00Z',
    period_end: null,
    included_minutes: 150,
    used_seconds: 0,
    alert_80_sent_at: null,
    alert_100_sent_at: null,
    alert_200_sent_at: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

Deno.test('billedMinutes rounds the whole cycle up once, not each call', () => {
  // Two calls of 61s and 59s: 2 minutes total, not 2 + 1 = 3.
  assertEquals(billedMinutes(61 + 59), 2)
  assertEquals(billedMinutes(121), 3)
  assertEquals(billedMinutes(1), 1)
  assertEquals(billedMinutes(0), 0)
  assertEquals(billedMinutes(-5), 0)
  assertEquals(billedMinutes(Number.NaN), 0)
})

Deno.test('overageMinutes counts only what goes past the included minutes', () => {
  assertEquals(overageMinutes(500 * 60, 500), 0)
  assertEquals(overageMinutes(500 * 60 + 1, 500), 1)
  assertEquals(overageMinutes(512 * 60, 500), 12)
  assertEquals(overageMinutes(10, 500), 0)
})

Deno.test('alertsDue: trial reaches 80 % at 120 minutes', () => {
  assertEquals(alertsDue(period({ used_seconds: 119 * 60 })), [])
  // 119 min + 1 s rounds up to 120 → 80 % of 150.
  assertEquals(alertsDue(period({ used_seconds: 119 * 60 + 1 })), [80])
})

Deno.test('alertsDue: trial at 150 and 300 minutes', () => {
  assertEquals(alertsDue(period({ used_seconds: 150 * 60 })), [80, 100])
  assertEquals(alertsDue(period({ used_seconds: 300 * 60 })), [80, 100, 200])
})

Deno.test('alertsDue skips levels already sent, so a repeated webhook never re-alerts', () => {
  const sent = '2026-11-10T00:00:00Z'
  assertEquals(alertsDue(period({ used_seconds: 150 * 60, alert_80_sent_at: sent })), [100])
  assertEquals(
    alertsDue(period({ used_seconds: 150 * 60, alert_80_sent_at: sent, alert_100_sent_at: sent })),
    [],
  )
})

Deno.test('alertsDue: paid cycle uses 400 and 500 minutes and has no 200 % level', () => {
  const paid = { kind: 'paid' as const, included_minutes: 500 }
  assertEquals(alertsDue(period({ ...paid, used_seconds: 399 * 60 })), [])
  assertEquals(alertsDue(period({ ...paid, used_seconds: 400 * 60 })), [80])
  assertEquals(alertsDue(period({ ...paid, used_seconds: 1000 * 60 })), [80, 100])
})

Deno.test('ownerAlertLevel sends only the highest owner level, never 200', () => {
  assertEquals(ownerAlertLevel([80, 100]), 100)
  assertEquals(ownerAlertLevel([80]), 80)
  assertEquals(ownerAlertLevel([200]), null)
  assertEquals(ownerAlertLevel([]), null)
})

Deno.test('trialDaysLeft rounds up and never goes negative', () => {
  const now = Date.parse('2026-11-21T12:00:00Z')
  assertEquals(trialDaysLeft('2026-11-28T12:00:00Z', now), 7)
  assertEquals(trialDaysLeft('2026-11-21T13:00:00Z', now), 1)
  assertEquals(trialDaysLeft('2026-11-20T00:00:00Z', now), 0)
  assertEquals(trialDaysLeft(null, now), null)
  assertEquals(trialDaysLeft('not a date', now), null)
})

Deno.test('buildUsageAlertMessage: 80 % of the trial, free text matches the template params', () => {
  const message = buildUsageAlertMessage({
    ownerName: 'Carlos',
    kind: 'trial',
    level: 80,
    usedMinutes: 121,
    includedMinutes: 150,
  })
  assertEquals(message.templateParams, [
    'Carlos',
    '121',
    '150',
    'de tu prueba',
    'Tu línea sigue funcionando normal ✅',
  ])
  assertEquals(
    message.freeText,
    '⏳ Hola Carlos, llevas 121 de 150 minutos de tu prueba.\nTu línea sigue funcionando normal ✅\nCualquier duda, responde este mensaje.',
  )
})

Deno.test('buildUsageAlertMessage: 100 % of a paid month mentions the extra-minute price', () => {
  const message = buildUsageAlertMessage({
    ownerName: 'Carlos',
    kind: 'paid',
    level: 100,
    usedMinutes: 500,
    includedMinutes: 500,
  })
  assertEquals(message.templateParams[3], 'de este mes')
  assertStringIncludes(message.freeText, 'Cada minuto extra cuesta $0.25 USD.')
})

Deno.test('buildTrialCapMessage says exactly what tapping the button charges', () => {
  const message = buildTrialCapMessage({ ownerName: 'Carlos', usedMinutes: 152 })
  assertEquals(message.templateParams, ['Carlos', '152'])
  assertStringIncludes(message.freeText, 'ya usaste 152 de tus 150 minutos de prueba')
  assertStringIncludes(message.freeText, 'Se cobran $199 USD hoy y tu plan empieza ya')
})

Deno.test('buildPlanStartedMessage gives the next charge date in Spanish, in the business time zone', () => {
  // 2026-12-21T03:00Z is still Dec 20 in Houston.
  const text = buildPlanStartedMessage({ nextChargeAtIso: '2026-12-21T03:00:00Z', timeZone: 'America/Chicago' })
  assertStringIncludes(text, 'Se cobraron $199 USD')
  assertStringIncludes(text, 'Tu próximo cobro es el 20 de diciembre de 2026.')
})

Deno.test('buildPlanStartedMessage survives a bad time zone or a missing date', () => {
  const badZone = buildPlanStartedMessage({ nextChargeAtIso: '2026-12-21T12:00:00Z', timeZone: 'Not/AZone' })
  assertStringIncludes(badZone, '21 de diciembre de 2026')
  const noDate = buildPlanStartedMessage({ nextChargeAtIso: null, timeZone: 'America/Chicago' })
  assertStringIncludes(noDate, 'Te avisamos la fecha de tu próximo cobro.')
})
