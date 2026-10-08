import { assertEquals } from 'jsr:@std/assert@1'
import { isUniqueViolation } from './postgrest-errors.ts'

Deno.test('isUniqueViolation is true for Postgres code 23505', () => {
  assertEquals(isUniqueViolation({ code: '23505' }), true)
})

Deno.test('isUniqueViolation is false for a different error code', () => {
  assertEquals(isUniqueViolation({ code: '23503' }), false)
})

Deno.test('isUniqueViolation is false for null, undefined, or no code', () => {
  assertEquals(isUniqueViolation(null), false)
  assertEquals(isUniqueViolation(undefined), false)
  assertEquals(isUniqueViolation({}), false)
})
