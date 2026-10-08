import { z } from 'npm:zod@3.23.8'
import { callClaudeJson } from './anthropic.ts'
import { QUOTE_EXTRACTION_PROMPT } from './prompts/quote-extraction.ts'
import { fillTemplate } from './template.ts'
import type { Business, QuoteExtraction } from './types.ts'

export const quoteExtractionItemSchema = z.object({
  description_es: z.string().min(1),
  description_en: z.string().min(1),
  qty: z.number(),
  unit: z.string().min(1),
  unit_price: z.number().nullable(),
})

export const quoteExtractionSchema = z.object({
  customer_hint: z.string().nullable(),
  items: z.array(quoteExtractionItemSchema),
  warranty_en: z.string().nullable(),
  warranty_es: z.string().nullable(),
  notes_en: z.string().nullable(),
  notes_es: z.string().nullable(),
  needs_clarification: z.array(z.string()),
})

// Sent to Anthropic's output_config.format (structured outputs). Numeric
// constraints like "minimum" and additionalProperties other than false
// are rejected by that feature — see _shared/anthropic.ts.
const QUOTE_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    customer_hint: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description_es: { type: 'string' },
          description_en: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string' },
          unit_price: { type: ['number', 'null'] },
        },
        required: ['description_es', 'description_en', 'qty', 'unit', 'unit_price'],
        additionalProperties: false,
      },
    },
    warranty_en: { type: ['string', 'null'] },
    warranty_es: { type: ['string', 'null'] },
    notes_en: { type: ['string', 'null'] },
    notes_es: { type: ['string', 'null'] },
    needs_clarification: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'customer_hint',
    'items',
    'warranty_en',
    'warranty_es',
    'notes_en',
    'notes_es',
    'needs_clarification',
  ],
  additionalProperties: false,
}

/** A correction voice note starts with "corrige" or "cambia" (any case/accent), per the owner's own convention. */
export function isCorrectionTranscript(transcript: string): boolean {
  return /^\s*(corrige|cambia)/i.test(transcript)
}

export interface ExistingDraftContext {
  items: unknown
  warranty_en: string | null
  warranty_es: string | null
  notes_en: string | null
  notes_es: string | null
  /** Clarifying questions already asked and answered — don't ask these again. */
  qaHistory?: Array<{ question: string; answer: string }>
}

function buildExistingDraftSection(existing: ExistingDraftContext | null): string {
  if (!existing) return ''

  const qaSection =
    existing.qaHistory && existing.qaHistory.length > 0
      ? '\nThe owner already answered these clarifying questions — use the answers, do not ask again:\n' +
        existing.qaHistory.map((qa) => `- Q: ${qa.question}\n  A: ${qa.answer}`).join('\n') +
        '\n'
      : ''

  return (
    'This is a correction or clarification update to an existing draft. Current state as ' +
    'JSON — apply the change or answer below, and return the FULL corrected state (every ' +
    'item, not just the one that changed):\n' +
    `${JSON.stringify({
      items: existing.items,
      warranty_en: existing.warranty_en,
      warranty_es: existing.warranty_es,
      notes_en: existing.notes_en,
      notes_es: existing.notes_es,
    })}\n${qaSection}`
  )
}

/** Runs the extraction once, with one retry on a validation or request failure. Returns null if both attempts fail. */
export async function extractQuote(args: {
  business: Business
  transcript: string
  existingDraft?: ExistingDraftContext | null
}): Promise<QuoteExtraction | null> {
  const model = Deno.env.get('QUOTE_EXTRACTION_MODEL') ?? 'claude-sonnet-5-5'

  const prompt = fillTemplate(QUOTE_EXTRACTION_PROMPT, {
    owner_name: args.business.owner_name,
    business_name: args.business.name,
    trade: args.business.trade,
    existing_draft_section: buildExistingDraftSection(args.existingDraft ?? null),
    transcript: args.transcript,
  })

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callClaudeJson<unknown>({
        model,
        userMessage: prompt,
        schema: QUOTE_EXTRACTION_JSON_SCHEMA,
        maxTokens: 2048,
      })
      const parsed = quoteExtractionSchema.safeParse(raw)
      if (parsed.success) return parsed.data
      console.error(`quote extraction con forma inválida en intento ${attempt}:`, parsed.error.message)
    } catch (error) {
      console.error(`quote extraction falló en intento ${attempt}:`, error)
    }
  }
  return null
}
