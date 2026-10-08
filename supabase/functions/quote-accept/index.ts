// Called by the public /q/:token page's Accept button. Public and
// unauthenticated by design — the quote's own public_token is the
// credential, same security model as the get_public_quote RPC. Never
// exposes which quotes exist for a wrong/guessed token (404 either way).

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { formatUsd } from '../_shared/quote-helpers.ts'
import { sendTemplateOrFreeText } from '../_shared/whatsapp.ts'
import { COTIZACION_ACEPTADA_TEMPLATE, TEMPLATE_LANGUAGE } from '../_shared/whatsapp-templates.ts'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400)
  }

  const token = typeof (body as { token?: unknown })?.token === 'string'
    ? (body as { token: string }).token
    : null
  if (!token) return jsonResponse({ error: 'Falta token.' }, 400)

  const admin = createAdminClient()

  const { data: quote } = await admin
    .from('quotes')
    .select('*, businesses(owner_whatsapp), customers(name)')
    .eq('public_token', token)
    .maybeSingle()

  if (!quote) return jsonResponse({ error: 'Cotización no encontrada.' }, 404)

  if (quote.status === 'accepted') {
    // Idempotent — a double tap or a page reload shouldn't error or re-notify the owner.
    return jsonResponse({ ok: true, already_accepted: true }, 200)
  }

  if (quote.status !== 'sent' && quote.status !== 'viewed') {
    return jsonResponse({ error: 'Esta cotización ya no se puede aceptar.' }, 409)
  }

  await admin
    .from('quotes')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', quote.id)

  const customerName = quote.customers?.name ?? 'Tu cliente'
  const amount = formatUsd(quote.total)

  const notification = await sendTemplateOrFreeText(admin, {
    businessId: quote.business_id,
    to: quote.businesses.owner_whatsapp,
    freeText: `🎉 ${customerName} aceptó tu cotización de ${amount}.`,
    template: {
      name: COTIZACION_ACEPTADA_TEMPLATE.name,
      languageCode: TEMPLATE_LANGUAGE,
      bodyParams: [customerName, amount],
    },
  })

  await admin.from('events').insert({
    business_id: quote.business_id,
    type: 'quote.accepted',
    payload: {
      quote_id: quote.id,
      number: quote.number,
      whatsapp_sent: notification.success,
      whatsapp_error: notification.error,
    },
  })

  return jsonResponse({ ok: true }, 200)
})
