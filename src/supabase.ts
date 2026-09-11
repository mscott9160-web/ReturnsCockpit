import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const createSupabaseClient = (url: string, anonKey: string): SupabaseClient =>
  createClient(url, anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createSupabaseClient(supabaseUrl!, supabaseAnonKey!)
  : null