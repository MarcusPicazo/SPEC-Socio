import { assertEquals } from 'jsr:@std/assert@1'
import { resolveSupabaseKey } from './supabase-keys.ts'

Deno.test('prefers the legacy key when it is present', () => {
  assertEquals(resolveSupabaseKey('eyJlegacy', '{"default":"sb_secret_new"}'), 'eyJlegacy')
})

Deno.test('falls back to the default entry of the new keys dictionary', () => {
  assertEquals(resolveSupabaseKey(undefined, '{"default":"sb_secret_new"}'), 'sb_secret_new')
  assertEquals(resolveSupabaseKey('', '{"default":"sb_secret_new"}'), 'sb_secret_new')
})

Deno.test('returns null when nothing usable is configured', () => {
  assertEquals(resolveSupabaseKey(undefined, undefined), null)
  assertEquals(resolveSupabaseKey(undefined, 'not json'), null)
  assertEquals(resolveSupabaseKey(undefined, '{"other":"x"}'), null)
})
