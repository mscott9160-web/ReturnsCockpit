type PriceStatus = 'fresh' | 'stale' | 'unavailable'

type PriceSnapshot = {
  symbol: string
  price: number | null
  status: PriceStatus
  source: string
  asOf: string | null
  reason?: string
}

type MarketDataResponse = { data: PriceSnapshot[]; error: string | null }

import { parseFinnhubQuote } from './finnhub.ts'

const MAX_SYMBOLS = 25
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const jsonResponse = (body: MarketDataResponse, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })

export function normalizeSymbols(value: unknown): { symbols: string[]; error: string | null } {
  if (!Array.isArray(value) || value.length === 0) return { symbols: [], error: 'symbols must be a non-empty array.' }
  if (value.length > MAX_SYMBOLS) return { symbols: [], error: `symbols must contain no more than ${MAX_SYMBOLS} tickers.` }
  const symbols = value.map((symbol) => typeof symbol === 'string' ? symbol.trim().toUpperCase() : '')
  if (symbols.some((symbol) => !symbolPattern.test(symbol))) return { symbols: [], error: 'Each symbol must be a valid uppercase US-style ticker.' }
  return { symbols: [...new Set(symbols)], error: null }
}

const unavailable = (symbol: string, source: string, reason: string): PriceSnapshot => ({ symbol, price: null, status: 'unavailable', source, asOf: null, reason })

const handler = async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ data: [], error: 'Only POST is supported.' }, 405)

  const provider = Deno.env.get('MARKET_DATA_PROVIDER')?.trim().toLowerCase()
  const apiKey = Deno.env.get('FINNHUB_API_KEY')?.trim()
  if (provider !== 'finnhub' || !apiKey) return jsonResponse({ data: [], error: 'Finnhub market-data provider is not configured.' }, 503)

  let body: unknown
  try { body = await request.json() } catch { return jsonResponse({ data: [], error: 'Request body must be valid JSON.' }, 400) }
  const input = normalizeSymbols(body && typeof body === 'object' ? (body as { symbols?: unknown }).symbols : undefined)
  if (input.error) return jsonResponse({ data: [], error: input.error }, 400)

  const source = 'Finnhub'
  const baseUrl = Deno.env.get('FINNHUB_API_BASE_URL')?.trim() || 'https://finnhub.io/api/v1'
  const snapshots = await Promise.all(input.symbols.map(async (symbol) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const url = new URL('/quote', `${baseUrl.replace(/\/$/, '')}/`)
      url.searchParams.set('symbol', symbol)
      url.searchParams.set('token', apiKey)
      const upstream = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
      if (!upstream.ok) return unavailable(symbol, source, `Provider returned HTTP ${upstream.status}.`)
      const parsed = parseFinnhubQuote(await upstream.json())
      return parsed ? { symbol, price: parsed.price, status: 'fresh' as const, source, asOf: parsed.asOf } : unavailable(symbol, source, 'Finnhub returned no usable quote.')
    } catch (error) {
      return error instanceof DOMException && error.name === 'AbortError' ? unavailable(symbol, source, 'Provider request timed out.') : unavailable(symbol, source, 'Provider request could not be completed.')
    } finally { clearTimeout(timeout) }
  }))
  const missing = snapshots.some((snapshot) => snapshot.status === 'unavailable')
  return jsonResponse({ data: snapshots, error: missing ? 'Provider returned a partial response.' : null }, missing ? 502 : 200)
}

Deno.serve(handler)