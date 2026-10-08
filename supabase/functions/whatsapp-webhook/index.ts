// Receives WhatsApp Cloud API events: Meta's GET verification handshake,
// and POST deliveries for messages the owner sends us (including button
// taps on what voice-webhook sent in nueva_llamada).
//
// developers.facebook.com is blocked by this environment's network policy
// — see _shared/whatsapp-inbound.ts for what that means for confidence in
// the exact payload shape (high; this part of the API is long-stable).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { verifyMetaSignature } from '../_shared/meta-signature.ts'
import {
  CORRECT_QUOTE_BUTTON_PREFIX,
  getActiveDraft,
  handleDraftListReply,
  handleDraftTextReply,
  handleIncomingVoiceNote,
  handleSendQuoteRequest,
  SEND_QUOTE_BUTTON_PREFIX,
} from '../_shared/quote-drafts.ts'
import { isUniqueViolation } from '../_shared/postgrest-errors.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'
import type { Business, CallExtraction } from '../_shared/types.ts'
import {
  extractButtonAction,
  extractListReplyAction,
  parseInboundMessages,
  type InboundMessage,
} from '../_shared/whatsapp-inbound.ts'
import { fromWhatsAppNumber, sendFreeText, sendFreeTextUnassociated } from '../_shared/whatsapp.ts'

// Statuses where quote_drafts is actively waiting on a free-text reply —
// 'awaiting_customer' and 'awaiting_customer_list_choice' never persist
// between requests (resolveCustomer runs synchronously right after),
// so they're deliberately not included here.
const TEXT_AWAITING_DRAFT_STATUSES = new Set([
  'awaiting_customer_name',
  'awaiting_customer_email',
  'awaiting_clarification',
  'awaiting_send_email',
])

const UNKNOWN_SENDER_MESSAGE =
  'Hola 👋 Este número es solo para los dueños de negocio que son clientes de Socio. ' +
  'Si buscas al negocio al que le llamaste, contáctalo directamente a su número.'

const HELP_MENU =
  'No entendí ese mensaje 🤔. Por ahora puedo avisarte de llamadas nuevas — responde con ' +
  'los botones que te mando ahí, o espera el próximo aviso.'

const CONFIRM_PREFIX = 'confirm:'
const OWNER_CALL_PREFIX = 'owner_call:'

function handleVerificationRequest(req: Request): Response {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const expectedToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
  if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

async function findCallForBusiness(
  admin: SupabaseClient,
  businessId: string,
  providerCallId: string,
): Promise<{ id: string; extracted: CallExtraction | null; from_number: string | null } | null> {
  const { data } = await admin
    .from('calls')
    .select('id, extracted, from_number')
    .eq('business_id', businessId)
    .eq('provider_call_id', providerCallId)
    .maybeSingle()
  return data ?? null
}

async function handleConfirmCall(
  admin: SupabaseClient,
  business: Business,
  callId: string,
  replyTo: string,
): Promise<void> {
  const call = await findCallForBusiness(admin, business.id, callId)
  if (!call) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'No encontré esa llamada — puede que ya haya pasado mucho tiempo.',
    })
    return
  }

  await admin.from('calls').update({ status: 'confirmed' }).eq('id', call.id)

  const day = call.extracted?.preferred_time ?? 'pronto'
  await sendFreeText(admin, { businessId: business.id, to: replyTo, body: `Listo ✅ Anotado para ${day}` })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'call.confirmed',
    payload: { call_id: callId },
  })
}

async function handleOwnerWillCall(
  admin: SupabaseClient,
  business: Business,
  callId: string,
  replyTo: string,
): Promise<void> {
  const call = await findCallForBusiness(admin, business.id, callId)
  if (!call) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'No encontré esa llamada — puede que ya haya pasado mucho tiempo.',
    })
    return
  }

  await admin.from('calls').update({ status: 'owner_will_call' }).eq('id', call.id)

  const phone = call.extracted?.callback_number ?? call.from_number
  const body = phone
    ? `📞 Aquí tienes su número para marcar: tel:${phone}`
    : 'No tengo un número guardado para esta llamada.'
  await sendFreeText(admin, { businessId: business.id, to: replyTo, body })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'call.owner_will_call',
    payload: { call_id: callId },
  })
}

interface ClaimedMessage {
  business: Business
  fromE164: string
}

/**
 * Dedup + log the inbound message, synchronously — kept fast and separate
 * from handleInboundMessage (the slow part) so the webhook can respond 200
 * right after this, instead of making Meta wait on a voice note's full
 * pipeline. Returns null when there's nothing left to do: already
 * processed, or the sender isn't a registered owner (replied to and
 * logged to `events` already, since `messages.business_id` is NOT NULL).
 */
async function claimInboundMessage(
  admin: SupabaseClient,
  message: InboundMessage,
): Promise<ClaimedMessage | null> {
  const { data: alreadyProcessed } = await admin
    .from('messages')
    .select('id')
    .eq('provider_message_id', message.id)
    .maybeSingle()
  if (alreadyProcessed) return null

  const fromE164 = fromWhatsAppNumber(message.from)
  const { data: business } = await admin
    .from('businesses')
    .select('*')
    .eq('owner_whatsapp', fromE164)
    .maybeSingle()

  const buttonAction = extractButtonAction(message)

  if (!business) {
    const result = await sendFreeTextUnassociated(fromE164, UNKNOWN_SENDER_MESSAGE)
    await admin.from('events').insert({
      business_id: null,
      type: 'whatsapp.unknown_sender',
      payload: {
        from: fromE164,
        provider_message_id: message.id,
        text: message.textBody,
        reply_sent: result.success,
        reply_error: result.error,
      },
    })
    return null
  }

  // Logging this is also what opens the 24h window for future outbound
  // sends — see _shared/whatsapp.ts's isWindowOpen. The explicit error
  // check matters: two concurrent deliveries of the same message (Meta
  // can redeliver) could otherwise both pass the select above before
  // either inserts, and both go on to process the message twice.
  const { error: insertError } = await admin.from('messages').insert({
    business_id: business.id,
    direction: 'inbound',
    channel: 'whatsapp',
    to_addr: null,
    from_addr: fromE164,
    template: null,
    body: buttonAction ? buttonAction.title : message.textBody,
    provider_message_id: message.id,
    status: 'received',
  })
  if (insertError) {
    if (isUniqueViolation(insertError)) return null
    throw insertError
  }

  return { business: business as Business, fromE164 }
}

async function handleInboundMessage(
  admin: SupabaseClient,
  business: Business,
  message: InboundMessage,
  fromE164: string,
): Promise<void> {
  const buttonAction = extractButtonAction(message)

  if (buttonAction?.payload.startsWith(CONFIRM_PREFIX)) {
    await handleConfirmCall(admin, business, buttonAction.payload.slice(CONFIRM_PREFIX.length), fromE164)
    return
  }
  if (buttonAction?.payload.startsWith(OWNER_CALL_PREFIX)) {
    await handleOwnerWillCall(admin, business, buttonAction.payload.slice(OWNER_CALL_PREFIX.length), fromE164)
    return
  }
  if (buttonAction?.payload.startsWith(CORRECT_QUOTE_BUTTON_PREFIX)) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: fromE164,
      body: 'Manda una nota de voz diciendo qué corregir — por ejemplo: "corrige el precio a 9,800 dólares."',
    })
    return
  }
  if (buttonAction?.payload.startsWith(SEND_QUOTE_BUTTON_PREFIX)) {
    await handleSendQuoteRequest(admin, business, buttonAction.payload.slice(SEND_QUOTE_BUTTON_PREFIX.length), fromE164)
    return
  }

  if (message.audioId) {
    await handleIncomingVoiceNote(admin, business, { id: message.audioId }, fromE164)
    return
  }

  const activeDraft = await getActiveDraft(admin, business.id)

  const listAction = extractListReplyAction(message)
  if (activeDraft && listAction) {
    await handleDraftListReply(admin, business, activeDraft, listAction.id, fromE164)
    return
  }

  if (activeDraft && message.textBody && TEXT_AWAITING_DRAFT_STATUSES.has(activeDraft.status)) {
    await handleDraftTextReply(admin, business, activeDraft, message.textBody, fromE164)
    return
  }

  await sendFreeText(admin, { businessId: business.id, to: fromE164, body: HELP_MENU })
}

// Supabase Edge Runtime global — not a standard Deno API, so there's no
// built-in type for it. Lets the handler return its response immediately
// while this promise keeps running in the background (docs: Supabase
// guides/functions/background-tasks). Declared `| undefined` because
// nothing guarantees it exists outside the deployed runtime (e.g. older
// local `supabase functions serve`, or `deno test`).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') return handleVerificationRequest(req)
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!appSecret) return new Response('Server misconfigured', { status: 500 })

  // Read as raw text FIRST — signature verification needs the exact bytes
  // Meta sent; parsing and re-serializing would change them.
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('X-Hub-Signature-256')
  if (!(await verifyMetaSignature(rawBody, signatureHeader, appSecret))) {
    return new Response('Invalid signature', { status: 401 })
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const admin = createAdminClient()
  const messages = parseInboundMessages(parsedBody)

  // Claiming (dedup + logging, fast) runs synchronously, so the response
  // below reflects real committed state. The rest — a voice note's
  // download/transcribe/Sonnet/PDF pipeline can easily run past Meta's
  // retry window — runs in the background, per handleInboundMessage.
  for (const message of messages) {
    let claimed: ClaimedMessage | null
    try {
      claimed = await claimInboundMessage(admin, message)
    } catch (error) {
      console.error('Error reclamando mensaje de WhatsApp', message.id, error)
      await admin.from('events').insert({
        business_id: null,
        type: 'whatsapp.claim_failed',
        payload: { provider_message_id: message.id, error: error instanceof Error ? error.message : String(error) },
      })
      continue
    }
    if (!claimed) continue

    const task = handleInboundMessage(admin, claimed.business, message, claimed.fromE164).catch((error) => {
      console.error('Error procesando mensaje de WhatsApp', message.id, error)
      return admin.from('events').insert({
        business_id: claimed.business.id,
        type: 'whatsapp.processing_failed',
        payload: {
          provider_message_id: message.id,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    })

    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(task)
    } else {
      await task
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200 })
})
