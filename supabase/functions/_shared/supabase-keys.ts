// Picks the Supabase API key an Edge Function should use.
//
// Supabase injects both key systems (supabase.com/docs/guides/functions/secrets,
// "Default secrets", checked 2026-11-20): the legacy SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY, and the new SUPABASE_PUBLISHABLE_KEYS /
// SUPABASE_SECRET_KEYS as JSON dictionaries ({"default": "sb_..."}). The
// legacy ones stop working if they're disabled in Settings → API Keys, so we
// fall back to the new dictionary's "default" entry.

/** Returns the legacy key if set, otherwise `default` from the JSON dictionary, otherwise null. */
export function resolveSupabaseKey(
  legacyKey: string | undefined,
  keysJson: string | undefined,
): string | null {
  if (legacyKey) return legacyKey
  if (!keysJson) return null
  try {
    const parsed: unknown = JSON.parse(keysJson)
    if (parsed && typeof parsed === 'object') {
      const value = (parsed as Record<string, unknown>).default
      if (typeof value === 'string' && value.length > 0) return value
    }
  } catch {
    // Malformed JSON — treat as missing rather than crash the function.
  }
  return null
}
