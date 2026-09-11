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

// Expected provider shape: { data: [{ symbol, price, asOf? }] } or an equivalent array.
// The provider-specific field mapping belongs here once a licensed provider is selected.
export function adaptProviderResponse(payload: unknown, symbols: string[], source: string): { snapshots: PriceSnapshot[]; missing: string[] } {
  const records = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : null
  const bySymbol = new Map<string, PriceSnapshot>()
  for (const record of records ?? []) {
    if (!record || typeof record !== 'object') continue
    const item = record as { symbol?: unknown; price?: unknown; asOf?: unknown }
    const symbol = typeof item.symbol === 'string' ? item.symbol.trim().toUpperCase() : ''
    const price = typeof item.price === 'number' ? item.price : Number(item.price)
    if (!symbols.includes(symbol) || !Number.isFinite(price) || price < 0) continue
    const asOf = typeof item.asOf === 'string' && !Number.isNaN(Date.parse(item.asOf)) ? item.asOf : new Date().toISOString()
    bySymbol.set(symbol, { symbol, price, status: 'fresh', source, asOf })
  }
  const snapshots = symbols.map((symbol) => bySymbol.get(symbol) ?? unavailable(symbol, source, 'No usable quote was returned by the provider.'))
  return { snapshots, missing: snapshots.filter((snapshot) => snapshot.status === 'unavailable').map((snapshot) => snapshot.symbol) }
}

const handler = async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ data: [], error: 'Only POST is supported.' }, 405)

  const providerUrl = Deno.env.get('MARKET_DATA_PROVIDER_URL')?.trim()
  const apiKey = Deno.env.get('MARKET_DATA_API_KEY')?.trim()
  if (!providerUrl || !apiKey) return jsonResponse({ data: [], error: 'Market-data provider is not configured.' }, 503)

  let body: unknown
  try { body = await request.json() } catch { return jsonResponse({ data: [], error: 'Request body must be valid JSON.' }, 400) }
  const input = normalizeSymbols(body && typeof body === 'object' ? (body as { symbols?: unknown }).symbols : undefined)
  if (input.error) return jsonResponse({ data: [], error: input.error }, 400)

  const source = new URL(providerUrl).hostname
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const upstream = await fetch(providerUrl, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ symbols: input.symbols }), signal: controller.signal })
    if (!upstream.ok) return jsonResponse({ data: input.symbols.map((symbol) => unavailable(symbol, source, `Provider returned HTTP ${upstream.status}.`)), error: 'Market-data provider request failed.' }, 502)
    let payload: unknown
    try { payload = await upstream.json() } catch { return jsonResponse({ data: input.symbols.map((symbol) => unavailable(symbol, source, 'Provider returned invalid JSON.')), error: 'Market-data provider returned invalid JSON.' }, 502) }
    const adapted = adaptProviderResponse(payload, input.symbols, source)
    return jsonResponse({ data: adapted.snapshots, error: adapted.missing.length ? 'Provider returned a partial response.' : null }, adapted.missing.length ? 502 : 200)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return jsonResponse({ data: input.symbols.map((symbol) => unavailable(symbol, source, 'Provider request timed out.')), error: 'Market-data provider request timed out.' }, 504)
    return jsonResponse({ data: input.symbols.map((symbol) => unavailable(symbol, source, 'Provider request could not be completed.')), error: 'Could not reach market-data provider.' }, 502)
  } finally { clearTimeout(timeout) }
}

Deno.serve(handler)