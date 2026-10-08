import type { QuoteItem } from './types.ts'

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Simple, deliberately non-fuzzy substring match — a typo in the hint just won't match, rather than guessing. */
export function matchCustomersByHint<T extends { name: string | null }>(
  hint: string,
  customers: T[],
): T[] {
  const normalizedHint = normalize(hint)
  if (!normalizedHint) return []
  return customers.filter((customer) => {
    if (!customer.name) return false
    const normalizedName = normalize(customer.name)
    return normalizedName.includes(normalizedHint) || normalizedHint.includes(normalizedName)
  })
}

/** Q-0001 per business: one past the highest existing Q-#### number, or Q-0001 if there are none. */
export function nextQuoteNumber(existingNumbers: string[]): string {
  let max = 0
  for (const number of existingNumbers) {
    const match = /^Q-(\d+)$/.exec(number)
    if (!match) continue
    const value = parseInt(match[1] as string, 10)
    if (value > max) max = value
  }
  return `Q-${String(max + 1).padStart(4, '0')}`
}

export interface ResolvedQuoteItem {
  description_es: string
  description_en: string
  qty: number
  unit: string
  unit_price: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Only call this once every item's unit_price is resolved (needs_clarification empty) — it never defaults a missing price to 0. */
export function toQuoteItems(items: ResolvedQuoteItem[]): QuoteItem[] {
  return items.map((item) => ({
    description_en: item.description_en,
    qty: item.qty,
    unit: item.unit,
    unit_price: item.unit_price,
    total: roundMoney(item.qty * item.unit_price),
  }))
}

export interface QuoteTotals {
  subtotal: number
  tax: number
  total: number
}

/** Tax is always 0 — SPEC: "el impuesto solo se agrega si el dueño lo menciona," and there's no structured field for that yet, so it's never invented here. */
export function computeQuoteTotals(items: QuoteItem[]): QuoteTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0))
  const tax = 0
  return { subtotal, tax, total: roundMoney(subtotal + tax) }
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Deliberately simple — just enough to catch "that's not an email" before we try to send to it. */
export function isLikelyEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}
