// Cleans a value before it goes into a WhatsApp template body parameter
// ({{1}}, {{2}}, ...).
//
// Meta rejects a template send whose parameter text contains new lines,
// tabs or more than 4 consecutive spaces (error 132018, "There's an issue
// with the parameters in your template" — developers.facebook.com
// .../whatsapp/support/error-codes, checked 2026-11-20). summary_es is
// written as 2–3 short lines, so without this the "nueva llamada" alert
// fails as soon as the 24h window is closed and we fall back to the
// template. Empty parameters are rejected too.

export const MAX_TEMPLATE_PARAM_LENGTH = 500
const EMPTY_PLACEHOLDER = '—'

/** Joins lines into one, collapses whitespace, never returns an empty string, and caps the length. */
export function sanitizeTemplateParam(value: string): string {
  const lines = value
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)

  let joined = ''
  for (const line of lines) {
    if (joined.length === 0) joined = line
    else joined += /[.!?:;,·—-]$/.test(joined) ? ` ${line}` : ` · ${line}`
  }

  if (joined.length === 0) return EMPTY_PLACEHOLDER
  if (joined.length > MAX_TEMPLATE_PARAM_LENGTH) {
    return `${joined.slice(0, MAX_TEMPLATE_PARAM_LENGTH - 1).trimEnd()}…`
  }
  return joined
}
