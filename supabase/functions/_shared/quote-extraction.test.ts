import { assertEquals } from 'jsr:@std/assert@1'
import { isCorrectionTranscript, quoteExtractionSchema } from './quote-extraction.ts'

Deno.test('isCorrectionTranscript recognizes "corrige" and "cambia" at the start', () => {
  assertEquals(isCorrectionTranscript('Corrige el precio a 9500'), true)
  assertEquals(isCorrectionTranscript('cambia la garantía a 5 años'), true)
  assertEquals(isCorrectionTranscript('  Cambia el precio'), true)
})

Deno.test('isCorrectionTranscript is false for a fresh quote transcript', () => {
  assertEquals(
    isCorrectionTranscript('Cotízale a Sarah 2000 pies de techo con material, 9500 dólares'),
    false,
  )
})

Deno.test('isCorrectionTranscript only matches at the very start, not mid-sentence', () => {
  assertEquals(isCorrectionTranscript('Al final, cambia el precio'), false)
})

Deno.test('quoteExtractionSchema accepts a fully valid extraction', () => {
  const input = {
    customer_hint: 'Sarah',
    items: [
      {
        description_es: 'Techo de 2,000 pies con material',
        description_en: 'Roof replacement, 2,000 sq ft, materials included',
        qty: 1,
        unit: 'job',
        unit_price: 9500,
      },
    ],
    warranty_en: '5-year workmanship warranty',
    warranty_es: 'Garantía de 5 años de mano de obra',
    notes_en: null,
    notes_es: null,
    needs_clarification: [],
  }
  const result = quoteExtractionSchema.safeParse(input)
  assertEquals(result.success, true)
})

Deno.test('quoteExtractionSchema accepts a null unit_price (goes to needs_clarification instead)', () => {
  const input = {
    customer_hint: 'Sarah',
    items: [
      { description_es: 'Techo', description_en: 'Roof', qty: 1, unit: 'job', unit_price: null },
    ],
    warranty_en: null,
    warranty_es: null,
    notes_en: null,
    notes_es: null,
    needs_clarification: ['¿Cuál es el precio del techo?'],
  }
  const result = quoteExtractionSchema.safeParse(input)
  assertEquals(result.success, true)
})

Deno.test('quoteExtractionSchema rejects a missing items array', () => {
  const result = quoteExtractionSchema.safeParse({
    customer_hint: null,
    warranty_en: null,
    warranty_es: null,
    notes_en: null,
    notes_es: null,
    needs_clarification: [],
  })
  assertEquals(result.success, false)
})
