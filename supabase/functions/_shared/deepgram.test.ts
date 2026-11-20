import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { toBlob, transcribeSpanish } from './deepgram.ts'

// Importing deepgram.ts here is itself the regression test for the type
// error: `deno test` type-checks every imported module, so the old
// `new Blob([bytes])` (TS2322 under Deno 2.9) would fail this file.

Deno.test('toBlob keeps the exact bytes', async () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255])
  const blob = toBlob(bytes)
  assertEquals(new Uint8Array(await blob.arrayBuffer()), bytes)
})

Deno.test('toBlob accepts a view into a larger buffer and copies only that view', async () => {
  const backing = new Uint8Array([9, 9, 1, 2, 3, 9])
  const view = backing.subarray(2, 5)
  const blob = toBlob(view)
  assertEquals(new Uint8Array(await blob.arrayBuffer()), new Uint8Array([1, 2, 3]))
})

function withFetchStub(
  respond: (url: string, init: RequestInit) => Response,
  run: (calls: Array<{ url: string; init: RequestInit }>) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const originalKey = Deno.env.get('DEEPGRAM_API_KEY')
  const calls: Array<{ url: string; init: RequestInit }> = []
  Deno.env.set('DEEPGRAM_API_KEY', 'test-key')
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push({ url, init: init ?? {} })
    return Promise.resolve(respond(url, init ?? {}))
  }) as typeof fetch
  return run(calls).finally(() => {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) Deno.env.delete('DEEPGRAM_API_KEY')
    else Deno.env.set('DEEPGRAM_API_KEY', originalKey)
  })
}

Deno.test('transcribeSpanish posts the audio to Deepgram nova-3 in Spanish and returns the transcript', async () => {
  await withFetchStub(
    () =>
      new Response(
        JSON.stringify({
          results: { channels: [{ alternatives: [{ transcript: 'Cotízale a Sarah' }] }] },
        }),
        { status: 200 },
      ),
    async (calls) => {
      const transcript = await transcribeSpanish(new Uint8Array([1, 2, 3]), 'audio/ogg')
      assertEquals(transcript, 'Cotízale a Sarah')
      assertEquals(calls.length, 1)
      const url = new URL(calls[0].url)
      assertEquals(url.searchParams.get('model'), 'nova-3')
      assertEquals(url.searchParams.get('language'), 'es')
      const headers = calls[0].init.headers as Record<string, string>
      assertEquals(headers.Authorization, 'Token test-key')
      assertEquals(headers['Content-Type'], 'audio/ogg')
      const body = calls[0].init.body as Blob
      assertEquals(new Uint8Array(await body.arrayBuffer()), new Uint8Array([1, 2, 3]))
    },
  )
})

Deno.test('transcribeSpanish throws with the status when Deepgram fails', async () => {
  await withFetchStub(
    () => new Response('bad audio', { status: 400 }),
    async () => {
      await assertRejects(
        () => transcribeSpanish(new Uint8Array([1]), 'audio/ogg'),
        Error,
        'Deepgram 400',
      )
    },
  )
})
