import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { fillTemplate } from './template.ts'

Deno.test('replaces every occurrence of a variable', () => {
  const result = fillTemplate('Hello {{name}}, bye {{name}}', { name: 'Sarah' })
  assertEquals(result, 'Hello Sarah, bye Sarah')
})

Deno.test('leaves text without placeholders untouched', () => {
  const result = fillTemplate('No variables here', {})
  assertEquals(result, 'No variables here')
})

Deno.test('throws when a template variable is missing', () => {
  assertThrows(() => fillTemplate('Hello {{name}}', {}))
})
