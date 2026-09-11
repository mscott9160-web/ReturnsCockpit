import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase.ts'

export type AuthResult<T> = {
  data: T
  error: Error | null
}

const notConfigured = <T>(data: T): AuthResult<T> => ({
  data,
  error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
})

export const getCurrentSession = async (): Promise<AuthResult<{ session: Session | null }>> => {
  if (!isSupabaseConfigured || !supabase) return notConfigured({ session: null })

  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}

export const signInWithEmail = async (email: string, password: string): Promise<AuthResult<{ user: User | null; session: Session | null }>> => {
  if (!isSupabaseConfigured || !supabase) return notConfigured({ user: null, session: null })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signUpWithEmail = async (email: string, password: string): Promise<AuthResult<{ user: User | null; session: Session | null }>> => {
  if (!isSupabaseConfigured || !supabase) return notConfigured({ user: null, session: null })

  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export const signOut = async (): Promise<AuthResult<null>> => {
  if (!isSupabaseConfigured || !supabase) return notConfigured(null)

  const { error } = await supabase.auth.signOut()
  return { data: null, error }
}