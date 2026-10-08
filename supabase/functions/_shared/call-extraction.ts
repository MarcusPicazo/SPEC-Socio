import { z } from 'npm:zod@3.23.8'
import type { CallExtraction } from './types.ts'

// Mirrors SPEC §6.2, and must stay in sync with the JSON Schema that
// provision-business configures on Vapi's analysisPlan.structuredDataPlan.
export const callExtractionSchema = z.object({
  caller_name: z.string().nullable().default(null),
  callback_number: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  service_type: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  urgency: z.enum(['emergency', 'soon', 'flexible']).nullable().default(null),
  preferred_time: z.string().nullable().default(null),
  language: z.enum(['en', 'es']).default('en'),
  is_spam: z.boolean().default(false),
})

/**
 * Vapi's structuredData can be missing, partially filled, or shaped in a
 * way we didn't anticipate — never crash the webhook over it, and never
 * invent a value (regla de oro #2): anything that doesn't parse cleanly
 * falls back to null/false/en rather than being guessed.
 */
export function normalizeCallExtraction(raw: unknown): CallExtraction {
  const direct = callExtractionSchema.safeParse(raw)
  if (direct.success) return direct.data

  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const urgency =
    source.urgency === 'emergency' || source.urgency === 'soon' || source.urgency === 'flexible'
      ? source.urgency
      : null

  return callExtractionSchema.parse({
    caller_name: typeof source.caller_name === 'string' ? source.caller_name : null,
    callback_number: typeof source.callback_number === 'string' ? source.callback_number : null,
    address: typeof source.address === 'string' ? source.address : null,
    service_type: typeof source.service_type === 'string' ? source.service_type : null,
    description: typeof source.description === 'string' ? source.description : null,
    urgency,
    preferred_time: typeof source.preferred_time === 'string' ? source.preferred_time : null,
    language: source.language === 'es' ? 'es' : 'en',
    is_spam: source.is_spam === true,
  })
}
