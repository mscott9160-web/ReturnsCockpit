import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeLiveResponse, normalizeLiveSymbols } from './liveMarketData.ts'

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