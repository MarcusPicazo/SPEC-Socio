// Per-business local time, for the two cron jobs that must respect each
// business's own timezone even though pg_cron only knows UTC: followups
// (send between 9am-6pm local) and weekly-report (send Monday 8am local).
// Deno's Intl.DateTimeFormat has full ICU/tz data built in, so this needs
// no external library — just the IANA zone string already stored on
// businesses.timezone.

/** 0-23. Deno's `hour12: false` returns "24" for midnight in some locales — normalized to 0. */
export function localHour(timezone: string, now: number = Date.now()): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(new Date(now))
  const hour = Number(formatted)
  return hour === 24 ? 0 : hour
}

/** 0 (Sunday) - 6 (Saturday), matching Date#getDay(). */
export function localWeekday(timezone: string, now: number = Date.now()): number {
  const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(
    new Date(now),
  )
  return WEEKDAY_INDEX[formatted] ?? -1
}

/** True when it's currently between `startHour` (inclusive) and `endHour` (exclusive) in `timezone`. */
export function isWithinLocalHours(
  timezone: string,
  startHour: number,
  endHour: number,
  now: number = Date.now(),
): boolean {
  const hour = localHour(timezone, now)
  return hour >= startHour && hour < endHour
}

/** True during the one local hour (e.g. 8 means 8:00-8:59) on a Monday in `timezone`. */
export function isMondayAtLocalHour(timezone: string, hour: number, now: number = Date.now()): boolean {
  return localWeekday(timezone, now) === 1 && localHour(timezone, now) === hour
}
