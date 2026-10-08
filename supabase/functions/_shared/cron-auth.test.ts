import { assertEquals } from 'jsr:@std/assert@1'
import { verifyCronSecret } from './cron-auth.ts'

function withEnv(value: string | undefined, fn: () => void): void {
  const previous = Deno.env.get('CRON_SECRET')
  if (value === undefined) Deno.env.delete('CRON_SECRET')
  else Deno.env.set('CRON_SECRET', value)
  try {
    fn()
  } finally {
    if (previous === undefined) Deno.env.delete('CRON_SECRET')
    else Deno.env.set('CRON_SECRET', previous)
  }
}

Deno.test('verifyCronSecret accepts a matching header', () => {
  withEnv('s3cret', () => {
    const req = new Request('https://example.com', { headers: { 'X-Cron-Secret': 's3cret' } })
    assertEquals(verifyCronSecret(req), true)
  })
})

Deno.test('verifyCronSecret rejects a wrong or missing header', () => {
  withEnv('s3cret', () => {
    assertEquals(verifyCronSecret(new Request('https://example.com')), false)
    assertEquals(
      verifyCronSecret(new Request('https://example.com', { headers: { 'X-Cron-Secret': 'nope' } })),
      false,
    )
  })
})

Deno.test('verifyCronSecret rejects everything when CRON_SECRET is unset', () => {
  withEnv(undefined, () => {
    const req = new Request('https://example.com', { headers: { 'X-Cron-Secret': 'anything' } })
    assertEquals(verifyCronSecret(req), false)
  })
})
