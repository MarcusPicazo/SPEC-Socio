// This function is only ever called from the authenticated /admin panel, not
// from a public browser page, so a permissive origin is fine here.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
