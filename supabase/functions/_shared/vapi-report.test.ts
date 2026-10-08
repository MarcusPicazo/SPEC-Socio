import { assertEquals } from 'jsr:@std/assert@1'
import { computeDurationSeconds, extractCallFields } from './vapi-report.ts'

Deno.test('extracts every field from a fully-populated phone-call payload', () => {
  const message = {
    type: 'end-of-call-report',
    endedReason: 'hangup',
    call: {
      id: 'call-123',
      assistantId: 'assistant-abc',
      phoneNumber: { number: '+17135550199' },
      customer: { number: '+17135550142' },
      startedAt: '2026-10-08T15:00:00Z',
      endedAt: '2026-10-08T15:02:30Z',
      analysis: { structuredData: { is_spam: false } },
    },
    artifact: {
      transcript: 'AI: Hello. User: Hi, my roof is leaking.',
      recording: { stereoUrl: 'https://example.com/recording.wav' },
    },
  }

  const result = extractCallFields(message)
  assertEquals(result.callId, 'call-123')
  assertEquals(result.assistantId, 'assistant-abc')
  assertEquals(result.dialedNumber, '+17135550199')
  assertEquals(result.customerNumber, '+17135550142')
  assertEquals(result.transcript, 'AI: Hello. User: Hi, my roof is leaking.')
  assertEquals(result.recordingUrl, 'https://example.com/recording.wav')
  assertEquals(result.durationSec, 150)
  assertEquals(result.structuredData, { is_spam: false })
  assertEquals(result.endedReason, 'hangup')
})

Deno.test('falls back to top-level fields when nothing is nested under call/artifact', () => {
  const message = {
    type: 'end-of-call-report',
    callId: 'call-456',
    assistantId: 'assistant-xyz',
    phoneNumber: { number: '+17135550199' },
    transcript: 'flat transcript',
    recordingUrl: 'https://example.com/flat-recording.wav',
    analysis: { structuredData: { is_spam: true } },
  }

  const result = extractCallFields(message)
  assertEquals(result.callId, 'call-456')
  assertEquals(result.assistantId, 'assistant-xyz')
  assertEquals(result.dialedNumber, '+17135550199')
  assertEquals(result.transcript, 'flat transcript')
  assertEquals(result.recordingUrl, 'https://example.com/flat-recording.wav')
  assertEquals(result.structuredData, { is_spam: true })
})

Deno.test('returns nulls across the board for an empty message instead of throwing', () => {
  const result = extractCallFields({})
  assertEquals(result.callId, null)
  assertEquals(result.assistantId, null)
  assertEquals(result.dialedNumber, null)
  assertEquals(result.customerNumber, null)
  assertEquals(result.transcript, null)
  assertEquals(result.recordingUrl, null)
  assertEquals(result.durationSec, null)
  assertEquals(result.structuredData, null)
})

Deno.test('prefers artifact.recording.url over recordingUrl when both are present', () => {
  const message = {
    artifact: {
      recording: { url: 'https://example.com/nested.wav' },
      recordingUrl: 'https://example.com/flat.wav',
    },
  }
  assertEquals(extractCallFields(message).recordingUrl, 'https://example.com/nested.wav')
})

Deno.test('computeDurationSeconds returns null when either timestamp is missing', () => {
  assertEquals(computeDurationSeconds(null, '2026-10-08T15:02:30Z'), null)
  assertEquals(computeDurationSeconds('2026-10-08T15:00:00Z', null), null)
  assertEquals(computeDurationSeconds(null, null), null)
})

Deno.test('computeDurationSeconds returns null for invalid timestamps', () => {
  assertEquals(computeDurationSeconds('not a date', '2026-10-08T15:02:30Z'), null)
})

Deno.test('computeDurationSeconds returns null when the call ends before it starts', () => {
  assertEquals(
    computeDurationSeconds('2026-10-08T15:02:30Z', '2026-10-08T15:00:00Z'),
    null,
  )
})

Deno.test('computeDurationSeconds rounds to the nearest second', () => {
  assertEquals(computeDurationSeconds('2026-10-08T15:00:00.000Z', '2026-10-08T15:00:01.600Z'), 2)
})
