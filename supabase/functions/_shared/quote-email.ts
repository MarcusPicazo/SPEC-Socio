// The customer-facing "you have a quote" email — English, short, one
// link. Separate from resend.ts so the HTML/subject (the part worth
// testing and most likely to change) doesn't need a live fetch to verify.

import { formatUsd } from './quote-helpers.ts'
import { sendEmail, type SendEmailResult } from './resend.ts'

export function buildQuoteEmailSubject(businessName: string, quoteNumber: string): string {
  return `Your quote from ${businessName} (${quoteNumber})`
}

export function buildQuoteEmailHtml(args: {
  businessName: string
  customerName: string | null
  quoteNumber: string
  total: number
  publicUrl: string
}): string {
  const greeting = args.customerName ? `Hi ${args.customerName},` : 'Hi,'
  return `
<p>${greeting}</p>
<p>${args.businessName} sent you quote ${args.quoteNumber} for ${formatUsd(args.total)}.</p>
<p><a href="${args.publicUrl}">View your quote</a></p>
<p>Thanks,<br>${args.businessName}</p>
`.trim()
}

export function sendQuoteEmail(args: {
  to: string
  businessName: string
  customerName: string | null
  quoteNumber: string
  total: number
  publicUrl: string
  replyTo?: string
}): Promise<SendEmailResult> {
  return sendEmail({
    to: args.to,
    fromName: args.businessName,
    subject: buildQuoteEmailSubject(args.businessName, args.quoteNumber),
    html: buildQuoteEmailHtml(args),
    replyTo: args.replyTo,
  })
}
