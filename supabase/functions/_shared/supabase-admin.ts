import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { resolveSupabaseKey } from './supabase-keys.ts'

// SUPABASE_URL and the API keys are injected automatically into every Edge
// Function's environment by Supabase — they never need to be set as secrets
// by hand (and names starting with SUPABASE_ are rejected as secrets).

/** Service role client. Bypasses RLS; only ever used server-side. */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = resolveSupabaseKey(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('SUPABASE_SECRET_KEYS'),
  )
  if (!url || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función.')
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

/** Client scoped to the caller's own JWT, so RLS applies as that user. */
export function createUserClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = resolveSupabaseKey(
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
  )
  if (!url || !anonKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno de la función.')
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}
