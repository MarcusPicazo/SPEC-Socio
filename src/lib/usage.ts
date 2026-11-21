import { supabase } from './supabase'
import type { Event, UsagePeriod } from '../types'

export async function listUsagePeriodsForBusiness(businessId: string): Promise<UsagePeriod[]> {
  const { data, error } = await supabase
    .from('usage_periods')
    .select('*')
    .eq('business_id', businessId)
    .order('period_start', { ascending: false })
  if (error) throw error
  return data as UsagePeriod[]
}

/** All cycles, newest first — use latestPeriodByBusiness() to keep one per business. */
export async function listUsagePeriods(): Promise<UsagePeriod[]> {
  const { data, error } = await supabase
    .from('usage_periods')
    .select('*')
    .order('period_start', { ascending: false })
  if (error) throw error
  return data as UsagePeriod[]
}

/** Usage alerts and plan-start attempts, for the operator's view of a business. */
export async function listUsageEventsForBusiness(businessId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('business_id', businessId)
    .in('type', [
      'usage.alert_sent',
      'usage.trial_cap_reached',
      'usage.trial_cap_reminder_sent',
      'usage.trial_double_cap',
      'usage.record_failed',
      'billing.end_trial_attempt',
    ])
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return data as Event[]
}

/** "Dejar seguir hasta el día 15": closes the pending decision without charging. */
export async function letTrialContinue(businessId: string): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update({ trial_cap_status: 'operator_continue', trial_cap_status_since: new Date().toISOString() })
    .eq('id', businessId)
  if (error) throw error
}

export interface EndTrialResult {
  billing_period_start: string | null
  next_charge_at: string | null
  whatsapp_sent: boolean
  whatsapp_error: string | null
}

/** "Terminar prueba y cobrar hoy" — charges $199 now via operator-end-trial. */
export async function endTrialAsOperator(businessId: string): Promise<EndTrialResult> {
  const { data, error } = await supabase.functions.invoke('operator-end-trial', {
    body: { business_id: businessId },
  })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      const body = (await context.json().catch(() => null)) as { error?: string } | null
      if (body?.error) throw new Error(body.error)
    }
    throw error
  }
  return data as EndTrialResult
}
