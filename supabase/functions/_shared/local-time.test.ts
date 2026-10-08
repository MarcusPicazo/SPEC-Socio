import { assertEquals } from 'jsr:@std/assert@1'
import { isMondayAtLocalHour, isWithinLocalHours, localHour, localWeekday } from './local-time.ts'

// 2026-01-12 is a Monday. January is standard time in both US zones (no
// DST), so the UTC offsets below are fixed: Chicago UTC-6, Los Angeles UTC-8.
const MONDAY_08_CHICAGO = Date.UTC(2026, 0, 12, 14, 0, 0) // 08:00 Chicago / 06:00 LA, Mon
const MONDAY_14_CHICAGO = Date.UTC(2026, 0, 12, 20, 0, 0) // 14:00 Chicago / 12:00 LA, Mon
const SUNDAY_20_CHICAGO = Date.UTC(2026, 0, 12, 2, 0, 0) // 20:00 Chicago (Sun) / 18:00 LA (Sun)

Deno.test('localHour reads the correct hour per timezone for the same instant', () => {
  assertEquals(localHour('America/Chicago', MONDAY_08_CHICAGO), 8)
  assertEquals(localHour('America/Los_Angeles', MONDAY_08_CHICAGO), 6)
})

Deno.test('localWeekday matches Date#getDay() convention (0=Sun..6=Sat)', () => {
  assertEquals(localWeekday('America/Chicago', MONDAY_08_CHICAGO), 1) // Monday
  assertEquals(localWeekday('America/Chicago', SUNDAY_20_CHICAGO), 0) // Sunday
})

Deno.test('isWithinLocalHours is true inside the window and false outside it, per timezone', () => {
  assertEquals(isWithinLocalHours('America/Chicago', 9, 18, MONDAY_14_CHICAGO), true)
  assertEquals(isWithinLocalHours('America/Los_Angeles', 9, 18, MONDAY_14_CHICAGO), true)

  assertEquals(isWithinLocalHours('America/Chicago', 9, 18, MONDAY_08_CHICAGO), false) // 8am, before 9
  assertEquals(isWithinLocalHours('America/Chicago', 9, 18, SUNDAY_20_CHICAGO), false) // 8pm, after 6
})

Deno.test('isWithinLocalHours end hour is exclusive', () => {
  // 18:00 Chicago exactly — should NOT count as "within 9-18".
  const SIX_PM_CHICAGO = Date.UTC(2026, 0, 12, 0, 0, 0) // 18:00 Chicago Mon (prev UTC day)
  assertEquals(localHour('America/Chicago', SIX_PM_CHICAGO), 18)
  assertEquals(isWithinLocalHours('America/Chicago', 9, 18, SIX_PM_CHICAGO), false)
})

Deno.test('isMondayAtLocalHour is true only for the right day AND hour, per timezone', () => {
  assertEquals(isMondayAtLocalHour('America/Chicago', 8, MONDAY_08_CHICAGO), true)
  assertEquals(isMondayAtLocalHour('America/Los_Angeles', 8, MONDAY_08_CHICAGO), false) // it's 6am there
  assertEquals(isMondayAtLocalHour('America/Chicago', 8, MONDAY_14_CHICAGO), false) // right day, wrong hour
  assertEquals(isMondayAtLocalHour('America/Chicago', 20, SUNDAY_20_CHICAGO), false) // right hour, wrong day
})
