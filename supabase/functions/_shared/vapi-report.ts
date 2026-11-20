// Extracts fields from Vapi's end-of-call-report server message.
//
// Checked against Vapi's docs on 2026-11-20 (docs.vapi.ai/server-url/events
// and the ServerMessageEndOfCallReport schema in
// docs.vapi.ai/api-reference/webhooks/server-message): the body is
// { message: { type, endedReason, call, artifact, analysis, phoneNumber,
// customer, assistant, startedAt, endedAt, ... } }. The documented locations
// are tried first; the older fallbacks stay because they cost nothing.
// voice-webhook still logs the full raw payload to `events` on every
// delivery, so the first real call confirms the shape.

export interface ExtractedCallFields {
  callId: string | null
  assistantId: string | null
  dialedNumber: string | null
  customerNumber: string | null
  transcript: string | null
  recordingUrl: string | null
  startedAt: string | null
  endedAt: string | null
  durationSec: number | null
  structuredData: unknown
  endedReason: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Seconds between two ISO timestamps, or null if either is missing/invalid/out of order. */
export function computeDurationSeconds(
  startedAt: string | null,
  endedAt: string | null,
): number | null {
  if (!startedAt || !endedAt) return null
  const start = Date.parse(startedAt)
  const end = Date.parse(endedAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.round((end - start) / 1000)
}

export function extractCallFields(message: Record<string, unknown>): ExtractedCallFields {
  const call = asRecord(message.call)
  const artifact = asRecord(message.artifact)
  const recording = asRecord(artifact.recording)
  const callPhoneNumber = asRecord(call.phoneNumber)
  const topPhoneNumber = asRecord(message.phoneNumber)
  const customer = asRecord(call.customer)
  const topCustomer = asRecord(message.customer)
  const callAnalysis = asRecord(call.analysis)
  const topAnalysis = asRecord(message.analysis)

  const startedAt = asString(call.startedAt) ?? asString(message.startedAt)
  const endedAt = asString(call.endedAt) ?? asString(message.endedAt)

  return {
    callId: asString(call.id) ?? asString(message.callId),
    assistantId: asString(call.assistantId) ?? asString(message.assistantId),
    dialedNumber: asString(callPhoneNumber.number) ?? asString(topPhoneNumber.number),
    customerNumber: asString(customer.number) ?? asString(topCustomer.number),
    transcript: asString(artifact.transcript) ?? asString(message.transcript),
    recordingUrl:
      asString(recording.stereoUrl) ??
      asString(recording.url) ??
      asString(artifact.recordingUrl) ??
      asString(message.recordingUrl),
    startedAt,
    endedAt,
    durationSec: computeDurationSeconds(startedAt, endedAt),
    structuredData: topAnalysis.structuredData ?? callAnalysis.structuredData ?? null,
    endedReason: asString(message.endedReason),
  }
}
