import { supabase } from './supabase'
import type { Call, Customer } from '../types'

export interface CallWithCustomer extends Call {
  customer: Pick<Customer, 'name' | 'phone'> | null
}

export async function listRecentCallsForBusiness(
  businessId: string,
  limit = 10,
): Promise<CallWithCustomer[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*, customer:customers(name, phone)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as unknown as CallWithCustomer[]
}

/** Maps business_id -> number of calls received in the last 7 days. */
export async function getCallCountsLast7Days(): Promise<Record<string, number>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('calls')
    .select('business_id')
    .gte('created_at', sevenDaysAgo)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data as { business_id: string }[]) {
    counts[row.business_id] = (counts[row.business_id] ?? 0) + 1
  }
  return counts
}
