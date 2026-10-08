import { assertEquals } from 'jsr:@std/assert@1'
import { buildTemplateComponents, isWithinWindow, toWhatsAppNumber } from './whatsapp.ts'

Deno.test('toWhatsAppNumber strips a leading +', () => {
  assertEquals(toWhatsAppNumber('+17135550142'), '17135550142')
})

Deno.test('toWhatsAppNumber leaves a number without + untouched', () => {
  assertEquals(toWhatsAppNumber('17135550142'), '17135550142')
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
