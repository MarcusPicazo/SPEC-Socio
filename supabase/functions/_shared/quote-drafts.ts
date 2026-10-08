// Orchestrates building a quote from the owner's WhatsApp voice notes
// across several messages — each webhook delivery is a separate request
// with no memory, so the in-progress state lives in quote_drafts (see the
// migration for why quotes.customer_id being NOT NULL forces this).
//
// Flow: voice note -> download/store/transcribe -> extract (Sonnet) ->
// resolve customer (match hint, or ask) -> resolve any needs_clarification
// (one at a time) -> promote into a real `quotes` row -> Spanish preview.
// A later "corrige/cambia" voice note re-extracts with the current state
// as context and updates the same draft (or the already-promoted quote,
// if it's still unsent).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { downloadWhatsAppMedia, extensionForMimeType } from './meta-media.ts'
import { transcribeSpanish } from './deepgram.ts'
import { isCorrectionTranscript, extractQuote, type ExistingDraftContext } from './quote-extraction.ts'
import {
  computeQuoteTotals,
  formatUsd,
  isLikelyEmail,
  matchCustomersByHint,
  nextQuoteNumber,
  toQuoteItems,
  type ResolvedQuoteItem,
} from './quote-helpers.ts'
import { sendQuoteEmail } from './quote-email.ts'
import { sendDocument, sendFreeText, sendInteractiveButtons, sendInteractiveList } from './whatsapp.ts'
import type { Business, Quote, QuoteExtraction, QuoteExtractionItem, QuoteItem } from './types.ts'

// Shared with whatsapp-webhook/index.ts, which parses these back out of
// the button tap — defined once here so sender and parser can't drift.
export const SEND_QUOTE_BUTTON_PREFIX = 'send_quote:'
export const CORRECT_QUOTE_BUTTON_PREFIX = 'correct_quote:'

type DraftStatus =
  | 'awaiting_customer'
  | 'awaiting_customer_list_choice'
  | 'awaiting_customer_name'
  | 'awaiting_customer_email'
  | 'awaiting_clarification'
  | 'awaiting_send_email'
  | 'ready'

export interface QuoteDraftRow {
  id: string
  business_id: string
  status: DraftStatus
  customer_hint: string | null
  customer_id: string | null
  candidate_customer_ids: string[]
  pending_customer_name: string | null
  items: QuoteExtractionItem[]
  warranty_en: string | null
  warranty_es: string | null
  notes_en: string | null
  notes_es: string | null
  needs_clarification: string[]
  qa_history: Array<{ question: string; answer: string }>
  transcript_es: string | null
  source_audio_path: string | null
  promoted_quote_id: string | null
}

const CANT_UNDERSTAND_MESSAGE = 'No pude entender bien la nota de voz 😕 ¿Puedes intentar otra vez?'

// ---------------------------------------------------------------------------
// Draft lookup
// ---------------------------------------------------------------------------

/** The business's one in-progress (not yet promoted) draft, if any. */
export async function getActiveDraft(
  admin: SupabaseClient,
  businessId: string,
): Promise<QuoteDraftRow | null> {
  const { data } = await admin
    .from('quote_drafts')
    .select('*')
    .eq('business_id', businessId)
    .neq('status', 'ready')
    .maybeSingle()
  return (data as QuoteDraftRow | null) ?? null
}

/** The most recently promoted draft whose quote is still unsent — usable as "the current draft" for a correction. */
async function getActivePromotedDraft(
  admin: SupabaseClient,
  businessId: string,
): Promise<QuoteDraftRow | null> {
  const { data } = await admin
    .from('quote_drafts')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'ready')
    .not('promoted_quote_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null

  const draft = data as QuoteDraftRow
  const { data: quote } = await admin
    .from('quotes')
    .select('status')
    .eq('id', draft.promoted_quote_id as string)
    .maybeSingle()
  if (!quote || quote.status !== 'draft') return null
  return draft
}

// ---------------------------------------------------------------------------
// Entry point: a voice note just came in
// ---------------------------------------------------------------------------

export async function handleIncomingVoiceNote(
  admin: SupabaseClient,
  business: Business,
  audio: { id: string },
  replyTo: string,
): Promise<void> {
  let media: { bytes: Uint8Array; mimeType: string }
  try {
    media = await downloadWhatsAppMedia(audio.id)
  } catch (error) {
    console.error('No se pudo descargar la nota de voz', error)
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'No pude descargar tu nota de voz 😕 ¿Puedes mandarla otra vez?',
    })
    return
  }

  const storagePath = `${business.id}/${crypto.randomUUID()}.${extensionForMimeType(media.mimeType)}`
  const { error: uploadError } = await admin.storage
    .from('quotes-audio')
    .upload(storagePath, media.bytes, { contentType: media.mimeType })
  if (uploadError) console.error('No se pudo guardar el audio en Storage', uploadError)
  const savedAudioPath = uploadError ? null : storagePath

  let transcript: string
  try {
    transcript = await transcribeSpanish(media.bytes, media.mimeType)
  } catch (error) {
    console.error('No se pudo transcribir la nota de voz', error)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'quote.transcription_failed',
      payload: { error: error instanceof Error ? error.message : String(error) },
    })
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'No pude entender tu nota de voz 😕 ¿Puedes intentar otra vez, más despacio?',
    })
    return
  }

  await admin.from('events').insert({
    business_id: business.id,
    type: 'quote.voice_note_received',
    payload: { transcript_es: transcript, storage_path: savedAudioPath },
  })

  const correction = isCorrectionTranscript(transcript)
  const inProgressDraft = await getActiveDraft(admin, business.id)

  // A pending "waiting for this quote's customer email" isn't a quote
  // being built — don't let an unrelated voice note treat it as one (it
  // would also collide with the one-draft-per-business unique index).
  if (inProgressDraft?.status === 'awaiting_send_email') {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'Antes de eso, dime el correo del cliente para mandar la cotización pendiente — en un momento te pregunto otra vez.',
    })
    return
  }

  const promotedDraft = inProgressDraft ? null : await getActivePromotedDraft(admin, business.id)

  if (correction && !inProgressDraft && !promotedDraft) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'No tengo ninguna cotización reciente para corregir. Manda una nota de voz nueva con los detalles completos.',
    })
    return
  }

  // An in-progress draft is reused regardless of wording — the table only
  // allows one at a time, so there's nothing else it could be. An
  // already-promoted draft (a real `quotes` row) is reused ONLY for an
  // explicit correction — a fresh, unrelated voice note must never
  // silently overwrite an already-created quote for someone else.
  const activeDraft = inProgressDraft ?? (correction ? promotedDraft : null)

  const existingDraft: ExistingDraftContext | null =
    correction && activeDraft
      ? {
          items: activeDraft.items,
          warranty_en: activeDraft.warranty_en,
          warranty_es: activeDraft.warranty_es,
          notes_en: activeDraft.notes_en,
          notes_es: activeDraft.notes_es,
        }
      : null

  const extraction = await extractQuote({ business, transcript, existingDraft })
  if (!extraction) {
    await sendFreeText(admin, { businessId: business.id, to: replyTo, body: CANT_UNDERSTAND_MESSAGE })
    return
  }

  let draft: QuoteDraftRow
  if (activeDraft) {
    // Covers both an explicit correction and a fresh (non-"corrige") voice
    // note arriving while one draft is already in flight — the table
    // allows only one non-ready draft per business, so this one is it.
    await admin
      .from('quote_drafts')
      .update({ transcript_es: transcript, source_audio_path: savedAudioPath, qa_history: [] })
      .eq('id', activeDraft.id)
    draft = { ...activeDraft, transcript_es: transcript, qa_history: [] }
  } else {
    const { data: created, error } = await admin
      .from('quote_drafts')
      .insert({
        business_id: business.id,
        customer_hint: extraction.customer_hint,
        transcript_es: transcript,
        source_audio_path: savedAudioPath,
      })
      .select('*')
      .single()
    if (error) throw error
    draft = created as QuoteDraftRow
  }

  await applyExtractionResult(admin, business, draft, extraction, replyTo)
}

// ---------------------------------------------------------------------------
// Entry points: a reply to a pending draft question
// ---------------------------------------------------------------------------

export async function handleDraftListReply(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  listReplyId: string,
  replyTo: string,
): Promise<void> {
  if (draft.status !== 'awaiting_customer_list_choice') return
  if (!listReplyId.startsWith('customer:')) return

  const customerId = listReplyId.slice('customer:'.length)
  if (!draft.candidate_customer_ids.includes(customerId)) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'Esa opción ya no es válida — manda otra nota de voz para intentar de nuevo.',
    })
    return
  }

  await admin.from('quote_drafts').update({ customer_id: customerId }).eq('id', draft.id)
  await checkClarificationOrFinalize(admin, business, { ...draft, customer_id: customerId }, replyTo)
}

export async function handleDraftTextReply(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  text: string,
  replyTo: string,
): Promise<void> {
  if (draft.status === 'awaiting_customer_name') {
    await admin
      .from('quote_drafts')
      .update({ pending_customer_name: text, status: 'awaiting_customer_email' })
      .eq('id', draft.id)
    await sendFreeText(admin, { businessId: business.id, to: replyTo, body: `¿Cuál es el correo de ${text}?` })
    return
  }

  if (draft.status === 'awaiting_customer_email') {
    const email = text.trim()
    if (!isLikelyEmail(email)) {
      await sendFreeText(admin, {
        businessId: business.id,
        to: replyTo,
        body: 'Ese correo no se ve válido 😕 ¿Puedes mandarlo otra vez?',
      })
      return
    }

    const { data: newCustomer, error } = await admin
      .from('customers')
      .insert({ business_id: business.id, name: draft.pending_customer_name, email })
      .select('id')
      .single()
    if (error) throw error

    await admin.from('quote_drafts').update({ customer_id: newCustomer.id }).eq('id', draft.id)
    await checkClarificationOrFinalize(admin, business, { ...draft, customer_id: newCustomer.id }, replyTo)
    return
  }

  if (draft.status === 'awaiting_send_email') {
    await handleSendEmailReply(admin, business, draft, text, replyTo)
    return
  }

  if (draft.status === 'awaiting_clarification') {
    const question = draft.needs_clarification[0] ?? ''
    const qaHistory = [...draft.qa_history, { question, answer: text }]
    await admin.from('quote_drafts').update({ qa_history: qaHistory }).eq('id', draft.id)

    const extraction = await extractQuote({
      business,
      transcript: draft.transcript_es ?? '',
      existingDraft: {
        items: draft.items,
        warranty_en: draft.warranty_en,
        warranty_es: draft.warranty_es,
        notes_en: draft.notes_en,
        notes_es: draft.notes_es,
        qaHistory,
      },
    })
    if (!extraction) {
      await sendFreeText(admin, {
        businessId: business.id,
        to: replyTo,
        body: 'No logré procesar tu respuesta 😕 ¿Puedes decirlo de otra forma?',
      })
      return
    }

    await applyExtractionResult(admin, business, { ...draft, qa_history: qaHistory }, extraction, replyTo)
  }
}

// ---------------------------------------------------------------------------
// Entry point: the "Enviar" button, and its email follow-up question
// ---------------------------------------------------------------------------

/** Called when the owner taps "Enviar" on a quote's WhatsApp document message. */
export async function handleSendQuoteRequest(
  admin: SupabaseClient,
  business: Business,
  quoteId: string,
  replyTo: string,
): Promise<void> {
  const { data: quote } = await admin
    .from('quotes')
    .select('*, customers(id, name, email)')
    .eq('id', quoteId)
    .eq('business_id', business.id)
    .maybeSingle()

  if (!quote) {
    await sendFreeText(admin, { businessId: business.id, to: replyTo, body: 'No encontré esa cotización.' })
    return
  }

  if (quote.status !== 'draft') {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: `La cotización ${quote.number} ya se envió — no hace falta mandarla otra vez.`,
    })
    return
  }

  const customer = quote.customers as { id: string; name: string | null; email: string | null }

  if (customer.email) {
    await sendQuoteToCustomer(admin, business, quote as Quote, { name: customer.name, email: customer.email }, replyTo)
    return
  }

  // Needs the customer's email first — held as its own quote_drafts state,
  // same mechanism as the voice-note questions. One active draft per
  // business, so a draft for a DIFFERENT quote means "finish that first";
  // a draft already waiting on THIS quote's email just gets re-asked.
  const existingDraft = await getActiveDraft(admin, business.id)
  const alreadyWaitingOnThisQuote =
    existingDraft?.status === 'awaiting_send_email' && existingDraft.promoted_quote_id === quote.id

  if (existingDraft && !alreadyWaitingOnThisQuote) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'Termina lo que estás haciendo ahora antes de mandar esta cotización.',
    })
    return
  }

  if (!existingDraft) {
    await admin
      .from('quote_drafts')
      .insert({ business_id: business.id, status: 'awaiting_send_email', promoted_quote_id: quote.id })
  }

  await sendFreeText(admin, {
    businessId: business.id,
    to: replyTo,
    body: `¿Cuál es el correo de ${customer.name ?? 'tu cliente'} para mandarle la cotización ${quote.number}?`,
  })
}

async function handleSendEmailReply(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  text: string,
  replyTo: string,
): Promise<void> {
  const email = text.trim()
  if (!isLikelyEmail(email)) {
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'Ese correo no se ve válido 😕 ¿Puedes mandarlo otra vez?',
    })
    return
  }

  const { data: quote } = await admin
    .from('quotes')
    .select('*, customers(id, name)')
    .eq('id', draft.promoted_quote_id as string)
    .maybeSingle()

  if (!quote) {
    await admin.from('quote_drafts').update({ status: 'ready', promoted_quote_id: null }).eq('id', draft.id)
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'Ya no encontré esa cotización — intenta de nuevo desde el botón Enviar.',
    })
    return
  }

  await admin.from('customers').update({ email }).eq('id', quote.customer_id)
  await admin.from('quote_drafts').update({ status: 'ready', promoted_quote_id: null }).eq('id', draft.id)

  const customerName = (quote.customers as { name: string | null } | null)?.name ?? null
  await sendQuoteToCustomer(admin, business, quote as Quote, { name: customerName, email }, replyTo)
}

/**
 * Sends the quote email, marks it `sent`, logs it, and confirms to the
 * owner. Claims the quote ('draft' -> 'sending', conditioned on it still
 * being 'draft') before doing anything else — a double tap on "Enviar"
 * calls this twice in quick succession, and only the request whose update
 * actually affects a row wins; the other sees 0 rows updated and returns.
 * Any failure after claiming reverts to 'draft' so Enviar can be retried.
 */
async function sendQuoteToCustomer(
  admin: SupabaseClient,
  business: Business,
  quote: Quote,
  customer: { name: string | null; email: string },
  replyTo: string,
): Promise<void> {
  const { data: claimed, error: claimError } = await admin
    .from('quotes')
    .update({ status: 'sending' })
    .eq('id', quote.id)
    .eq('status', 'draft')
    .select('id')
  if (claimError) throw claimError
  if (!claimed || claimed.length === 0) {
    // Someone else is already sending this one (or it's no longer a
    // draft) — don't send it a second time.
    return
  }

  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  if (!appBaseUrl) {
    console.error('Falta APP_BASE_URL — no se pudo mandar el correo de la cotización.')
    await admin.from('quotes').update({ status: 'draft' }).eq('id', quote.id)
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'No pude mandar el correo — avísale al soporte de Socio.',
    })
    return
  }
  const publicUrl = `${appBaseUrl}/q/${quote.public_token}`

  const emailResult = await sendQuoteEmail({
    to: customer.email,
    businessName: business.name,
    customerName: customer.name,
    quoteNumber: quote.number,
    total: quote.total,
    publicUrl,
  })

  await admin.from('messages').insert({
    business_id: business.id,
    direction: 'outbound',
    channel: 'email',
    to_addr: customer.email,
    from_addr: Deno.env.get('RESEND_FROM_EMAIL') ?? null,
    template: 'quote_email',
    body: publicUrl,
    provider_message_id: emailResult.providerMessageId,
    status: emailResult.success ? 'sent' : 'failed',
  })

  if (!emailResult.success) {
    console.error('No se pudo mandar el correo de la cotización', emailResult.error)
    await admin.from('quotes').update({ status: 'draft' }).eq('id', quote.id)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'quote.email_failed',
      payload: { quote_id: quote.id, error: emailResult.error },
    })
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: `No pude mandar el correo a ${customer.name ?? 'el cliente'} 😕 Intenta de nuevo en un momento con el botón Enviar.`,
    })
    return
  }

  await admin.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quote.id)

  await admin.from('events').insert({
    business_id: business.id,
    type: 'quote.sent',
    payload: { quote_id: quote.id, number: quote.number },
  })

  await sendFreeText(admin, {
    businessId: business.id,
    to: replyTo,
    body: `Enviada a ${customer.name ?? 'tu cliente'} ✉️ Te aviso cuando la abra o la acepte.`,
  })
}

// ---------------------------------------------------------------------------
// Shared continuation after any extraction (fresh, correction, or clarification answer)
// ---------------------------------------------------------------------------

async function applyExtractionResult(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  extraction: QuoteExtraction,
  replyTo: string,
): Promise<void> {
  await admin
    .from('quote_drafts')
    .update({
      items: extraction.items,
      warranty_en: extraction.warranty_en,
      warranty_es: extraction.warranty_es,
      notes_en: extraction.notes_en,
      notes_es: extraction.notes_es,
      needs_clarification: extraction.needs_clarification,
      customer_hint: draft.customer_hint ?? extraction.customer_hint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id)

  const refreshed: QuoteDraftRow = {
    ...draft,
    items: extraction.items,
    warranty_en: extraction.warranty_en,
    warranty_es: extraction.warranty_es,
    notes_en: extraction.notes_en,
    notes_es: extraction.notes_es,
    needs_clarification: extraction.needs_clarification,
    customer_hint: draft.customer_hint ?? extraction.customer_hint,
  }

  if (!refreshed.customer_id) {
    await resolveCustomer(admin, business, refreshed, replyTo)
    return
  }

  await checkClarificationOrFinalize(admin, business, refreshed, replyTo)
}

async function resolveCustomer(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  replyTo: string,
): Promise<void> {
  const hint = draft.customer_hint

  if (!hint) {
    await admin.from('quote_drafts').update({ status: 'awaiting_customer_name' }).eq('id', draft.id)
    await sendFreeText(admin, { businessId: business.id, to: replyTo, body: '¿Cómo se llama el cliente?' })
    return
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentCustomers } = await admin
    .from('customers')
    .select('id, name, phone')
    .eq('business_id', business.id)
    .gte('created_at', thirtyDaysAgo)

  const candidates = matchCustomersByHint(
    hint,
    (recentCustomers ?? []) as Array<{ id: string; name: string | null; phone: string | null }>,
  )

  if (candidates.length === 0) {
    await admin.from('quote_drafts').update({ status: 'awaiting_customer_name' }).eq('id', draft.id)
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: `No encontré a nadie llamado "${hint}" en los últimos 30 días. ¿Cómo se llama el cliente completo?`,
    })
    return
  }

  if (candidates.length === 1) {
    const customerId = candidates[0]?.id as string
    await admin.from('quote_drafts').update({ customer_id: customerId }).eq('id', draft.id)
    await checkClarificationOrFinalize(admin, business, { ...draft, customer_id: customerId }, replyTo)
    return
  }

  const limited = candidates.slice(0, 10)
  await admin
    .from('quote_drafts')
    .update({
      status: 'awaiting_customer_list_choice',
      candidate_customer_ids: limited.map((c) => c.id),
    })
    .eq('id', draft.id)

  await sendInteractiveList(admin, {
    businessId: business.id,
    to: replyTo,
    bodyText: `Encontré varios clientes que podrían ser "${hint}". ¿Cuál es?`,
    buttonLabel: 'Elegir cliente',
    sections: [
      {
        title: 'Clientes',
        rows: limited.map((customer) => {
          const row: { id: string; title: string; description?: string } = {
            id: `customer:${customer.id}`,
            title: (customer.name ?? 'Sin nombre').slice(0, 24),
          }
          if (customer.phone) row.description = customer.phone
          return row
        }),
      },
    ],
  })
}

async function checkClarificationOrFinalize(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  replyTo: string,
): Promise<void> {
  if (draft.needs_clarification.length > 0) {
    await admin.from('quote_drafts').update({ status: 'awaiting_clarification' }).eq('id', draft.id)
    await sendFreeText(admin, { businessId: business.id, to: replyTo, body: draft.needs_clarification[0] as string })
    return
  }
  await finalizeQuote(admin, business, draft, replyTo)
}

async function finalizeQuote(
  admin: SupabaseClient,
  business: Business,
  draft: QuoteDraftRow,
  replyTo: string,
): Promise<void> {
  // needs_clarification should be empty by now, which should mean every
  // item has a price — but if Claude's extraction ever violates its own
  // instructions, fail loud to the owner rather than silently (or crash
  // with no reply at all).
  if (draft.items.some((item) => item.unit_price === null)) {
    console.error('finalizeQuote: an item has no unit_price despite empty needs_clarification', draft.id)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'quote.finalize_failed',
      payload: { draft_id: draft.id, reason: 'item missing unit_price with empty needs_clarification' },
    })
    await sendFreeText(admin, {
      businessId: business.id,
      to: replyTo,
      body: 'Hubo un problema armando la cotización — un artículo se quedó sin precio. Manda otra nota de voz con ese precio para intentar de nuevo.',
    })
    return
  }

  const resolvedItems: ResolvedQuoteItem[] = draft.items.map((item) => ({
    description_es: item.description_es,
    description_en: item.description_en,
    qty: item.qty,
    unit: item.unit,
    unit_price: item.unit_price as number,
  }))
  const quoteItems = toQuoteItems(resolvedItems)
  const totals = computeQuoteTotals(quoteItems)

  if (draft.promoted_quote_id) {
    const { data: existingQuote } = await admin
      .from('quotes')
      .select('status, number')
      .eq('id', draft.promoted_quote_id)
      .maybeSingle()

    if (!existingQuote) throw new Error('promoted_quote_id no corresponde a ninguna cotización.')

    if (existingQuote.status !== 'draft') {
      await sendFreeText(admin, {
        businessId: business.id,
        to: replyTo,
        body: `La cotización ${existingQuote.number} ya se envió — no puedo corregirla por aquí. Hazlo desde el panel si es necesario.`,
      })
      return
    }

    await admin
      .from('quotes')
      .update({
        items: quoteItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        warranty_en: draft.warranty_en,
        notes_en: draft.notes_en,
      })
      .eq('id', draft.promoted_quote_id)

    await admin.from('quote_drafts').update({ status: 'ready' }).eq('id', draft.id)
    await sendQuotePreview(admin, business, replyTo, existingQuote.number, draft, quoteItems, totals)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'quote.updated',
      payload: { quote_id: draft.promoted_quote_id, number: existingQuote.number },
    })
    await generateAndSendPdf(admin, business, draft.promoted_quote_id, existingQuote.number, replyTo)
    return
  }

  const { data: existingNumbers } = await admin.from('quotes').select('number').eq('business_id', business.id)
  const number = nextQuoteNumber(((existingNumbers ?? []) as Array<{ number: string }>).map((q) => q.number))

  const { data: newQuote, error } = await admin
    .from('quotes')
    .insert({
      business_id: business.id,
      customer_id: draft.customer_id,
      number,
      status: 'draft',
      items: quoteItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      warranty_en: draft.warranty_en,
      notes_en: draft.notes_en,
      source_audio_path: draft.source_audio_path,
      transcript_es: draft.transcript_es,
    })
    .select('id, number')
    .single()
  if (error) throw error

  await admin
    .from('quote_drafts')
    .update({ status: 'ready', promoted_quote_id: newQuote.id })
    .eq('id', draft.id)

  await sendQuotePreview(admin, business, replyTo, newQuote.number, draft, quoteItems, totals)
  await admin.from('events').insert({
    business_id: business.id,
    type: 'quote.draft_created',
    payload: { quote_id: newQuote.id, number: newQuote.number },
  })
  await generateAndSendPdf(admin, business, newQuote.id, newQuote.number, replyTo)
}

/**
 * Calls the Vercel PDF function and, on success, sends it to the owner as
 * a WhatsApp document followed by Enviar/Corregir buttons. Not fatal if it
 * fails — the Spanish text preview already went out, so the owner isn't
 * left with nothing; the failure is only logged.
 */
async function generateAndSendPdf(
  admin: SupabaseClient,
  business: Business,
  quoteId: string,
  quoteNumber: string,
  replyTo: string,
): Promise<void> {
  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  const sharedSecret = Deno.env.get('QUOTE_PDF_SHARED_SECRET')
  if (!appBaseUrl || !sharedSecret) {
    console.error('Faltan APP_BASE_URL o QUOTE_PDF_SHARED_SECRET — no se generó el PDF.')
    return
  }

  let pdfUrl: string
  try {
    const response = await fetch(`${appBaseUrl}/api/quote-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sharedSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_id: quoteId }),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`quote-pdf ${response.status}: ${text}`)
    const data = JSON.parse(text) as { pdf_url?: string }
    if (!data.pdf_url) throw new Error('quote-pdf no devolvió pdf_url.')
    pdfUrl = data.pdf_url
  } catch (error) {
    console.error('No se pudo generar el PDF', error)
    await admin.from('events').insert({
      business_id: business.id,
      type: 'quote.pdf_failed',
      payload: { quote_id: quoteId, error: error instanceof Error ? error.message : String(error) },
    })
    return
  }

  await sendDocument(admin, {
    businessId: business.id,
    to: replyTo,
    link: pdfUrl,
    filename: `${quoteNumber}.pdf`,
    caption: `Cotización ${quoteNumber}`,
  })

  await sendInteractiveButtons(admin, {
    businessId: business.id,
    to: replyTo,
    bodyText: '¿Qué quieres hacer con esta cotización?',
    buttons: [
      { id: `${SEND_QUOTE_BUTTON_PREFIX}${quoteId}`, title: 'Enviar' },
      { id: `${CORRECT_QUOTE_BUTTON_PREFIX}${quoteId}`, title: 'Corregir' },
    ],
  })

  await admin.from('events').insert({
    business_id: business.id,
    type: 'quote.pdf_sent',
    payload: { quote_id: quoteId },
  })
}

async function sendQuotePreview(
  admin: SupabaseClient,
  business: Business,
  replyTo: string,
  number: string,
  draft: QuoteDraftRow,
  quoteItems: QuoteItem[],
  totals: { total: number },
): Promise<void> {
  const lines = draft.items
    .map((item, index) => {
      const resolved = quoteItems[index]
      const unitPrice = resolved?.unit_price ?? 0
      const lineTotal = resolved?.total ?? 0
      return `- ${item.description_es} x${item.qty} ${item.unit}: ${formatUsd(unitPrice)} c/u = ${formatUsd(lineTotal)}`
    })
    .join('\n')

  const bodyLines = [
    `📝 Cotización ${number}`,
    '',
    lines,
    '',
    `Total: ${formatUsd(totals.total)}`,
  ]
  if (draft.warranty_es) bodyLines.push(`Garantía: ${draft.warranty_es}`)
  bodyLines.push('', '📋 Guardada como borrador.')

  await sendFreeText(admin, { businessId: business.id, to: replyTo, body: bodyLines.join('\n') })
}
