import { supabase } from './supabase'
import type { PublicQuote } from '../types'

export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  const { data, error } = await supabase.rpc('get_public_quote', { token })
  if (error) throw error
  return (data as PublicQuote | null) ?? null
}

/** Best-effort — the page still works if this fails, it just won't have marked the view. */
export async function markQuoteViewed(token: string): Promise<void> {
  const { error } = await supabase.rpc('mark_quote_viewed', { token })
  if (error) throw error
}

export function getQuotePdfUrl(pdfPath: string): string {
  return supabase.storage.from('quotes-pdf').getPublicUrl(pdfPath).data.publicUrl
}

export async function acceptPublicQuote(token: string): Promise<void> {
  const { error } = await supabase.functions.invoke('quote-accept', { body: { token } })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      const body = (await context.json().catch(() => null)) as { error?: string } | null
      if (body?.error) throw new Error(body.error)
    }
    throw error
  }
}
