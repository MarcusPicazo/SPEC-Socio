// Parses WhatsApp Cloud API inbound webhook deliveries.
// developers.facebook.com is blocked by this environment's network policy,
// so this is built from the standard, long-stable webhook envelope shape
// rather than a live fetch — this part of the API has been stable for
// years across many third-party integrations, unlike the newer Vapi
// surfaces built earlier in this project.
//
// A button tap arrives in one of two shapes depending on how we sent it
// (see _shared/whatsapp.ts's sendTemplateOrFreeText):
// - free-form interactive buttons: interactive.type === 'button_reply',
//   with interactive.button_reply.{id,title}.
// - a template's quick-reply button (Direct Send): top-level type
//   'button', with button.{payload,text}.
//
// A list row pick arrives as interactive.type === 'list_reply', with
// list_reply.{id,title,description}.
//
// A voice note arrives as type 'audio', with audio.{id,mime_type,voice}.

export interface InboundMessage {
  id: string
  from: string
  type: string
  timestamp: string | null
  textBody: string | null
  buttonPayload: string | null
  buttonTitle: string | null
  interactiveButtonReplyId: string | null
  interactiveButtonReplyTitle: string | null
  listReplyId: string | null
  listReplyTitle: string | null
  audioId: string | null
  audioMimeType: string | null
}

export interface ButtonAction {
  payload: string
  title: string
}

export interface ListReplyAction {
  id: string
  title: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function parseInboundMessages(rawBody: unknown): InboundMessage[] {
  const body = asRecord(rawBody)
  const messages: InboundMessage[] = []

  for (const entry of asArray(body.entry)) {
    for (const change of asArray(asRecord(entry).changes)) {
      const value = asRecord(asRecord(change).value)
      for (const rawMessage of asArray(value.messages)) {
        const m = asRecord(rawMessage)
        const id = asString(m.id)
        const from = asString(m.from)
        if (!id || !from) continue // can't process or dedupe without these

        const interactive = asRecord(m.interactive)
        const buttonReply = asRecord(interactive.button_reply)
        const listReply = asRecord(interactive.list_reply)
        const button = asRecord(m.button)
        const text = asRecord(m.text)
        const audio = asRecord(m.audio)

        messages.push({
          id,
          from,
          type: asString(m.type) ?? 'unknown',
          timestamp: asString(m.timestamp),
          textBody: asString(text.body),
          buttonPayload: asString(button.payload),
          buttonTitle: asString(button.text),
          interactiveButtonReplyId: asString(buttonReply.id),
          interactiveButtonReplyTitle: asString(buttonReply.title),
          listReplyId: asString(listReply.id),
          listReplyTitle: asString(listReply.title),
          audioId: asString(audio.id),
          audioMimeType: asString(audio.mime_type),
        })
      }
    }
  }

  return messages
}

/** Unifies both button-reply shapes into one {payload, title} pair, or null for a non-button message. */
export function extractButtonAction(message: InboundMessage): ButtonAction | null {
  if (message.interactiveButtonReplyId) {
    return { payload: message.interactiveButtonReplyId, title: message.interactiveButtonReplyTitle ?? '' }
  }
  if (message.buttonPayload) {
    return { payload: message.buttonPayload, title: message.buttonTitle ?? '' }
  }
  return null
}

export function extractListReplyAction(message: InboundMessage): ListReplyAction | null {
  if (!message.listReplyId) return null
  return { id: message.listReplyId, title: message.listReplyTitle ?? '' }
}
