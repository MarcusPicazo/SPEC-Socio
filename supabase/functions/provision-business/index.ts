// Given a business_id, creates or updates its Vapi voice assistant from
// prompts/receptionist.md and the business's own data, imports/assigns its
// Twilio number in Vapi, and saves vapi_assistant_id back onto the business.
//
// Only callable by an authenticated operator (checked against the
// `operators` table using the caller's own JWT) — never exposed publicly.

import { z } from 'npm:zod@3.23.8'
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase-admin.ts'
import { fillTemplate } from '../_shared/template.ts'
import type { Business, BusinessHours, BusinessService } from '../_shared/types.ts'
import { createOrUpdateAssistant, createOrUpdatePhoneNumber } from '../_shared/vapi.ts'

// Read once at cold start (per CLAUDE.md, prompts never live inside the
// code). Lives in _shared/prompts/ — NOT the repo-root prompts/ — and is
// declared under static_files in config.toml: `deploy` only bundles the
// ES module graph by default, and a Deno.readTextFile call isn't part of
// that graph, so the file would be missing at runtime without it.
const receptionistTemplate = await Deno.readTextFile(
  new URL('../_shared/prompts/receptionist.md', import.meta.url),
)

const requestSchema = z.object({ business_id: z.string().uuid() })

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
// the transcript by voice-webhook's own Claude Haiku call (Day 4), so we
// don't pay Vapi's analysis step to produce it too.
const CALL_EXTRACTION_SCHEMA = {
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
      description: "What the caller needs, in their own words.",
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

function formatServices(services: BusinessService[]): string {
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

function formatHours(hours: BusinessHours): string {
  return DAY_ORDER.map((day) => {
    const entry = hours[day]
    const label = DAY_LABELS[day]
    return entry ? `${label}: ${entry.open}–${entry.close}` : `${label}: Closed`
  }).join('\n')
}

function buildSystemPrompt(business: Business): string {
  const emergencyInstructions = business.emergency_transfer
    ? `If this sounds like a real emergency (active flooding, no power during extreme heat, a safety hazard), offer to transfer the call right now to ${business.owner_name}'s cell phone.`
    : `This line does not transfer emergency calls. Reassure the caller that ${business.owner_name} will call them back as soon as possible, and make sure the urgency is noted clearly.`

  return fillTemplate(receptionistTemplate, {
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

function buildAssistantPayload(args: {
  business: Business
  systemPrompt: string
  serverUrl: string
  serverSecret: string
}): Record<string, unknown> {
  const { business, systemPrompt, serverUrl, serverSecret } = args

  const modelProvider = Deno.env.get('VAPI_ASSISTANT_MODEL_PROVIDER') ?? 'anthropic'
  const modelName = Deno.env.get('VAPI_ASSISTANT_MODEL') ?? 'claude-haiku-4-5-20251001'
  const voiceProvider = Deno.env.get('VAPI_VOICE_PROVIDER') ?? 'vapi'
  const voiceId = Deno.env.get('VAPI_VOICE_ID') ?? 'Paige'

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
    firstMessage: `Thanks for calling ${business.name}. This is ${business.name}'s virtual assistant, and this call may be recorded. How can I help you today?`,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: modelProvider,
      model: modelName,
      messages: [{ role: 'system', content: systemPrompt }],
      tools,
    },
    voice: { provider: voiceProvider, voiceId },
    transcriber: { provider: 'deepgram', model: 'nova-3', language: 'multi' },
    analysisPlan: {
      structuredDataPlan: {
        enabled: true,
        schema: CALL_EXTRACTION_SCHEMA,
      },
    },
    server: { url: serverUrl, secret: serverSecret },
    serverMessages: ['end-of-call-report'],
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Falta autenticación.' }, 401)

  const userClient = createUserClient(authHeader)
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Sesión inválida.' }, 401)

  const { data: operatorRow } = await userClient
    .from('operators')
    .select('id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!operatorRow) return jsonResponse({ error: 'Esta cuenta no tiene permiso de operador.' }, 403)

  let requestBody: unknown
  try {
    requestBody = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400)
  }

  const parsedBody = requestSchema.safeParse(requestBody)
  if (!parsedBody.success) return jsonResponse({ error: 'business_id inválido.' }, 400)

  const admin = createAdminClient()
  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('*')
    .eq('id', parsedBody.data.business_id)
    .single()
  if (businessError || !business) return jsonResponse({ error: 'Negocio no encontrado.' }, 404)

  const typedBusiness = business as Business

  if (!typedBusiness.twilio_number) {
    return jsonResponse(
      { error: 'Este negocio no tiene número de Twilio asignado. Edítalo primero.' },
      400,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const vapiServerSecret = Deno.env.get('VAPI_SERVER_SECRET')
  if (!supabaseUrl || !vapiServerSecret) {
    return jsonResponse(
      { error: 'Faltan SUPABASE_URL o VAPI_SERVER_SECRET en los secretos de la función.' },
      500,
    )
  }
  const voiceWebhookUrl = `${supabaseUrl}/functions/v1/voice-webhook`

  try {
    const systemPrompt = buildSystemPrompt(typedBusiness)
    const assistantPayload = buildAssistantPayload({
      business: typedBusiness,
      systemPrompt,
      serverUrl: voiceWebhookUrl,
      serverSecret: vapiServerSecret,
    })

    const assistant = await createOrUpdateAssistant(
      typedBusiness.vapi_assistant_id,
      assistantPayload,
    )

    const phoneNumber = await createOrUpdatePhoneNumber({
      twilioNumber: typedBusiness.twilio_number,
      assistantId: assistant.id,
    })

    await admin.from('businesses').update({ vapi_assistant_id: assistant.id }).eq('id', typedBusiness.id)

    await admin.from('events').insert({
      business_id: typedBusiness.id,
      type: 'business.provisioned',
      payload: { vapi_assistant_id: assistant.id, phone_number_id: phoneNumber.id },
    })

    return jsonResponse(
      { vapi_assistant_id: assistant.id, phone_number_id: phoneNumber.id },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('provision-business failed', message)

    await admin.from('events').insert({
      business_id: typedBusiness.id,
      type: 'business.provision_failed',
      payload: { error: message },
    })

    return jsonResponse({ error: message }, 502)
  }
})
