// Builds the Vapi assistant payload for a business. Pure (no Deno.env, no
// fetch) so it can be unit-tested; provision-business reads the env and
// passes the values in.
//
// Checked against Vapi's docs on 2026-11-20:
// - Create Assistant API reference (docs.vapi.ai/api-reference/assistants/create):
//   `server` only has url / credentialId / headers / timeoutSeconds /
//   backoffPlan — there is no inline `secret` anymore. Webhook auth now goes
//   through a Custom Credential referenced by `server.credentialId`
//   (docs.vapi.ai/server-url/server-authentication).
// - `analysisPlan.structuredDataPlan` is marked deprecated but "still works
//   and remains available for existing setups" (docs.vapi.ai/assistants/call-analysis);
//   results arrive in the end-of-call-report under `analysis.structuredData`.
//   Structured outputs are the recommended replacement — see ENCENDIDO.md §6.
// - `claude-haiku-4-5-20251001` is a supported Anthropic model id
//   (docs.vapi.ai/providers/model/anthropic).
// - Deepgram `nova-3` supports language `multi` (docs.vapi.ai/providers/transcriber/deepgram).
// - Vapi voice `Paige` was retired; `Clara` (female, American, professional)
//   is active (docs.vapi.ai/providers/voice/vapi-voices).
// - transferCall tool with destinations [{ type: 'number', number, message,
//   description }] (docs.vapi.ai/tools/transfer-call/setup).

import { RECEPTIONIST_PROMPT } from './prompts/receptionist.ts'
import { fillTemplate } from './template.ts'
import type { Business, BusinessHours, BusinessService } from './types.ts'

export const DEFAULT_ASSISTANT_MODEL_PROVIDER = 'anthropic'
export const DEFAULT_ASSISTANT_MODEL = 'claude-haiku-4-5-20251001'
export const DEFAULT_VOICE_PROVIDER = 'vapi'
export const DEFAULT_VOICE_ID = 'Clara'

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

// Mirror of SPEC §6.2, minus summary_es — that is generated separately from
// the transcript by voice-webhook's own Claude Haiku call, so we don't pay
// Vapi's analysis step to produce it too.
export const CALL_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    caller_name: { type: ['string', 'null'], description: "Caller's name, if given." },
    callback_number: {
      type: ['string', 'null'],
      description: 'Best callback number in E.164 format, if given.',
    },
    address: { type: ['string', 'null'], description: 'Service address, if given.' },
    service_type: {
      type: ['string', 'null'],
      description: 'Short category of what they need, e.g. roof_leak, ac_repair.',
    },
    description: {
      type: ['string', 'null'],
      description: 'What the caller needs, in their own words.',
    },
    urgency: {
      type: ['string', 'null'],
      enum: ['emergency', 'soon', 'flexible', null],
      description: 'How urgent the caller made it sound.',
    },
    preferred_time: {
      type: ['string', 'null'],
      description: 'When the caller said they would prefer a visit.',
    },
    language: {
      type: 'string',
      enum: ['en', 'es'],
      description: 'Main language the caller used.',
    },
    is_spam: {
      type: 'boolean',
      description: 'true if this was a robocall, telemarketer, or spam, not a real customer.',
    },
  },
  required: ['language', 'is_spam'],
}

export interface AssistantOptions {
  serverUrl: string
  /** Id of the Vapi Custom Credential (Bearer token = VAPI_SERVER_SECRET). */
  serverCredentialId: string
  modelProvider?: string
  model?: string
  voiceProvider?: string
  voiceId?: string
}

export function formatServices(services: BusinessService[]): string {
  if (services.length === 0) {
    return '- Ask the caller what they need; exact pricing is not set up yet.'
  }
  return services
    .map(
      (service) =>
        `- ${service.name}: $${service.price_min.toLocaleString('en-US')}–$${service.price_max.toLocaleString('en-US')}`,
    )
    .join('\n')
}

export function formatHours(hours: BusinessHours): string {
  return DAY_ORDER.map((day) => {
    const entry = hours[day]
    const label = DAY_LABELS[day]
    return entry ? `${label}: ${entry.open}–${entry.close}` : `${label}: Closed`
  }).join('\n')
}

export function buildSystemPrompt(business: Business): string {
  const emergencyInstructions = business.emergency_transfer
    ? `If this sounds like a real emergency (active flooding, no power during extreme heat, a safety hazard), offer to transfer the call right now to ${business.owner_name}'s cell phone.`
    : `This line does not transfer emergency calls. Reassure the caller that ${business.owner_name} will call them back as soon as possible, and make sure the urgency is noted clearly.`

  return fillTemplate(RECEPTIONIST_PROMPT, {
    business_name: business.name,
    trade: business.trade,
    city: business.city,
    state: business.state,
    owner_name: business.owner_name,
    services_list: formatServices(business.services),
    hours_list: formatHours(business.hours),
    emergency_instructions: emergencyInstructions,
  })
}

export function buildFirstMessage(businessName: string): string {
  return `Thanks for calling ${businessName}. This is ${businessName}'s virtual assistant, and this call may be recorded. How can I help you today?`
}

export function buildAssistantPayload(
  business: Business,
  options: AssistantOptions,
): Record<string, unknown> {
  const tools = business.emergency_transfer
    ? [
        {
          type: 'transferCall',
          destinations: [
            {
              type: 'number',
              number: business.owner_whatsapp,
              message: 'Connecting you to the owner now, one moment please.',
              description:
                'Use only for a genuine emergency the caller describes — active flooding, no power during extreme heat, a safety hazard, or similar. Never use it for routine requests or pricing questions.',
            },
          ],
        },
      ]
    : []

  return {
    name: `${business.name} — Recepcionista`,
    firstMessage: buildFirstMessage(business.name),
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: options.modelProvider || DEFAULT_ASSISTANT_MODEL_PROVIDER,
      model: options.model || DEFAULT_ASSISTANT_MODEL,
      messages: [{ role: 'system', content: buildSystemPrompt(business) }],
      tools,
    },
    voice: {
      provider: options.voiceProvider || DEFAULT_VOICE_PROVIDER,
      voiceId: options.voiceId || DEFAULT_VOICE_ID,
    },
    transcriber: { provider: 'deepgram', model: 'nova-3', language: 'multi' },
    // SPEC §7: the greeting always says the call may be recorded.
    artifactPlan: { recordingEnabled: true },
    analysisPlan: {
      structuredDataPlan: {
        enabled: true,
        schema: CALL_EXTRACTION_SCHEMA,
      },
    },
    server: { url: options.serverUrl, credentialId: options.serverCredentialId },
    serverMessages: ['end-of-call-report'],
  }
}
