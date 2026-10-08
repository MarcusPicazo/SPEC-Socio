import { supabase } from './supabase'
import type { Customer, Quote } from '../types'

export interface QuoteWithCustomer extends Quote {
  customer: Pick<Customer, 'name'> | null
}

export async function listRecentQuotesForBusiness(
  businessId: string,
  limit = 10,
): Promise<QuoteWithCustomer[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, customer:customers(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as unknown as QuoteWithCustomer[]
}
