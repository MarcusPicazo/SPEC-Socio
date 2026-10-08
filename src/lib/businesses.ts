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
