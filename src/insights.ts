import type { Holding } from './portfolio'

export type Allocation = { symbol: string; marketValue: number; percentage: number }
export type InsightCategory = 'allocation' | 'concentration' | 'contribution'
export type InsightSeverity = 'info' | 'watch'
export type Insight = { category: InsightCategory; severity: InsightSeverity; title: string; explanation: string; input: string; value: number }
export type ReturnContributions = { realized: number; unrealized: number; dividends: number }

export const concentrationThreshold = 0.35

export function calculateAllocation(holdings: Holding[]): Allocation[] {
  const totalMarketValue = holdings.reduce((sum, holding) => sum + Math.max(holding.marketValue, 0), 0)
  if (totalMarketValue === 0) return holdings.map((holding) => ({ symbol: holding.symbol, marketValue: holding.marketValue, percentage: 0 }))
  return holdings.map((holding) => ({ symbol: holding.symbol, marketValue: holding.marketValue, percentage: Math.max(holding.marketValue, 0) / totalMarketValue })).sort((left, right) => right.percentage - left.percentage || left.symbol.localeCompare(right.symbol))
}

export function findConcentrationObservations(allocation: Allocation[], threshold = concentrationThreshold): Insight[] {
  return allocation.filter((holding) => holding.percentage > threshold).map((holding) => ({ category: 'concentration', severity: 'watch', title: `${holding.symbol} is a concentrated position`, explanation: `${holding.symbol} represents ${(holding.percentage * 100).toFixed(1)}% of current market value, above the ${(threshold * 100).toFixed(0)}% observation threshold.`, input: 'Portfolio allocation', value: holding.percentage }))
}

export function calculateReturnContributions(contributions: ReturnContributions): Insight[] {
  const entries: Array<[keyof ReturnContributions, string, number]> = [['realized', 'Realized return', contributions.realized], ['unrealized', 'Unrealized return', contributions.unrealized], ['dividends', 'Dividends', contributions.dividends]]
  return entries.map(([key, label, value]) => ({ category: 'contribution', severity: 'info', title: `${label}: ${value >= 0 ? 'positive' : 'negative'} contribution`, explanation: `${label} contributes ${value >= 0 ? 'to' : 'against'} the current return total.`, input: key, value }))
}

export function buildInsights(holdings: Holding[], contributions: ReturnContributions): Insight[] {
  const allocation = calculateAllocation(holdings)
  const totalMarketValue = holdings.reduce((sum, holding) => sum + Math.max(holding.marketValue, 0), 0)
  const allocationInsight: Insight = { category: 'allocation', severity: 'info', title: holdings.length ? `${holdings.length} holdings are currently valued` : 'No holdings are currently valued', explanation: holdings.length ? 'Allocation percentages use current market value from the local demo price data.' : 'Add a supported buy transaction to create an allocation observation.', input: 'Total market value', value: totalMarketValue }
  return [allocationInsight, ...findConcentrationObservations(allocation), ...calculateReturnContributions(contributions)]
}