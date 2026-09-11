import type { SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase.ts'

export type LivePriceStatus = 'fresh' | 'stale' | 'unavailable'
export type LivePriceSnapshot = { symbol: string; price: number | null; status: LivePriceStatus; source: string; asOf: string | null; reason?: string }
export type LiveMarketDataResponse = { data: LivePriceSnapshot[]; error: string | null }

const symbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/

export function normalizeLiveSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) throw new Error('Symbols must be an array.')
  const normalized = symbols.map((symbol) => typeof symbol === 'string' ? symbol.trim().toUpperCase() : '')
  if (normalized.length === 0 || normalized.some((symbol) => !symbolPattern.test(symbol))) throw new Error('Each symbol must be a valid uppercase US-style ticker.')
  return [...new Set(normalized)]
}

export function normalizeLiveResponse(value: unknown): LiveMarketDataResponse {
  if (!value || typeof value !== 'object') return { data: [], error: 'Live market-data response was invalid.' }
  const response = value as { data?: unknown; error?: unknown }
  const data = Array.isArray(response.data) ? response.data.filter((item): item is LivePriceSnapshot => Boolean(item && typeof item === 'object' && typeof (item as LivePriceSnapshot).symbol === 'string')) : []
  return { data, error: typeof response.error === 'string' ? response.error : null }
}

const result = (data: LiveMarketDataResponse['data'], message: string): LiveMarketDataResponse => ({ data, error: message })

export async function fetchLiveMarketData(symbols: unknown, client: SupabaseClient | null = supabase): Promise<LiveMarketDataResponse> {
  let normalized: string[]
  try { normalized = normalizeLiveSymbols(symbols) } catch (error) { return result([], error instanceof Error ? error.message : 'Symbols failed validation.') }
  if (!isSupabaseConfigured || !client) return result([], 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  const user = await client.auth.getUser()
  if (user.error) return result([], user.error.message)
  if (!user.data.user) return result([], 'You must be authenticated to access live market data.')
  const response = await client.functions.invoke('market-data', { body: { symbols: normalized } })
  if (response.error) return result([], response.error.message)
  return normalizeLiveResponse(response.data)
}