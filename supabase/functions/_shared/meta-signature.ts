// Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw
// request body, keyed with the app secret). Generic to any Meta webhook
// that uses this scheme, not just WhatsApp.

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Hex-encoded HMAC-SHA256 of `body`, keyed with `secret`. */
export async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return toHex(signature)
}

/** Constant-time string comparison, so a timing attack can't shortcut the signature check. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verifies a `sha256=<hex>` signature header against the raw body. `body`
 * must be the exact bytes Meta sent — read it as text before any JSON
 * parsing, since re-serializing changes the bytes and breaks the check.
 */
export async function verifyMetaSignature(
  body: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expectedHex = signatureHeader.slice('sha256='.length)
  const computedHex = await computeHmacSha256Hex(appSecret, body)
  return timingSafeEqual(expectedHex, computedHex)
}
