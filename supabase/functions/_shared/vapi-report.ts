// Extracts fields from Vapi's end-of-call-report server message.
//
// Vapi's own docs for this payload were unreachable while building this
// (vapi.ai is blocked by this environment's network policy), and the
// community threads that do describe it disagree on exact field names and
// nesting (e.g. whether the dialed number sits at message.call.phoneNumber
// vs message.phoneNumber, whether the recording URL is nested under
// artifact.recording or a flatter artifact.recordingUrl). Rather than
// guess one shape and fail silently on a real call, every field here tries
// several plausible locations and falls back to null. voice-webhook also
// logs the full raw payload to `events` on every delivery — use that to
// check the real shape after a first test call and trim the fallbacks
// that turned out to be unnecessary.

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
  const callAnalysis = asRecord(call.analysis)
  const topAnalysis = asRecord(message.analysis)

  const startedAt = asString(call.startedAt) ?? asString(message.startedAt)
  const endedAt = asString(call.endedAt) ?? asString(message.endedAt)

  return {
    callId: asString(call.id) ?? asString(message.callId),
    assistantId: asString(call.assistantId) ?? asString(message.assistantId),
    dialedNumber: asString(callPhoneNumber.number) ?? asString(topPhoneNumber.number),
    customerNumber: asString(customer.number),
    transcript: asString(artifact.transcript) ?? asString(message.transcript),
    recordingUrl:
      asString(recording.stereoUrl) ??
      asString(recording.url) ??
      asString(artifact.recordingUrl) ??
      asString(message.recordingUrl),
    startedAt,
    endedAt,
    durationSec: computeDurationSeconds(startedAt, endedAt),
    structuredData: callAnalysis.structuredData ?? topAnalysis.structuredData ?? null,
    endedReason: asString(message.endedReason),
  }
}
