export type FinnhubQuote = { c?: unknown; t?: unknown; dp?: unknown }

export type ParsedFinnhubQuote = {
  price: number
  asOf: string
  changePercent: number | null
}

export function parseFinnhubQuote(value: unknown): ParsedFinnhubQuote | null {
  if (!value || typeof value !== 'object') return null
  const quote = value as FinnhubQuote
  const price = typeof quote.c === 'number' ? quote.c : Number(quote.c)
  const timestamp = typeof quote.t === 'number' ? quote.t : Number(quote.t)
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) return null
  const asOf = new Date(timestamp * 1000).toISOString()
  const changePercent = typeof quote.dp === 'number' ? quote.dp : Number(quote.dp)
  return { price, asOf, changePercent: Number.isFinite(changePercent) ? changePercent : null }
}