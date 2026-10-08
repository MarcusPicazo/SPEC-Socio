import { assertEquals } from 'jsr:@std/assert@1'
import { extractButtonAction, parseInboundMessages } from './whatsapp-inbound.ts'

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
  assertEquals(result[0], {
    id: 'wamid.ABC',
    from: '17135550100',
    type: 'text',
    timestamp: '1700000000',
    textBody: 'Hola',
    buttonPayload: null,
    buttonTitle: null,
    interactiveButtonReplyId: null,
    interactiveButtonReplyTitle: null,
  })
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
  const action = extractButtonAction({
    id: 'x',
    from: 'y',
    type: 'interactive',
    timestamp: null,
    textBody: null,
    buttonPayload: 'owner_call:1',
    buttonTitle: 'Lo llamo yo',
    interactiveButtonReplyId: 'confirm:1',
    interactiveButtonReplyTitle: 'Confirmar cita',
  })
  assertEquals(action, { payload: 'confirm:1', title: 'Confirmar cita' })
})

Deno.test('extractButtonAction falls back to the template button shape', () => {
  const action = extractButtonAction({
    id: 'x',
    from: 'y',
    type: 'button',
    timestamp: null,
    textBody: null,
    buttonPayload: 'owner_call:1',
    buttonTitle: 'Lo llamo yo',
    interactiveButtonReplyId: null,
    interactiveButtonReplyTitle: null,
  })
  assertEquals(action, { payload: 'owner_call:1', title: 'Lo llamo yo' })
})

Deno.test('extractButtonAction returns null for a plain text message', () => {
  const action = extractButtonAction({
    id: 'x',
    from: 'y',
    type: 'text',
    timestamp: null,
    textBody: 'hola',
    buttonPayload: null,
    buttonTitle: null,
    interactiveButtonReplyId: null,
    interactiveButtonReplyTitle: null,
  })
  assertEquals(action, null)
})
