import { supabase } from './supabase'
import type { Business } from '../types'
import type { BusinessInput } from './validation/business'

export async function listBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Business[]
}

export async function getBusiness(id: string): Promise<Business> {
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single()
  if (error) throw error
  return data as Business
}

export async function createBusiness(input: BusinessInput): Promise<Business> {
  const { data, error } = await supabase.from('businesses').insert(input).select().single()
  if (error) throw error
  return data as Business
}

export async function updateBusiness(id: string, input: BusinessInput): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Business
}

export interface ProvisionBusinessResult {
  vapi_assistant_id: string
  phone_number_id: string
}

export async function provisionBusiness(businessId: string): Promise<ProvisionBusinessResult> {
  const { data, error } = await supabase.functions.invoke('provision-business', {
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
  return data as ProvisionBusinessResult
}
