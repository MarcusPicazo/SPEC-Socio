// Resend email client — the only place that talks to the customer in
// plain email (quotes, SPEC §5.1). resend.com is blocked by this
// environment's network policy, so this is built from search results
// describing Resend's documented REST shape, not a live fetch: POST
// https://api.resend.com/emails, Bearer auth, `from: "Name <addr>"`,
// `to` as an array, `reply_to` as a plain string. High confidence — this
// is Resend's stable, most-documented endpoint — but verify against
// resend.com/docs/api-reference/emails/send-email before relying on it.

export interface SendEmailResult {
  success: boolean
  providerMessageId: string | null
  error: string | null
}

export async function sendEmail(args: {
  to: string
  fromName: string
  subject: string
  html: string
  replyTo?: string
}): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !fromEmail) {
    return { success: false, providerMessageId: null, error: 'Faltan RESEND_API_KEY o RESEND_FROM_EMAIL.' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${args.fromName} <${fromEmail}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    return { success: false, providerMessageId: null, error: `Resend ${response.status}: ${text}` }
  }

  const data = JSON.parse(text) as { id?: string }
  return { success: true, providerMessageId: data.id ?? null, error: null }
}
