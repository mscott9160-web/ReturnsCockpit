import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateHoldings, calculateReturns, parseTransactions, serializeTransactions, validateTransaction } from './portfolio.ts'
import type { Transaction } from './portfolio.ts'
import { getDemoPriceSnapshots } from './marketData.ts'
import { buildInsights, calculateAllocation, findConcentrationObservations } from './insights.ts'

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 1,
  type: 'buy',
  symbol: 'AAPL',
  date: '2026-01-01',
  shares: 0,
  amount: 0,
  price: 0,
  fees: 0,
  ...overrides,
})

test('calculates average cost and unrealized return for multiple buys', () => {
  const result = calculateHoldings([
    transaction({ shares: 10, price: 100, amount: 1000 }),
    transaction({ id: 2, shares: 10, price: 120, amount: 2400 }),
  ])

  assert.equal(result[0].shares, 20)
  assert.equal(result[0].averageCost, 110)
    assert.ok(Math.abs(result[0].marketValue - 3912.8) < 0.000001)
    assert.ok(Math.abs(result[0].unrealized - 1712.8) < 0.000001)
})

test('demo snapshots are explicitly labeled with source and timestamp', () => {
  const snapshots = getDemoPriceSnapshots('2026-09-11T12:00:00.000Z')
  assert.equal(snapshots.AAPL.status, 'demo')
  assert.equal(snapshots.AAPL.source, 'Returns Cockpit demo data')
  assert.equal(snapshots.AAPL.asOf, '2026-09-11T12:00:00.000Z')
})

test('unknown prices have no market value and do not throw', () => {
  const result = calculateReturns([transaction({ symbol: 'NOPE', shares: 2, price: 100, amount: 200 })], {})
  assert.equal(result.holdings[0].marketValue, 0)
  assert.equal(result.holdings[0].unrealized, -200)
})

test('calculates realized and unrealized return after a partial sale', () => {
  const result = calculateReturns([
    transaction({ shares: 10, price: 100, amount: 1000 }),
    transaction({ id: 2, shares: 10, price: 120, amount: 1200 }),
    transaction({ id: 3, type: 'sell', shares: 5, price: 140, amount: 700 }),
  ])

  assert.equal(result.holdings[0].shares, 15)
  assert.equal(result.realized, 150)
  assert.ok(Math.abs(result.unrealized - 1284.6) < 0.000001)
  assert.equal(result.totalReturn, 1434.6)
})

test('includes dividends and fees exactly once', () => {
  const result = calculateReturns([
    transaction({ shares: 10, price: 100, amount: 1000, fees: 5 }),
    transaction({ id: 2, type: 'dividend', amount: 25 }),
    transaction({ id: 3, type: 'fee', amount: 3, fees: 3 }),
  ])

  assert.equal(result.fees, 8)
  assert.equal(result.dividends, 25)
    assert.ok(Math.abs(result.unrealized - 951.4) < 0.000001)
    assert.ok(Math.abs(result.totalReturn - 973.4) < 0.000001)
})

test('rejects unsupported tickers and overselling', () => {
  const transactions = [transaction({ shares: 4, price: 100, amount: 400 })]
  const errors = validateTransaction({ type: 'sell', symbol: 'AAPL', date: '2026-01-02', shares: 5, amount: 500, price: 100, fees: 0 }, transactions)

  assert.match(errors.join(' '), /sell up to 4 shares/)
  assert.deepEqual(validateTransaction({ type: 'buy', symbol: 'NOPE', date: '2026-01-02', shares: 1, amount: 100, price: 100, fees: 0 }), ['Use a supported ticker for a buy or sell.'])
})

test('calculates deterministic allocation and flags concentration above 35%', () => {
  const holdings = [
    { symbol: 'AAPL', shares: 1, averageCost: 100, marketValue: 700, unrealized: 0 },
    { symbol: 'MSFT', shares: 1, averageCost: 100, marketValue: 300, unrealized: 0 },
  ]
  assert.deepEqual(calculateAllocation(holdings), [{ symbol: 'AAPL', marketValue: 700, percentage: 0.7 }, { symbol: 'MSFT', marketValue: 300, percentage: 0.3 }])
  assert.equal(findConcentrationObservations(calculateAllocation(holdings)).length, 1)
})

test('handles empty and zero-value portfolios safely', () => {
  assert.deepEqual(calculateAllocation([]), [])
  assert.deepEqual(calculateAllocation([{ symbol: 'NOPE', shares: 1, averageCost: 100, marketValue: 0, unrealized: -100 }]), [{ symbol: 'NOPE', marketValue: 0, percentage: 0 }])
  assert.match(buildInsights([], { realized: 0, unrealized: 0, dividends: 0 })[0].title, /No holdings/)
})

test('returns contribution observations preserve each input value', () => {
  const insights = buildInsights([], { realized: 12, unrealized: -4, dividends: 3 })
  assert.deepEqual(insights.slice(-3).map((insight) => [insight.input, insight.value]), [['realized', 12], ['unrealized', -4], ['dividends', 3]])
})

test('serializes and parses a versioned transaction ledger', () => {
  const transactions = [transaction({ shares: 2, price: 100, amount: 200 })]
  assert.deepEqual(parseTransactions(serializeTransactions(transactions)), transactions)
})

test('rejects an invalid ledger without partially accepting it', () => {
  assert.throws(() => parseTransactions(JSON.stringify({ version: 1, transactions: [transaction({ shares: 2, price: 100, amount: 200 }), { id: 2, type: 'buy' }] })), /invalid schema/)
  assert.throws(() => parseTransactions(JSON.stringify({ version: 1, transactions: [] })), /non-empty transactions array/)
})
