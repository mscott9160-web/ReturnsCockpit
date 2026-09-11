import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeLiveResponse, normalizeLiveSymbols } from './liveMarketData.ts'
import { parseFinnhubQuote } from '../supabase/functions/market-data/finnhub.ts'

test('normalizes and deduplicates ticker symbols', () => {
  assert.deepEqual(normalizeLiveSymbols([' aapl ', 'MSFT', 'AAPL']), ['AAPL', 'MSFT'])
})

test('rejects malformed ticker symbols', () => {
  assert.throws(() => normalizeLiveSymbols(['AAPL', 'not a ticker!']), /valid uppercase US-style ticker/)
})

test('normalizes the stable response contract without network access', () => {
  assert.deepEqual(normalizeLiveResponse({ data: [{ symbol: 'AAPL', price: 195, status: 'fresh', source: 'example', asOf: '2026-09-11T00:00:00Z' }], error: null }), { data: [{ symbol: 'AAPL', price: 195, status: 'fresh', source: 'example', asOf: '2026-09-11T00:00:00Z' }], error: null })
  assert.deepEqual(normalizeLiveResponse({ data: 'bad', error: 'partial' }), { data: [], error: 'partial' })
})

test('parses valid and unavailable Finnhub quotes without network access', () => {
  assert.deepEqual(parseFinnhubQuote({ c: 195.64, t: 1789084800, dp: 1.2 }), { price: 195.64, asOf: '2026-09-11T00:00:00.000Z', changePercent: 1.2 })
  assert.equal(parseFinnhubQuote({ c: 0, t: 1789123200 }), null)
})