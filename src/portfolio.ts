export type TransactionType = 'buy' | 'sell' | 'dividend' | 'fee' | 'deposit' | 'withdrawal'

export type Transaction = {
  id: number
  type: TransactionType
  symbol: string
  date: string
  shares: number
  amount: number
  price: number
  fees: number
}

import { demoPrices } from './marketData.ts'
import type { PriceSnapshotMap } from './marketData.ts'

export type Holding = {
  symbol: string
  shares: number
  averageCost: number
  marketValue: number
  unrealized: number
}

export const prices = demoPrices
export type PriceMap = Record<string, number> | PriceSnapshotMap

function priceFor(symbol: string, priceMap: PriceMap): number | null {
  const value = priceMap[symbol]
  return typeof value === 'number' ? value : value?.price ?? null
}

export type TransactionDraft = Omit<Transaction, 'id'>

export function serializeTransactions(transactions: Transaction[]): string {
  return JSON.stringify({ version: 1, transactions }, null, 2)
}

export function parseTransactions(input: string): Transaction[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  const records = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && 'transactions' in parsed ? parsed.transactions : null
  if (!Array.isArray(records) || records.length === 0) throw new Error('The file must contain a non-empty transactions array.')

  const transactions: Transaction[] = []
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object') throw new Error(`Transaction ${index + 1} must be an object.`)
    const candidate = record as Record<string, unknown>
    const transaction = {
      id: candidate.id,
      type: candidate.type,
      symbol: candidate.symbol,
      date: candidate.date,
      shares: candidate.shares,
      amount: candidate.amount,
      price: candidate.price,
      fees: candidate.fees,
    }
    if (typeof transaction.id !== 'number' || !Number.isInteger(transaction.id) || typeof transaction.type !== 'string' || typeof transaction.symbol !== 'string' || typeof transaction.date !== 'string' || ![transaction.shares, transaction.amount, transaction.price, transaction.fees].every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error(`Transaction ${index + 1} has an invalid schema.`)
    }
    const normalized = transaction as Transaction
    const validationErrors = validateTransaction(normalized, transactions)
    if (validationErrors.length) throw new Error(`Transaction ${index + 1}: ${validationErrors.join(' ')}`)
    if (transactions.some((item) => item.id === normalized.id)) throw new Error(`Transaction ${index + 1} uses a duplicate id.`)
    transactions.push(normalized)
  }
  return transactions
}

export function heldShares(transactions: Transaction[], symbol: string): number {
  return calculateHoldings(transactions).find((holding) => holding.symbol === symbol)?.shares ?? 0
}

export function validateTransaction(draft: TransactionDraft, existingTransactions: Transaction[] = []): string[] {
  const errors: string[] = []
  if (!draft.type) errors.push('Choose a transaction type.')
  if (!draft.date) errors.push('Choose a transaction date.')
  if (['buy', 'sell'].includes(draft.type) && !prices[draft.symbol]) errors.push('Use a supported ticker for a buy or sell.')
  if (['buy', 'sell'].includes(draft.type) && (!Number.isFinite(draft.shares) || draft.shares <= 0)) errors.push('Shares must be greater than zero for a buy or sell.')
  if (['buy', 'sell'].includes(draft.type) && (!Number.isFinite(draft.price) || draft.price <= 0)) errors.push('Price per share must be greater than zero for a buy or sell.')
  if (!Number.isFinite(draft.fees) || draft.fees < 0) errors.push('Fees must be zero or greater.')
  if (['dividend', 'fee', 'deposit', 'withdrawal'].includes(draft.type) && (!Number.isFinite(draft.amount) || draft.amount <= 0)) errors.push('Amount must be greater than zero for this transaction type.')
  if (draft.type === 'sell' && draft.shares > heldShares(existingTransactions, draft.symbol)) errors.push(`You can only sell up to ${heldShares(existingTransactions, draft.symbol)} shares of ${draft.symbol}.`)
  return errors
}

export function calculateHoldings(transactions: Transaction[], priceMap: PriceMap = prices): Holding[] {
  const values = new Map<string, { shares: number; cost: number }>()

  transactions.forEach((transaction) => {
    if (!['buy', 'sell'].includes(transaction.type)) return

    const value = values.get(transaction.symbol) ?? { shares: 0, cost: 0 }
    if (transaction.type === 'buy') {
      value.shares += transaction.shares
      value.cost += transaction.shares * transaction.price + transaction.fees
    } else {
      const average = value.shares ? value.cost / value.shares : 0
      value.shares -= transaction.shares
      value.cost -= average * transaction.shares
    }
    values.set(transaction.symbol, value)
  })

  return [...values.entries()]
    .filter(([, value]) => value.shares > 0.000001)
    .map(([symbol, value]) => {
      const marketValue = value.shares * (priceFor(symbol, priceMap) ?? 0)
      return {
        symbol,
        shares: value.shares,
        averageCost: value.cost / value.shares,
        marketValue,
        unrealized: marketValue - value.cost,
      }
    })
}

export function calculateReturns(transactions: Transaction[], priceMap: PriceMap = prices) {
  const holdings = calculateHoldings(transactions, priceMap)
  let realized = 0
  let dividends = 0
  let fees = 0
  let explicitFees = 0
  const lots = new Map<string, { shares: number; cost: number }>()

  transactions.forEach((transaction) => {
    fees += transaction.fees
    if (transaction.type === 'dividend') dividends += transaction.amount
    if (transaction.type === 'fee') explicitFees += transaction.amount
    if (transaction.type === 'buy') {
      const lot = lots.get(transaction.symbol) ?? { shares: 0, cost: 0 }
      lot.shares += transaction.shares
      lot.cost += transaction.shares * transaction.price + transaction.fees
      lots.set(transaction.symbol, lot)
    }
    if (transaction.type === 'sell') {
      const lot = lots.get(transaction.symbol) ?? { shares: 0, cost: 0 }
      const average = lot.shares ? lot.cost / lot.shares : 0
      realized += transaction.shares * transaction.price - transaction.shares * average - transaction.fees
      lot.shares -= transaction.shares
      lot.cost -= transaction.shares * average
      lots.set(transaction.symbol, lot)
    }
  })

  const unrealized = holdings.reduce((sum, holding) => sum + holding.unrealized, 0)
  return {
    holdings,
    marketValue: holdings.reduce((sum, holding) => sum + holding.marketValue, 0),
    realized,
    unrealized,
    dividends,
    fees,
    totalReturn: realized + unrealized + dividends - explicitFees,
  }
}
