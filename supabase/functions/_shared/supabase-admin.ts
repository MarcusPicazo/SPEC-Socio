import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every Edge Function's environment by Supabase — they
// never need to be set as secrets by hand.

/** Service role client. Bypasses RLS; only ever used server-side. */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función.')
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

/** Client scoped to the caller's own JWT, so RLS applies as that user. */
export function createUserClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno de la función.')
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}
