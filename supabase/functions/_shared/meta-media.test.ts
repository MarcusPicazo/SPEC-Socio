import { assertEquals } from 'jsr:@std/assert@1'
import { extensionForMimeType } from './meta-media.ts'

Deno.test('recognizes a WhatsApp voice note mime type (ogg/opus)', () => {
  assertEquals(extensionForMimeType('audio/ogg; codecs=opus'), 'ogg')
})

Deno.test('recognizes mp3, amr, wav, aac, m4a', () => {
  assertEquals(extensionForMimeType('audio/mpeg'), 'mp3')
  assertEquals(extensionForMimeType('audio/amr'), 'amr')
  assertEquals(extensionForMimeType('audio/wav'), 'wav')
  assertEquals(extensionForMimeType('audio/aac'), 'aac')
  assertEquals(extensionForMimeType('audio/m4a'), 'm4a')
})

Deno.test('is case-insensitive', () => {
  assertEquals(extensionForMimeType('AUDIO/OGG; CODECS=OPUS'), 'ogg')
})

Deno.test('falls back to bin for an unrecognized mime type', () => {
  assertEquals(extensionForMimeType('application/octet-stream'), 'bin')
})
