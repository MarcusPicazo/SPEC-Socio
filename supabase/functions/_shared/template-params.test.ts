import { assert, assertEquals } from 'jsr:@std/assert@1'
import { MAX_TEMPLATE_PARAM_LENGTH, sanitizeTemplateParam } from './template-params.ts'

Deno.test('joins a multi-line summary into one line', () => {
  assertEquals(
    sanitizeTemplateParam('Gotera en el techo, entra agua en la recámara.\nUrgente.'),
    'Gotera en el techo, entra agua en la recámara. Urgente.',
  )
})

Deno.test('adds a separator when a line has no closing punctuation', () => {
  assertEquals(sanitizeTemplateParam('Gotera en el techo\nUrgente'), 'Gotera en el techo · Urgente')
})

Deno.test('handles Windows line endings, blank lines and tabs', () => {
  assertEquals(sanitizeTemplateParam('Línea uno.\r\n\r\n\tLínea\tdos.'), 'Línea uno. Línea dos.')
})

Deno.test('collapses runs of spaces (Meta rejects more than 4 in a row)', () => {
  assertEquals(sanitizeTemplateParam('4512 Oak St,      Houston'), '4512 Oak St, Houston')
})

Deno.test('never returns an empty parameter', () => {
  assertEquals(sanitizeTemplateParam(''), '—')
  assertEquals(sanitizeTemplateParam('  \n\t '), '—')
})

Deno.test('caps very long values', () => {
  const result = sanitizeTemplateParam('a'.repeat(2000))
  assertEquals(result.length, MAX_TEMPLATE_PARAM_LENGTH)
  assert(result.endsWith('…'))
})

Deno.test('leaves a clean value untouched', () => {
  assertEquals(sanitizeTemplateParam('Sarah Miller'), 'Sarah Miller')
})

Deno.test('the result never contains a new line, tab or 5+ spaces', () => {
  const nasty = 'Uno\n\nDos\tTres     Cuatro\r\nCinco\u2028Seis'
  const result = sanitizeTemplateParam(nasty)
  assert(!/[\n\r\t]/.test(result))
  assert(!/ {5,}/.test(result))
})
