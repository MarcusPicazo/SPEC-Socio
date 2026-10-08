import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import {
  buildFollowupEmailHtml,
  buildFollowupEmailSubject,
  buildQuoteEmailHtml,
  buildQuoteEmailSubject,
} from './quote-email.ts'

Deno.test('buildQuoteEmailSubject includes the business name and quote number', () => {
  assertEquals(buildQuoteEmailSubject('Martinez Roofing', 'Q-0001'), 'Your quote from Martinez Roofing (Q-0001)')
})

Deno.test('buildQuoteEmailHtml includes the customer name, amount, and link', () => {
  const html = buildQuoteEmailHtml({
    businessName: 'Martinez Roofing',
    customerName: 'Sarah Miller',
    quoteNumber: 'Q-0001',
    total: 9500,
    publicUrl: 'https://app.example.com/q/abc123',
  })
  assertStringIncludes(html, 'Hi Sarah Miller,')
  assertStringIncludes(html, 'Martinez Roofing')
  assertStringIncludes(html, 'Q-0001')
  assertStringIncludes(html, '$9,500')
  assertStringIncludes(html, 'https://app.example.com/q/abc123')
})

Deno.test('buildQuoteEmailHtml falls back to a generic greeting with no customer name', () => {
  const html = buildQuoteEmailHtml({
    businessName: 'Martinez Roofing',
    customerName: null,
    quoteNumber: 'Q-0001',
    total: 100,
    publicUrl: 'https://app.example.com/q/abc123',
  })
  assertStringIncludes(html, 'Hi,')
})

Deno.test('buildFollowupEmailSubject reads as a reminder, not a fresh quote', () => {
  assertEquals(buildFollowupEmailSubject('Martinez Roofing', 'Q-0001'), 'Reminder: your quote from Martinez Roofing (Q-0001)')
})

Deno.test('buildFollowupEmailHtml includes the customer name, amount, and link', () => {
  const html = buildFollowupEmailHtml({
    businessName: 'Martinez Roofing',
    customerName: 'Sarah Miller',
    quoteNumber: 'Q-0001',
    total: 9500,
    publicUrl: 'https://app.example.com/q/abc123',
  })
  assertStringIncludes(html, 'Hi Sarah Miller,')
  assertStringIncludes(html, 'still available')
  assertStringIncludes(html, '$9,500')
  assertStringIncludes(html, 'https://app.example.com/q/abc123')
})
