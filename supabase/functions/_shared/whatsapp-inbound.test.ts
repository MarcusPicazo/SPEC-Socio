import { assertEquals } from 'jsr:@std/assert@1'
import {
  extractButtonAction,
  extractListReplyAction,
  parseInboundMessages,
  type InboundMessage,
} from './whatsapp-inbound.ts'

function envelope(messages: unknown[]): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [{ value: { messaging_product: 'whatsapp', messages }, field: 'messages' }],
      },
    ],
  }
}

function baseMessage(overrides: Partial<InboundMessage>): InboundMessage {
  return {
    id: 'x',
    from: 'y',
    type: 'text',
    timestamp: null,
    textBody: null,
    buttonPayload: null,
    buttonTitle: null,
    interactiveButtonReplyId: null,
    interactiveButtonReplyTitle: null,
    listReplyId: null,
    listReplyTitle: null,
    audioId: null,
    audioMimeType: null,
    ...overrides,
  }
}

Deno.test('parses a free text message', () => {
  const result = parseInboundMessages(
    envelope([
      {
        from: '17135550100',
        id: 'wamid.ABC',
        timestamp: '1700000000',
        type: 'text',
        text: { body: 'Hola' },
      },
    ]),
  )
  assertEquals(result.length, 1)
  assertEquals(
    result[0],
    baseMessage({
      id: 'wamid.ABC',
      from: '17135550100',
      type: 'text',
      timestamp: '1700000000',
      textBody: 'Hola',
    }),
  )
})

Deno.test('parses a free-form interactive button reply', () => {
  const result = parseInboundMessages(
    envelope([
      {
        from: '17135550100',
        id: 'wamid.DEF',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'confirm:call-123', title: 'Confirmar cita' },
        },
      },
    ]),
  )
  assertEquals(result[0]?.interactiveButtonReplyId, 'confirm:call-123')
  assertEquals(result[0]?.interactiveButtonReplyTitle, 'Confirmar cita')
})

Deno.test('parses a template quick-reply button (Direct Send shape)', () => {
  const result = parseInboundMessages(
    envelope([
      {
        from: '17135550100',
        id: 'wamid.GHI',
        type: 'button',
        button: { payload: 'owner_call:call-123', text: 'Lo llamo yo' },
      },
    ]),
  )
  assertEquals(result[0]?.buttonPayload, 'owner_call:call-123')
  assertEquals(result[0]?.buttonTitle, 'Lo llamo yo')
})

Deno.test('parses an interactive list reply', () => {
  const result = parseInboundMessages(
    envelope([
      {
        from: '17135550100',
        id: 'wamid.LIST',
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'customer:abc-123', title: 'Sarah Miller', description: '' },
        },
      },
    ]),
  )
  assertEquals(result[0]?.listReplyId, 'customer:abc-123')
  assertEquals(result[0]?.listReplyTitle, 'Sarah Miller')
})

Deno.test('parses an inbound voice note', () => {
  const result = parseInboundMessages(
    envelope([
      {
        from: '17135550100',
        id: 'wamid.AUDIO',
        type: 'audio',
        audio: { id: 'media-abc', mime_type: 'audio/ogg; codecs=opus', voice: true },
      },
    ]),
  )
  assertEquals(result[0]?.audioId, 'media-abc')
  assertEquals(result[0]?.audioMimeType, 'audio/ogg; codecs=opus')
})

Deno.test('collects messages across multiple entries and changes', () => {
  const body = {
    entry: [
      {
        changes: [
          { value: { messages: [{ from: '1', id: 'wamid.1', type: 'text', text: { body: 'a' } }] } },
        ],
      },
      {
        changes: [
          { value: { messages: [{ from: '2', id: 'wamid.2', type: 'text', text: { body: 'b' } }] } },
        ],
      },
    ],
  }
  const result = parseInboundMessages(body)
  assertEquals(result.map((m) => m.id), ['wamid.1', 'wamid.2'])
})

Deno.test('skips a message missing id or from instead of throwing', () => {
  const result = parseInboundMessages(
    envelope([
      { id: 'wamid.no-from', type: 'text', text: { body: 'x' } },
      { from: '17135550100', type: 'text', text: { body: 'y' } }, // no id
    ]),
  )
  assertEquals(result, [])
})

Deno.test('returns an empty array for a malformed or empty payload', () => {
  assertEquals(parseInboundMessages({}), [])
  assertEquals(parseInboundMessages(null), [])
  assertEquals(parseInboundMessages('not an object'), [])
  assertEquals(parseInboundMessages({ entry: 'not an array' }), [])
})

Deno.test('extractButtonAction prefers the interactive shape when both are somehow present', () => {
  const action = extractButtonAction(
    baseMessage({
      type: 'interactive',
      buttonPayload: 'owner_call:1',
      buttonTitle: 'Lo llamo yo',
      interactiveButtonReplyId: 'confirm:1',
      interactiveButtonReplyTitle: 'Confirmar cita',
    }),
  )
  assertEquals(action, { payload: 'confirm:1', title: 'Confirmar cita' })
})

Deno.test('extractButtonAction falls back to the template button shape', () => {
  const action = extractButtonAction(
    baseMessage({ type: 'button', buttonPayload: 'owner_call:1', buttonTitle: 'Lo llamo yo' }),
  )
  assertEquals(action, { payload: 'owner_call:1', title: 'Lo llamo yo' })
})

Deno.test('extractButtonAction returns null for a plain text message', () => {
  const action = extractButtonAction(baseMessage({ type: 'text', textBody: 'hola' }))
  assertEquals(action, null)
})

Deno.test('extractListReplyAction returns the row id and title', () => {
  const action = extractListReplyAction(
    baseMessage({ type: 'interactive', listReplyId: 'customer:abc', listReplyTitle: 'Sarah' }),
  )
  assertEquals(action, { id: 'customer:abc', title: 'Sarah' })
})

Deno.test('extractListReplyAction returns null for a non-list message', () => {
  assertEquals(extractListReplyAction(baseMessage({ type: 'text', textBody: 'hola' })), null)
})
