import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateHoldings, calculateReturns, validateTransaction } from './portfolio.ts'
import type { Transaction } from './portfolio.ts'

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
