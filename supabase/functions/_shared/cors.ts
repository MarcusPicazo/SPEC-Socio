// This function is only ever called from the authenticated /admin panel, not
// from a public browser page, so a permissive origin is fine here.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * For functions a public browser page calls directly (quote-accept, from
 * /q/:token) — "*" would let any site on the internet call it on a
 * visitor's behalf. Restrict to our own frontend's origin instead.
 */
export function corsHeadersForOrigin(allowedOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
