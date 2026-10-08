// WhatsApp Cloud API client (outbound only — the inbound webhook that lets
// isWindowOpen actually see an open window is Day 6's whatsapp-webhook).
// developers.facebook.com is blocked by this environment's network policy,
// so this is built from search results that quote Meta's docs, not a live
// fetch. The Graph API version is a guess at a reasonably current one —
// override WHATSAPP_API_VERSION if Meta deprecates it.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const GRAPH_API_VERSION_DEFAULT = 'v21.0'
const WINDOW_MS = 24 * 60 * 60 * 1000

export interface SendResult {
  success: boolean
  providerMessageId: string | null
  error: string | null
}

export interface TemplateButtonPayload {
  payload: string
}

export interface ReplyButton {
  id: string
  title: string
}

export interface InteractiveListRow {
  id: string
  title: string
  description?: string
}

export interface InteractiveListSection {
  title: string
  rows: InteractiveListRow[]
}

function credentials(): { phoneNumberId: string; accessToken: string; apiVersion: string } {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN en el entorno de la función.',
    )
  }
  return {
    phoneNumberId,
    accessToken,
    apiVersion: Deno.env.get('WHATSAPP_API_VERSION') ?? GRAPH_API_VERSION_DEFAULT,
  }
}

/** The Cloud API expects the recipient number in E.164 without the leading +. */
export function toWhatsAppNumber(e164: string): string {
  return e164.startsWith('+') ? e164.slice(1) : e164
}

/** Builds the template `components` array, omitting body/button parts that have nothing to send. */
export function buildTemplateComponents(
  bodyParams?: string[],
  buttonPayloads?: TemplateButtonPayload[],
): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = []

  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    })
  }

  buttonPayloads?.forEach((button, index) => {
    components.push({
      type: 'button',
      sub_type: 'quick_reply',
      index,
      parameters: [{ type: 'payload', payload: button.payload }],
    })
  })

  return components
}

/** Whether `lastInboundAtIso` falls inside the 24h customer service window. `now` is injectable for tests. */
export function isWithinWindow(lastInboundAtIso: string | null, now: number = Date.now()): boolean {
  if (!lastInboundAtIso) return false
  const lastInboundAt = Date.parse(lastInboundAtIso)
  if (Number.isNaN(lastInboundAt)) return false
  return now - lastInboundAt < WINDOW_MS
}

/** Looks up the business's most recent inbound WhatsApp message to see if the free-form window is open. */
export async function isWindowOpen(admin: SupabaseClient, businessId: string): Promise<boolean> {
  const { data } = await admin
    .from('messages')
    .select('created_at')
    .eq('business_id', businessId)
    .eq('direction', 'inbound')
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return isWithinWindow((data?.created_at as string | undefined) ?? null)
}

async function postToGraph(
  body: Record<string, unknown>,
): Promise<{ id: string | null; errorMessage: string | null }> {
  const { phoneNumberId, accessToken, apiVersion } = credentials()
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...body,
      }),
    },
  )

  const text = await response.text()
  if (!response.ok) {
    return { id: null, errorMessage: `WhatsApp ${response.status}: ${text}` }
  }

  const data = JSON.parse(text) as { messages?: Array<{ id: string }> }
  return { id: data.messages?.[0]?.id ?? null, errorMessage: null }
}

async function logMessage(
  admin: SupabaseClient,
  args: {
    businessId: string
    toAddr: string
    template: string | null
    body: string | null
    providerMessageId: string | null
    status: string
  },
): Promise<void> {
  await admin.from('messages').insert({
    business_id: args.businessId,
    direction: 'outbound',
    channel: 'whatsapp',
    to_addr: args.toAddr,
    from_addr: null,
    template: args.template,
    body: args.body,
    provider_message_id: args.providerMessageId,
    status: args.status,
  })
}

export async function sendFreeText(
  admin: SupabaseClient,
  args: { businessId: string; to: string; body: string },
): Promise<SendResult> {
  const { id, errorMessage } = await postToGraph({
    to: toWhatsAppNumber(args.to),
    type: 'text',
    text: { preview_url: false, body: args.body },
  })
  await logMessage(admin, {
    businessId: args.businessId,
    toAddr: args.to,
    template: null,
    body: args.body,
    providerMessageId: id,
    status: errorMessage ? 'failed' : 'sent',
  })
  return { success: !errorMessage, providerMessageId: id, error: errorMessage }
}

export async function sendTemplate(
  admin: SupabaseClient,
  args: {
    businessId: string
    to: string
    templateName: string
    languageCode: string
    bodyParams?: string[]
    buttonPayloads?: TemplateButtonPayload[]
  },
): Promise<SendResult> {
  const components = buildTemplateComponents(args.bodyParams, args.buttonPayloads)

  const { id, errorMessage } = await postToGraph({
    to: toWhatsAppNumber(args.to),
    type: 'template',
    template: {
      name: args.templateName,
      language: { code: args.languageCode },
      ...(components.length > 0 ? { components } : {}),
    },
  })

  await logMessage(admin, {
    businessId: args.businessId,
    toAddr: args.to,
    template: args.templateName,
    body: args.bodyParams?.join(' | ') ?? null,
    providerMessageId: id,
    status: errorMessage ? 'failed' : 'sent',
  })

  return { success: !errorMessage, providerMessageId: id, error: errorMessage }
}

export async function sendDocument(
  admin: SupabaseClient,
  args: { businessId: string; to: string; link: string; filename: string; caption?: string },
): Promise<SendResult> {
  const { id, errorMessage } = await postToGraph({
    to: toWhatsAppNumber(args.to),
    type: 'document',
    document: {
      link: args.link,
      filename: args.filename,
      ...(args.caption ? { caption: args.caption } : {}),
    },
  })
  await logMessage(admin, {
    businessId: args.businessId,
    toAddr: args.to,
    template: null,
    body: args.caption ?? args.filename,
    providerMessageId: id,
    status: errorMessage ? 'failed' : 'sent',
  })
  return { success: !errorMessage, providerMessageId: id, error: errorMessage }
}

export async function sendInteractiveList(
  admin: SupabaseClient,
  args: {
    businessId: string
    to: string
    bodyText: string
    buttonLabel: string
    sections: InteractiveListSection[]
    footerText?: string
  },
): Promise<SendResult> {
  const { id, errorMessage } = await postToGraph({
    to: toWhatsAppNumber(args.to),
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: args.bodyText },
      ...(args.footerText ? { footer: { text: args.footerText } } : {}),
      action: { button: args.buttonLabel, sections: args.sections },
    },
  })
  await logMessage(admin, {
    businessId: args.businessId,
    toAddr: args.to,
    template: null,
    body: args.bodyText,
    providerMessageId: id,
    status: errorMessage ? 'failed' : 'sent',
  })
  return { success: !errorMessage, providerMessageId: id, error: errorMessage }
}

/** Free-form equivalent of a template's quick-reply buttons. WhatsApp allows at most 3. */
export async function sendInteractiveButtons(
  admin: SupabaseClient,
  args: { businessId: string; to: string; bodyText: string; buttons: ReplyButton[] },
): Promise<SendResult> {
  const { id, errorMessage } = await postToGraph({
    to: toWhatsAppNumber(args.to),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: args.bodyText },
      action: {
        buttons: args.buttons.map((button) => ({
          type: 'reply',
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  })
  await logMessage(admin, {
    businessId: args.businessId,
    toAddr: args.to,
    template: null,
    body: args.bodyText,
    providerMessageId: id,
    status: errorMessage ? 'failed' : 'sent',
  })
  return { success: !errorMessage, providerMessageId: id, error: errorMessage }
}

/**
 * The dispatcher most callers should use: free text (with reply buttons, if
 * given) while the 24h window is open, the approved template otherwise.
 */
export async function sendTemplateOrFreeText(
  admin: SupabaseClient,
  args: {
    businessId: string
    to: string
    freeText: string
    freeTextButtons?: ReplyButton[]
    template: {
      name: string
      languageCode: string
      bodyParams?: string[]
      buttonPayloads?: TemplateButtonPayload[]
    }
  },
): Promise<SendResult> {
  const windowOpen = await isWindowOpen(admin, args.businessId)

  if (windowOpen) {
    if (args.freeTextButtons && args.freeTextButtons.length > 0) {
      return sendInteractiveButtons(admin, {
        businessId: args.businessId,
        to: args.to,
        bodyText: args.freeText,
        buttons: args.freeTextButtons,
      })
    }
    return sendFreeText(admin, { businessId: args.businessId, to: args.to, body: args.freeText })
  }

  return sendTemplate(admin, {
    businessId: args.businessId,
    to: args.to,
    templateName: args.template.name,
    languageCode: args.template.languageCode,
    bodyParams: args.template.bodyParams,
    buttonPayloads: args.template.buttonPayloads,
  })
}
