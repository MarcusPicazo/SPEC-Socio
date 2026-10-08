import { assertEquals } from 'jsr:@std/assert@1'
import { normalizeCallExtraction } from './call-extraction.ts'
import type { CallExtraction } from './types.ts'

Deno.test('passes through a fully valid extraction unchanged', () => {
  const input: CallExtraction = {
    caller_name: 'Sarah Miller',
    callback_number: '+17135550142',
    address: '4512 Oak St, Houston, TX',
    service_type: 'roof_leak',
    description: 'Water coming into the bedroom ceiling',
    urgency: 'emergency',
    preferred_time: 'Thursday morning',
    language: 'en',
    is_spam: false,
  }
  assertEquals(normalizeCallExtraction(input), input)
})

Deno.test('defaults is_spam to false when missing, never inventing true', () => {
  const result = normalizeCallExtraction({ language: 'en' })
  assertEquals(result.is_spam, false)
})

Deno.test('preserves an explicit is_spam: true', () => {
  const result = normalizeCallExtraction({ is_spam: true })
  assertEquals(result.is_spam, true)
})

Deno.test('coerces an invalid urgency value to null instead of throwing', () => {
  const result = normalizeCallExtraction({ urgency: 'asap-please' })
  assertEquals(result.urgency, null)
})

Deno.test('keeps a valid urgency value', () => {
  const result = normalizeCallExtraction({ urgency: 'soon' })
  assertEquals(result.urgency, 'soon')
})

Deno.test('defaults language to en when missing or not en/es', () => {
  assertEquals(normalizeCallExtraction({}).language, 'en')
  assertEquals(normalizeCallExtraction({ language: 'fr' }).language, 'en')
})

Deno.test('keeps language es when explicitly set', () => {
  assertEquals(normalizeCallExtraction({ language: 'es' }).language, 'es')
})

Deno.test('handles null, undefined, and non-object input without throwing', () => {
  for (const value of [null, undefined, 'not an object', 42]) {
    const result = normalizeCallExtraction(value)
    assertEquals(result.is_spam, false)
    assertEquals(result.language, 'en')
    assertEquals(result.caller_name, null)
  }
})

Deno.test('drops non-string fields instead of keeping the wrong type', () => {
  const result = normalizeCallExtraction({ caller_name: 42, address: true })
  assertEquals(result.caller_name, null)
  assertEquals(result.address, null)
})
