import { assertEquals } from 'jsr:@std/assert@1'
import { buildTemplateComponents, fromWhatsAppNumber, isWithinWindow, toWhatsAppNumber } from './whatsapp.ts'

Deno.test('toWhatsAppNumber strips a leading +', () => {
  assertEquals(toWhatsAppNumber('+17135550142'), '17135550142')
})

Deno.test('toWhatsAppNumber leaves a number without + untouched', () => {
  assertEquals(toWhatsAppNumber('17135550142'), '17135550142')
})

Deno.test('fromWhatsAppNumber adds a leading + to a digits-only number', () => {
  assertEquals(fromWhatsAppNumber('17135550142'), '+17135550142')
})

Deno.test('fromWhatsAppNumber leaves a number that already has + untouched', () => {
  assertEquals(fromWhatsAppNumber('+17135550142'), '+17135550142')
})

Deno.test('buildTemplateComponents omits the body component when there are no params', () => {
  assertEquals(buildTemplateComponents(), [])
  assertEquals(buildTemplateComponents([]), [])
})

Deno.test('buildTemplateComponents builds one text parameter per body param, in order', () => {
  const components = buildTemplateComponents(['Sarah', 'Urgente'])
  assertEquals(components, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Sarah' },
        { type: 'text', text: 'Urgente' },
      ],
    },
  ])
})

Deno.test('buildTemplateComponents indexes multiple quick-reply buttons by position', () => {
  const components = buildTemplateComponents(undefined, [
    { payload: 'confirm:123' },
    { payload: 'owner_call:123' },
  ])
  assertEquals(components, [
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: 0,
      parameters: [{ type: 'payload', payload: 'confirm:123' }],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: 1,
      parameters: [{ type: 'payload', payload: 'owner_call:123' }],
    },
  ])
})

Deno.test('buildTemplateComponents combines a body and buttons in one call', () => {
  const components = buildTemplateComponents(['Sarah'], [{ payload: 'confirm:123' }])
  assertEquals(components.length, 2)
  assertEquals(components[0]?.type, 'body')
  assertEquals(components[1]?.type, 'button')
})

const NOW = Date.parse('2026-10-08T15:00:00Z')

Deno.test('isWithinWindow is false when there has never been an inbound message', () => {
  assertEquals(isWithinWindow(null, NOW), false)
})

Deno.test('isWithinWindow is true just under 24h after the last inbound message', () => {
  const twentyThreeHoursAgo = new Date(NOW - 23 * 60 * 60 * 1000).toISOString()
  assertEquals(isWithinWindow(twentyThreeHoursAgo, NOW), true)
})

Deno.test('isWithinWindow is false once 24h have passed', () => {
  const twentyFiveHoursAgo = new Date(NOW - 25 * 60 * 60 * 1000).toISOString()
  assertEquals(isWithinWindow(twentyFiveHoursAgo, NOW), false)
})

Deno.test('isWithinWindow is false for an unparseable timestamp', () => {
  assertEquals(isWithinWindow('not a date', NOW), false)
})

Deno.test('buildTemplateComponents cleans a multi-line summary for the nueva_llamada template', () => {
  // Outside the 24h window the call alert goes out as the nueva_llamada
  // template; summary_es is usually 2–3 lines, which Meta rejects (132018).
  const components = buildTemplateComponents(
    [
      'Sarah Miller',
      'Gotera en el techo, entra agua en la recámara.\nUrgente.\n',
      '+17135550142',
      '4512 Oak St,\tHouston',
      '',
    ],
    [{ payload: 'confirm:call-1' }, { payload: 'owner_call:call-1' }],
  )

  assertEquals(components[0], {
    type: 'body',
    parameters: [
      { type: 'text', text: 'Sarah Miller' },
      { type: 'text', text: 'Gotera en el techo, entra agua en la recámara. Urgente.' },
      { type: 'text', text: '+17135550142' },
      { type: 'text', text: '4512 Oak St, Houston' },
      { type: 'text', text: '—' },
    ],
  })
  // Button payloads are untouched — whatsapp-webhook matches them by prefix.
  assertEquals(components[1], {
    type: 'button',
    sub_type: 'quick_reply',
    index: 0,
    parameters: [{ type: 'payload', payload: 'confirm:call-1' }],
  })
})
