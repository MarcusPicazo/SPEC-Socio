import { assert, assertEquals } from 'jsr:@std/assert@1'
import type { Business } from './types.ts'
import {
  buildAssistantPayload,
  buildFirstMessage,
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_VOICE_ID,
} from './vapi-assistant.ts'

function demoBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 'biz-1',
    name: 'Martinez Roofing',
    trade: 'roofing',
    city: 'Houston',
    state: 'TX',
    timezone: 'America/Chicago',
    owner_name: 'Carlos Martinez',
    owner_whatsapp: '+17135550111',
    twilio_number: '+17135550100',
    vapi_assistant_id: null,
    hours: { monday: { open: '07:00', close: '18:00' } },
    services: [{ name: 'Roof inspection', price_min: 0, price_max: 150 }],
    emergency_transfer: true,
    subscription_status: 'trialing',
    subscription_status_since: '2026-11-01T00:00:00Z',
    stripe_customer_id: null,
    trial_ends_at: null,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

const options = {
  serverUrl: 'https://ref.supabase.co/functions/v1/voice-webhook',
  serverCredentialId: 'cred_123',
}

Deno.test('server uses credentialId and never the removed inline secret field', () => {
  const payload = buildAssistantPayload(demoBusiness(), options)
  const server = payload.server as Record<string, unknown>
  assertEquals(server, { url: options.serverUrl, credentialId: 'cred_123' })
  assert(!('secret' in server))
})

Deno.test('defaults to Haiku 4.5 and an active Vapi voice (Paige was retired)', () => {
  const payload = buildAssistantPayload(demoBusiness(), options)
  assertEquals((payload.model as Record<string, unknown>).model, DEFAULT_ASSISTANT_MODEL)
  assertEquals((payload.voice as Record<string, unknown>).voiceId, DEFAULT_VOICE_ID)
  assert((DEFAULT_VOICE_ID as string) !== 'Paige')
})

Deno.test('empty env overrides fall back to the defaults', () => {
  const payload = buildAssistantPayload(demoBusiness(), { ...options, voiceId: '', model: '' })
  assertEquals((payload.voice as Record<string, unknown>).voiceId, DEFAULT_VOICE_ID)
  assertEquals((payload.model as Record<string, unknown>).model, DEFAULT_ASSISTANT_MODEL)
})

Deno.test('greeting matches SPEC §7 word for word', () => {
  assertEquals(
    buildFirstMessage('Martinez Roofing'),
    "Thanks for calling Martinez Roofing. This is Martinez Roofing's virtual assistant, and this call may be recorded. How can I help you today?",
  )
})

Deno.test('adds the transferCall tool to the owner only when emergency_transfer is on', () => {
  const withTransfer = buildAssistantPayload(demoBusiness(), options)
  const tools = (withTransfer.model as { tools: Array<Record<string, unknown>> }).tools
  assertEquals(tools.length, 1)
  assertEquals(tools[0].type, 'transferCall')
  const destination = (tools[0].destinations as Array<Record<string, unknown>>)[0]
  assertEquals(destination.type, 'number')
  assertEquals(destination.number, '+17135550111')

  const withoutTransfer = buildAssistantPayload(demoBusiness({ emergency_transfer: false }), options)
  assertEquals((withoutTransfer.model as { tools: unknown[] }).tools, [])
})

Deno.test('only subscribes to end-of-call-report', () => {
  const payload = buildAssistantPayload(demoBusiness(), options)
  assertEquals(payload.serverMessages, ['end-of-call-report'])
})
