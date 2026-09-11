import assert from 'node:assert/strict'
import test from 'node:test'
import { findOrCreatePersonalWorkspace, transactionRowToTransaction, transactionToRow } from './workspaceData.ts'

test('maps database transaction fields to the app transaction shape', () => {
  const transaction = transactionRowToTransaction({ id: '12345678-1234-1234-1234-123456789abc', type: 'dividend', symbol: null, transaction_date: '2026-09-11', shares: '0', amount: '18.40', price: null, fees: 0 })
  assert.equal(transaction.type, 'dividend')
  assert.equal(transaction.symbol, '')
  assert.equal(transaction.date, '2026-09-11')
  assert.equal(transaction.amount, 18.4)
  assert.equal(transaction.price, 0)
  assert.equal(Number.isInteger(transaction.id), true)
})

test('maps an app transaction to database snake_case fields', () => {
  assert.deepEqual(transactionToRow({ id: 7, type: 'buy', symbol: 'AAPL', date: '2026-09-11', shares: 2, amount: 400, price: 200, fees: 1 }, 'workspace-1', 'user-1'), {
    workspace_id: 'workspace-1', user_id: 'user-1', type: 'buy', symbol: 'AAPL', transaction_date: '2026-09-11', shares: 2, amount: 400, price: 200, fees: 1,
  })
})

test('returns a clear result when Supabase is unconfigured', async () => {
  const result = await findOrCreatePersonalWorkspace()
  assert.equal(result.data, null)
  assert.match(result.error?.message ?? '', /Supabase is not configured/)
})