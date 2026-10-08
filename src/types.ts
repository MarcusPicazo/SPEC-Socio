// Shared types for Socio. Mirror of supabase/functions/_shared/types.ts.
// Keep both files in sync manually; there is no build step that shares them
// between the Vite frontend and the Deno Edge Functions runtime.

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

export type Language = 'en' | 'es'

export type CallStatus = 'new' | 'confirmed' | 'owner_will_call' | 'ignored'

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'

export type MessageDirection = 'inbound' | 'outbound'

export type MessageChannel = 'whatsapp' | 'email' | 'sms'

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null
}

export interface BusinessService {
  name: string
  price_min: number
  price_max: number
}

export interface Business {
  id: string
  name: string
  trade: string
  city: string
  state: string
  timezone: string
  owner_name: string
  owner_whatsapp: string
  twilio_number: string | null
  vapi_assistant_id: string | null
  hours: BusinessHours
  services: BusinessService[]
  emergency_transfer: boolean
  subscription_status: SubscriptionStatus
  stripe_customer_id: string | null
  trial_ends_at: string | null
  created_at: string
}

export interface Operator {
  id: string
  user_id: string
  name: string | null
  created_at: string
}

export interface Customer {
  id: string
  business_id: string
  name: string | null
  phone: string | null
  email: string | null
  address: string | null
  language: Language | null
  created_at: string
}

/**
 * SPEC §6.2 — structured extraction from an inbound call, produced by
 * Vapi's analysisPlan.structuredDataPlan. summary_es is NOT part of this —
 * it's generated separately by voice-webhook's own Claude Haiku call and
 * stored in Call.summary_es, its own column.
 */
export interface CallExtraction {
  caller_name: string | null
  callback_number: string | null
  address: string | null
  service_type: string | null
  description: string | null
  urgency: 'emergency' | 'soon' | 'flexible' | null
  preferred_time: string | null
  language: Language
  is_spam: boolean
}

export interface Call {
  id: string
  business_id: string
  customer_id: string | null
  provider_call_id: string
  from_number: string | null
  started_at: string | null
  duration_sec: number | null
  recording_url: string | null
  transcript: string | null
  extracted: CallExtraction | null
  summary_es: string | null
  is_spam: boolean
  status: CallStatus
  created_at: string
}

export interface QuoteItem {
  description_en: string
  qty: number
  unit: string
  unit_price: number
  total: number
}

/** SPEC §6.3 — structured extraction from an owner's quote voice note. */
export interface QuoteExtractionItem {
  description_es: string
  description_en: string
  qty: number
  unit: string
  unit_price: number | null
}

export interface QuoteExtraction {
  customer_hint: string | null
  items: QuoteExtractionItem[]
  warranty_en: string | null
  notes_en: string | null
  needs_clarification: string[]
}

export interface Quote {
  id: string
  business_id: string
  customer_id: string
  call_id: string | null
  number: string
  status: QuoteStatus
  items: QuoteItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  notes_en: string | null
  warranty_en: string | null
  valid_until: string | null
  public_token: string
  pdf_path: string | null
  source_audio_path: string | null
  transcript_es: string | null
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  followup_count: number
  created_at: string
}

export interface Message {
  id: string
  business_id: string
  direction: MessageDirection
  channel: MessageChannel
  to_addr: string | null
  from_addr: string | null
  template: string | null
  body: string | null
  provider_message_id: string | null
  status: string | null
  created_at: string
}

export interface Event {
  id: string
  business_id: string | null
  type: string
  payload: Record<string, unknown>
  created_at: string
}

/** Shape returned by the get_public_quote(token) RPC — public fields only. */
export interface PublicQuote {
  number: string
  status: QuoteStatus
  items: QuoteItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  notes_en: string | null
  warranty_en: string | null
  valid_until: string | null
  pdf_path: string | null
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  customer: { name: string | null }
  business: { name: string; trade: string; city: string; state: string }
}
