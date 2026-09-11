export type PriceStatus = 'demo' | 'fresh' | 'stale' | 'unavailable'

export type PriceSnapshot = {
  symbol: string
  price: number | null
  status: PriceStatus
  source: string
  asOf: string | null
}

export type PriceSnapshotMap = Record<string, PriceSnapshot>

export const demoPrices: Record<string, number> = {
  NVDA: 118.2,
  AAPL: 195.64,
  MSFT: 441.12,
  AMZN: 202.18,
  TSLA: 248.98,
  GOOGL: 176.21,
  V: 346.15,
}

export function getDemoPriceSnapshots(asOf = new Date().toISOString()): PriceSnapshotMap {
  return Object.fromEntries(Object.entries(demoPrices).map(([symbol, price]) => [symbol, {
    symbol,
    price,
    status: 'demo' as const,
    source: 'Returns Cockpit demo data',
    asOf,
  }]))
}

export function mergePriceSnapshots(demoSnapshots: PriceSnapshotMap, liveSnapshots: PriceSnapshot[]): PriceSnapshotMap {
  const merged = { ...demoSnapshots }
  liveSnapshots.forEach((snapshot) => {
    if ((snapshot.status === 'fresh' || snapshot.status === 'stale') && typeof snapshot.price === 'number' && Number.isFinite(snapshot.price)) {
      merged[snapshot.symbol] = snapshot
    }
  })
  return merged
}