import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
const supabaseUrl = viteEnv?.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = viteEnv?.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const createSupabaseClient = (url: string, anonKey: string): SupabaseClient =>
  createClient(url, anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createSupabaseClient(supabaseUrl!, supabaseAnonKey!)
  : null