// Vapi calls this after every phone call ends (end-of-call-report). It:
// - verifies the request actually came from Vapi,
// - is idempotent on provider_call_id (Vapi can redeliver),
// - finds the business, saves the call, and creates/updates the customer,
// - stops there if the call was spam,
// - otherwise generates summary_es with Claude Haiku and saves it too.
//
// Every delivery is logged in full to `events`, since the exact shape of
// Vapi's payload could not be confirmed against live docs while building
// this (see vapi-report.ts) — that log is how to check the real shape
// after a first test call.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { z } from 'npm:zod@3.23.8'
import { callClaudeJson } from '../_shared/anthropic.ts'
import { normalizeCallExtraction } from '../_shared/call-extraction.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { fillTemplate } from '../_shared/template.ts'
import type { Business, CallExtraction } from '../_shared/types.ts'
import { extractCallFields, type ExtractedCallFields } from '../_shared/vapi-report.ts'
import { sendTemplateOrFreeText } from '../_shared/whatsapp.ts'
import { NUEVA_LLAMADA_TEMPLATE, TEMPLATE_LANGUAGE } from '../_shared/whatsapp-templates.ts'

const callSummaryTemplate = await Deno.readTextFile(
  new URL('../../../prompts/call-summary.md', import.meta.url),
)

const envelopeSchema = z.object({
  message: z.object({ type: z.string() }).passthrough(),
})

const summarySchema = z.object({ summary_es: z.string().min(1) })
const summaryJsonSchema = {
  type: 'object',
  properties: { summary_es: { type: 'string' } },
  required: ['summary_es'],
  additionalProperties: false,
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Vapi's server.secret arrives as either a Bearer token or the legacy x-vapi-secret header — sources disagree, so this checks both. */
function verifySecret(req: Request): boolean {
  const expected = Deno.env.get('VAPI_SERVER_SECRET')
  if (!expected) return false

  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    if (token === expected) return true
  }

  return req.headers.get('x-vapi-secret') === expected
}

async function findBusiness(
  admin: SupabaseClient,
  fields: ExtractedCallFields,
): Promise<Business | null> {
  if (fields.assistantId) {
    const { data } = await admin
      .from('businesses')
      .select('*')
      .eq('vapi_assistant_id', fields.assistantId)
      .maybeSingle()
    if (data) return data as Business
  }
  if (fields.dialedNumber) {
    const { data } = await admin
      .from('businesses')
      .select('*')
      .eq('twilio_number', fields.dialedNumber)
      .maybeSingle()
    if (data) return data as Business
  }
  return null
}

async function findOrCreateCustomer(
  admin: SupabaseClient,
  businessId: string,
  phone: string | null,
  extraction: CallExtraction,
): Promise<string | null> {
  if (!phone) return null

  const { data: existing } = await admin
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (extraction.caller_name && !existing.name) patch.name = extraction.caller_name
    if (!existing.language) patch.language = extraction.language
    if (extraction.address && !existing.address) patch.address = extraction.address
    if (Object.keys(patch).length > 0) {
      await admin.from('customers').update(patch).eq('id', existing.id)
    }
    return existing.id as string
  }

  const { data: created, error } = await admin
    .from('customers')
    .insert({
      business_id: businessId,
      phone,
      name: extraction.caller_name,
      language: extraction.language,
      address: extraction.address,
    })
    .select('id')
    .single()
  if (error) throw error
  return created.id as string
}

async function generateSummaryEs(args: {
  business: Business
  extraction: CallExtraction
  transcript: string | null
}): Promise<string | null> {
  const model = Deno.env.get('CALL_SUMMARY_MODEL') ?? 'claude-haiku-4-5-20251001'
  const notSpecified = 'No se especificó'

  const prompt = fillTemplate(callSummaryTemplate, {
    owner_name: args.business.owner_name,
    business_name: args.business.name,
    caller_name: args.extraction.caller_name ?? notSpecified,
    callback_number: args.extraction.callback_number ?? notSpecified,
    address: args.extraction.address ?? notSpecified,
    service_type: args.extraction.service_type ?? notSpecified,
    description: args.extraction.description ?? notSpecified,
    urgency: args.extraction.urgency ?? notSpecified,
    preferred_time: args.extraction.preferred_time ?? notSpecified,
    transcript: args.transcript ?? '(sin transcripción)',
  })

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callClaudeJson<unknown>({
        model,
        userMessage: prompt,
        schema: summaryJsonSchema,
      })
      const parsed = summarySchema.safeParse(raw)
      if (parsed.success) return parsed.data.summary_es
      console.error(`summary_es con forma inválida en intento ${attempt}:`, parsed.error.message)
    } catch (error) {
      console.error(`summary_es falló en intento ${attempt}:`, error)
    }
  }
  return null
}

/**
 * SPEC §2 momento 1: the owner must hear about a new call within 60s. Sent
 * even when summary_es failed to generate — falling back to the raw
 * description — because staying silent would be worse than a rough
 * message (regla de oro: nunca más una llamada perdida).
 */
async function notifyOwnerOfNewCall(
  admin: SupabaseClient,
  args: { business: Business; extraction: CallExtraction; summaryEs: string | null; callId: string },
): Promise<{ success: boolean; error: string | null }> {
  const { business, extraction, summaryEs, callId } = args
  const notEspecificado = 'No especificado'

  const callerName = extraction.caller_name ?? 'Cliente sin nombre'
  const resumen =
    summaryEs ?? extraction.description ?? 'No se pudo generar el resumen. Revisa el panel.'
  const phone = extraction.callback_number ?? notEspecificado
  const address = extraction.address ?? notEspecificado
  const preferredTime = extraction.preferred_time ?? notEspecificado

  const freeText =
    `📞 *Nueva llamada — ${callerName}*\n${resumen}\n` +
    `Tel: ${phone} · ${address}\nPrefiere: ${preferredTime}`

  const result = await sendTemplateOrFreeText(admin, {
    businessId: business.id,
    to: business.owner_whatsapp,
    freeText,
    freeTextButtons: [
      { id: `confirm:${callId}`, title: NUEVA_LLAMADA_TEMPLATE.buttons[0] },
      { id: `owner_call:${callId}`, title: NUEVA_LLAMADA_TEMPLATE.buttons[1] },
    ],
    template: {
      name: NUEVA_LLAMADA_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: [callerName, resumen, phone, address, preferredTime],
      buttonPayloads: [{ payload: `confirm:${callId}` }, { payload: `owner_call:${callId}` }],
    },
  })

  return { success: result.success, error: result.error }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  if (!verifySecret(req)) {
    return jsonResponse({ error: 'Secreto inválido.' }, 401)
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400)
  }

  const envelope = envelopeSchema.safeParse(rawBody)
  if (!envelope.success) {
    return jsonResponse({ error: 'Payload inválido.' }, 400)
  }

  const message = envelope.data.message as Record<string, unknown>
  const admin = createAdminClient()

  // provision-business only subscribed the assistant to end-of-call-report;
  // anything else is acknowledged without processing.
  if (message.type !== 'end-of-call-report') {
    return jsonResponse({ ok: true, ignored: true }, 200)
  }

  const fields = extractCallFields(message)

  // Logged before anything else, and on every delivery including dupes —
  // the only way to confirm Vapi's real payload shape (see vapi-report.ts).
  await admin.from('events').insert({
    business_id: null,
    type: 'call.webhook_received',
    payload: { call_id: fields.callId, raw: rawBody },
  })

  if (!fields.callId) {
    return jsonResponse({ error: 'El payload no trae un id de llamada.' }, 400)
  }

  const { data: existingCall } = await admin
    .from('calls')
    .select('id')
    .eq('provider_call_id', fields.callId)
    .maybeSingle()
  if (existingCall) {
    return jsonResponse({ ok: true, duplicate: true }, 200)
  }

  const business = await findBusiness(admin, fields)
  if (!business) {
    await admin.from('events').insert({
      business_id: null,
      type: 'call.unmatched_business',
      payload: {
        call_id: fields.callId,
        assistant_id: fields.assistantId,
        dialed_number: fields.dialedNumber,
      },
    })
    return jsonResponse({ ok: true, unmatched: true }, 200)
  }

  // Day 3's transferCall tool is only ever attached when emergency_transfer
  // is on, so this endedReason can only mean that path fired. It confirms
  // Vapi *attempted* the transfer, not that the owner actually answered —
  // Vapi's own docs are explicit that endedReason alone can't tell us that.
  if (fields.endedReason === 'assistant-forwarded-call') {
    await admin.from('events').insert({
      business_id: business.id,
      type: 'call.emergency_transferred',
      payload: { call_id: fields.callId, ended_reason: fields.endedReason },
    })
  }

  const extraction = normalizeCallExtraction(fields.structuredData)
  const customerId = await findOrCreateCustomer(
    admin,
    business.id,
    fields.customerNumber,
    extraction,
  )

  const baseCallRow = {
    business_id: business.id,
    customer_id: customerId,
    provider_call_id: fields.callId,
    from_number: fields.customerNumber,
    started_at: fields.startedAt,
    duration_sec: fields.durationSec,
    recording_url: fields.recordingUrl,
    transcript: fields.transcript,
    extracted: extraction,
  }

  if (extraction.is_spam) {
    const { error: insertError } = await admin.from('calls').upsert(
      { ...baseCallRow, summary_es: null, is_spam: true, status: 'ignored' },
      { onConflict: 'provider_call_id', ignoreDuplicates: true },
    )
    if (insertError) throw insertError

    await admin.from('events').insert({
      business_id: business.id,
      type: 'call.ignored_spam',
      payload: { call_id: fields.callId },
    })

    return jsonResponse({ ok: true, spam: true }, 200)
  }

  const summaryEs = await generateSummaryEs({
    business,
    extraction,
    transcript: fields.transcript,
  })

  const { error: insertError } = await admin.from('calls').upsert(
    { ...baseCallRow, summary_es: summaryEs, is_spam: false, status: 'new' },
    { onConflict: 'provider_call_id', ignoreDuplicates: true },
  )
  if (insertError) throw insertError

  if (!summaryEs) {
    await admin.from('events').insert({
      business_id: business.id,
      type: 'call.summary_failed',
      payload: {
        call_id: fields.callId,
        note: 'No se pudo generar summary_es tras 2 intentos. Se le avisó al dueño igual, usando la descripción cruda como resumen.',
      },
    })
  }

  const notification = await notifyOwnerOfNewCall(admin, {
    business,
    extraction,
    summaryEs,
    callId: fields.callId,
  })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'call.processed',
    payload: {
      call_id: fields.callId,
      is_spam: false,
      summary_generated: Boolean(summaryEs),
      whatsapp_sent: notification.success,
      whatsapp_error: notification.error,
    },
  })

  return jsonResponse({ ok: true }, 200)
})
