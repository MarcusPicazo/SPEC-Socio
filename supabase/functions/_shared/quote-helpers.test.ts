import { assertEquals } from 'jsr:@std/assert@1'
import {
  computeQuoteTotals,
  formatUsd,
  matchCustomersByHint,
  nextQuoteNumber,
  toQuoteItems,
} from './quote-helpers.ts'

Deno.test('matchCustomersByHint matches a first-name hint against a full name', () => {
  const customers = [{ id: '1', name: 'Sarah Miller' }, { id: '2', name: 'John Doe' }]
  const result = matchCustomersByHint('Sarah', customers)
  assertEquals(result.map((c) => c.id), ['1'])
})

Deno.test('matchCustomersByHint is accent- and case-insensitive', () => {
  const customers = [{ id: '1', name: 'José Pérez' }]
  assertEquals(matchCustomersByHint('jose', customers).length, 1)
  assertEquals(matchCustomersByHint('JOSÉ', customers).length, 1)
})

Deno.test('matchCustomersByHint returns every match when the hint is ambiguous', () => {
  const customers = [
    { id: '1', name: 'Sarah Miller' },
    { id: '2', name: 'Sarah Connor' },
    { id: '3', name: 'John Doe' },
  ]
  const result = matchCustomersByHint('Sarah', customers)
  assertEquals(result.map((c) => c.id).sort(), ['1', '2'])
})

Deno.test('matchCustomersByHint returns nothing for an empty hint or no customers', () => {
  assertEquals(matchCustomersByHint('', [{ id: '1', name: 'Sarah' }]), [])
  assertEquals(matchCustomersByHint('Sarah', []), [])
})

Deno.test('matchCustomersByHint skips customers with no name', () => {
  const customers = [{ id: '1', name: null }]
  assertEquals(matchCustomersByHint('Sarah', customers), [])
})

Deno.test('nextQuoteNumber starts at Q-0001 when there are no existing quotes', () => {
  assertEquals(nextQuoteNumber([]), 'Q-0001')
})

Deno.test('nextQuoteNumber continues from the highest existing number, ignoring order', () => {
  assertEquals(nextQuoteNumber(['Q-0001', 'Q-0003', 'Q-0002']), 'Q-0004')
})

Deno.test('nextQuoteNumber ignores malformed numbers', () => {
  assertEquals(nextQuoteNumber(['not-a-number', 'Q-0001']), 'Q-0002')
})

Deno.test('toQuoteItems computes each line total and drops description_es', () => {
  const result = toQuoteItems([
    { description_es: 'Techo', description_en: 'Roof', qty: 2, unit: 'job', unit_price: 100 },
  ])
  assertEquals(result, [{ description_en: 'Roof', qty: 2, unit: 'job', unit_price: 100, total: 200 }])
})

Deno.test('toQuoteItems rounds to the nearest cent', () => {
  const result = toQuoteItems([
    { description_es: 'x', description_en: 'x', qty: 3, unit: 'hr', unit_price: 33.333 },
  ])
  assertEquals(result[0]?.total, 100)
})

Deno.test('computeQuoteTotals sums line totals with zero tax', () => {
  const totals = computeQuoteTotals([
    { description_en: 'a', qty: 1, unit: 'job', unit_price: 100, total: 100 },
    { description_en: 'b', qty: 1, unit: 'job', unit_price: 50.5, total: 50.5 },
  ])
  assertEquals(totals, { subtotal: 150.5, tax: 0, total: 150.5 })
})

Deno.test('formatUsd formats whole and fractional amounts', () => {
  assertEquals(formatUsd(9500), '$9,500')
  assertEquals(formatUsd(150.5), '$150.5')
})
