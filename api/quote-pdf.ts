// Vercel Node function: renders the English customer-facing PDF for a
// quote, stores it in the public quotes-pdf bucket, and updates
// quotes.pdf_path (and valid_until, if it wasn't set yet — SPEC: 30-day
// validity). Called server-to-server by quote-drafts.ts after a quote is
// created or corrected; protected by a shared secret, not Supabase auth.
//
// Each render gets its own versioned filename (…-{timestamp}.pdf) instead
// of overwriting the same path — a public bucket can sit behind a CDN, so
// overwriting in place risks a corrected quote still serving the old PDF
// for a while. The previous file is deleted after pdf_path is updated.
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { QuoteItem } from '../src/types.js'
import { QuoteDocument } from './_lib/quote-pdf-document.js'

function addDays(iso: string, days: number): string {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10) // date-only, matches quotes.valid_until
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const expectedSecret = process.env.QUOTE_PDF_SHARED_SECRET
  const authHeader = req.headers.authorization
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!expectedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({ error: 'Secreto inválido.' })
    return
  }

  const body = (req.body ?? {}) as { quote_id?: unknown }
  const quoteId = typeof body.quote_id === 'string' ? body.quote_id : null
  if (!quoteId) {
    res.status(400).json({ error: 'Falta quote_id.' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appBaseUrl = process.env.APP_BASE_URL
  if (!supabaseUrl || !serviceRoleKey || !appBaseUrl) {
    res.status(500).json({
      error: 'Faltan variables de entorno en Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o APP_BASE_URL).',
    })
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: quote, error: quoteError } = await admin
    .from('quotes')
    .select('*, customers(name), businesses(name, trade, city, state)')
    .eq('id', quoteId)
    .maybeSingle()

  if (quoteError || !quote) {
    res.status(404).json({ error: 'Cotización no encontrada.' })
    return
  }

  const validUntil = (quote.valid_until as string | null) ?? addDays(quote.created_at as string, 30)
  const publicUrl = `${appBaseUrl}/q/${quote.public_token}`

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(
      QuoteDocument({
        businessName: quote.businesses.name,
        businessTrade: quote.businesses.trade,
        businessCity: quote.businesses.city,
        businessState: quote.businesses.state,
        customerName: quote.customers?.name ?? 'Customer',
        number: quote.number,
        items: quote.items as QuoteItem[],
        subtotal: quote.subtotal,
        tax: quote.tax,
        total: quote.total,
        currency: quote.currency,
        warrantyEn: quote.warranty_en,
        notesEn: quote.notes_en,
        validUntil,
        publicUrl,
      }),
    )
  } catch (error) {
    console.error('No se pudo generar el PDF', error)
    res.status(500).json({ error: 'No se pudo generar el PDF.' })
    return
  }

  const previousPdfPath = quote.pdf_path as string | null
  const pdfPath = `${quote.business_id}/${quote.public_token}-${Date.now()}.pdf`
  const { error: uploadError } = await admin.storage
    .from('quotes-pdf')
    .upload(pdfPath, buffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    res.status(500).json({ error: `No se pudo guardar el PDF: ${uploadError.message}` })
    return
  }

  const updatePayload: Record<string, unknown> = { pdf_path: pdfPath }
  if (!quote.valid_until) updatePayload.valid_until = validUntil
  await admin.from('quotes').update(updatePayload).eq('id', quoteId)

  if (previousPdfPath && previousPdfPath !== pdfPath) {
    const { error: removeError } = await admin.storage.from('quotes-pdf').remove([previousPdfPath])
    if (removeError) console.error('No se pudo borrar el PDF anterior', removeError)
  }

  const { data: publicUrlData } = admin.storage.from('quotes-pdf').getPublicUrl(pdfPath)

  res.status(200).json({ pdf_path: pdfPath, pdf_url: publicUrlData.publicUrl })
}
