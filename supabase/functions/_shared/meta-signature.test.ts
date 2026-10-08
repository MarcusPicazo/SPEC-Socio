import { assertEquals } from 'jsr:@std/assert@1'
import { computeHmacSha256Hex, timingSafeEqual, verifyMetaSignature } from './meta-signature.ts'

// Reference vector generated independently with Node's crypto module:
// crypto.createHmac('sha256', 'test-app-secret').update('{"hello":"world"}').digest('hex')
const SECRET = 'test-app-secret'
const BODY = '{"hello":"world"}'
const EXPECTED_HEX = 'c3089f31e137ed0192db28b06f069b1b4e49ae9db35160a2031d142cdb418a5a'

Deno.test('computeHmacSha256Hex matches an independently computed vector', async () => {
  assertEquals(await computeHmacSha256Hex(SECRET, BODY), EXPECTED_HEX)
})

Deno.test('computeHmacSha256Hex changes if the body changes by one byte', async () => {
  const other = await computeHmacSha256Hex(SECRET, '{"hello":"world!"}')
  assertEquals(other === EXPECTED_HEX, false)
})

Deno.test('timingSafeEqual is true for identical strings', () => {
  assertEquals(timingSafeEqual('abc123', 'abc123'), true)
})

Deno.test('timingSafeEqual is false for different lengths', () => {
  assertEquals(timingSafeEqual('abc', 'abcd'), false)
})

Deno.test('timingSafeEqual is false for same-length different strings', () => {
  assertEquals(timingSafeEqual('abc123', 'abc124'), false)
})

Deno.test('verifyMetaSignature accepts a correctly formatted, correct signature', async () => {
  assertEquals(await verifyMetaSignature(BODY, `sha256=${EXPECTED_HEX}`, SECRET), true)
})

Deno.test('verifyMetaSignature rejects a wrong secret', async () => {
  assertEquals(await verifyMetaSignature(BODY, `sha256=${EXPECTED_HEX}`, 'wrong-secret'), false)
})

Deno.test('verifyMetaSignature rejects a tampered body', async () => {
  assertEquals(
    await verifyMetaSignature('{"hello":"world!"}', `sha256=${EXPECTED_HEX}`, SECRET),
    false,
  )
})

Deno.test('verifyMetaSignature rejects a missing or malformed header', async () => {
  assertEquals(await verifyMetaSignature(BODY, null, SECRET), false)
  assertEquals(await verifyMetaSignature(BODY, EXPECTED_HEX, SECRET), false) // missing "sha256=" prefix
  assertEquals(await verifyMetaSignature(BODY, 'sha1=deadbeef', SECRET), false)
})
