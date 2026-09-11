import type { User } from '@supabase/supabase-js'
import { parseTransactions } from './portfolio.ts'
import type { Transaction } from './portfolio.ts'
import { isSupabaseConfigured, supabase } from './supabase.ts'

type WorkspaceRow = { id: string; name: string; owner_id: string }
type TransactionRow = {
  id: string
  type: Transaction['type']
  symbol: string | null
  transaction_date: string
  shares: number | string | null
  amount: number | string | null
  price: number | string | null
  fees: number | string | null
}
type WatchlistRow = { id: string; name: string }
type WatchlistItemRow = { symbol: string }

export type WorkspaceResult<T> = { data: T; error: Error | null }
export type Workspace = { id: string; name: string; ownerId: string }

const errorResult = <T>(data: T, message: string): WorkspaceResult<T> => ({ data, error: new Error(message) })
const configuredClient = () => isSupabaseConfigured && supabase ? supabase : null
const toNumber = (value: number | string | null): number => typeof value === 'number' ? value : Number(value ?? 0)

export function transactionRowToTransaction(row: TransactionRow): Transaction {
  let id = 0
  for (const character of row.id.replace(/-/g, '').slice(0, 12)) id = (id * 16 + Number.parseInt(character, 16)) % 2147483647
  return { id, type: row.type, symbol: row.symbol ?? '', date: row.transaction_date, shares: toNumber(row.shares), amount: toNumber(row.amount), price: toNumber(row.price), fees: toNumber(row.fees) }
}

export function transactionToRow(transaction: Transaction, workspaceId: string, userId: string) {
  return { workspace_id: workspaceId, user_id: userId, type: transaction.type, symbol: transaction.symbol || null, transaction_date: transaction.date, shares: transaction.shares, amount: transaction.amount, price: transaction.price, fees: transaction.fees }
}

async function currentUser(): Promise<WorkspaceResult<User>> {
  const client = configuredClient()
  if (!client) return errorResult(null as never, 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  const { data, error } = await client.auth.getUser()
  if (error) return { data: null as never, error }
  return data.user ? { data: data.user, error: null } : errorResult(null as never, 'You must be authenticated to access workspace data.')
}

export async function findOrCreatePersonalWorkspace(): Promise<WorkspaceResult<Workspace | null>> {
  const user = await currentUser()
  if (user.error) return { data: null, error: user.error }
  const client = configuredClient()!
  const existing = await client.from('workspaces').select('id,name,owner_id').eq('owner_id', user.data.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (existing.error) return { data: null, error: existing.error }
  let workspace = existing.data as WorkspaceRow | null
  if (!workspace) {
    const created = await client.from('workspaces').insert({ name: 'Personal workspace', owner_id: user.data.id }).select('id,name,owner_id').single()
    if (created.error) return { data: null, error: created.error }
    workspace = created.data as WorkspaceRow
    const member = await client.from('workspace_members').insert({ workspace_id: workspace.id, user_id: user.data.id, role: 'owner' })
    if (member.error) return { data: null, error: new Error(`Workspace created but membership setup failed: ${member.error.message}`) }
  }
  return { data: { id: workspace.id, name: workspace.name, ownerId: workspace.owner_id }, error: null }
}

export async function loadWorkspaceTransactions(workspaceId: string): Promise<WorkspaceResult<Transaction[]>> {
  const user = await currentUser()
  if (user.error) return { data: [], error: user.error }
  const result = await configuredClient()!.from('transactions').select('id,type,symbol,transaction_date,shares,amount,price,fees').eq('workspace_id', workspaceId).eq('user_id', user.data.id).order('transaction_date', { ascending: true })
  if (result.error) return { data: [], error: result.error }
  return { data: ((result.data ?? []) as TransactionRow[]).map(transactionRowToTransaction), error: null }
}

export async function replaceWorkspaceTransactions(workspaceId: string, transactions: Transaction[]): Promise<WorkspaceResult<Transaction[]>> {
  const user = await currentUser()
  if (user.error) return { data: [], error: user.error }
  try {
    parseTransactions(JSON.stringify({ transactions }))
  } catch (error) {
    return errorResult([], error instanceof Error ? error.message : 'Transactions failed validation.')
  }
  const client = configuredClient()!
  const deleted = await client.from('transactions').delete().eq('workspace_id', workspaceId).eq('user_id', user.data.id)
  if (deleted.error) return { data: [], error: new Error(`Could not replace workspace transactions: ${deleted.error.message}`) }
  if (transactions.length === 0) return { data: [], error: null }
  const inserted = await client.from('transactions').insert(transactions.map((transaction) => transactionToRow(transaction, workspaceId, user.data.id))).select('id,type,symbol,transaction_date,shares,amount,price,fees')
  if (inserted.error) return { data: [], error: new Error(`Transactions were removed but could not be re-imported: ${inserted.error.message}`) }
  return { data: ((inserted.data ?? []) as TransactionRow[]).map(transactionRowToTransaction), error: null }
}

export async function loadWatchlistSymbols(workspaceId: string): Promise<WorkspaceResult<string[]>> {
  const user = await currentUser()
  if (user.error) return { data: [], error: user.error }
  const lists = await configuredClient()!.from('watchlists').select('id,name').eq('workspace_id', workspaceId).eq('name', 'Default').limit(1).maybeSingle()
  if (lists.error) return { data: [], error: lists.error }
  if (!lists.data) return { data: [], error: null }
  const items = await configuredClient()!.from('watchlist_items').select('symbol').eq('watchlist_id', (lists.data as WatchlistRow).id).order('created_at', { ascending: true })
  return items.error ? { data: [], error: items.error } : { data: ((items.data ?? []) as WatchlistItemRow[]).map((item) => item.symbol), error: null }
}

export async function saveWatchlistSymbols(workspaceId: string, symbols: string[]): Promise<WorkspaceResult<string[]>> {
  const user = await currentUser()
  if (user.error) return { data: [], error: user.error }
  const client = configuredClient()!
  const list = await client.from('watchlists').upsert({ workspace_id: workspaceId, name: 'Default' }, { onConflict: 'workspace_id,name' }).select('id').single()
  if (list.error) return { data: [], error: list.error }
  const watchlistId = (list.data as { id: string }).id
  const removed = await client.from('watchlist_items').delete().eq('watchlist_id', watchlistId)
  if (removed.error) return { data: [], error: removed.error }
  const normalized = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))]
  if (normalized.length) {
    const inserted = await client.from('watchlist_items').insert(normalized.map((symbol) => ({ watchlist_id: watchlistId, symbol })))
    if (inserted.error) return { data: [], error: inserted.error }
  }
  return { data: normalized, error: null }
}

export async function addWorkspaceTransaction(workspaceId: string, transaction: Transaction): Promise<WorkspaceResult<Transaction>> {
  const user = await currentUser()
  if (user.error) return { data: null as never, error: user.error }
  const result = await configuredClient()!.from('transactions').insert(transactionToRow(transaction, workspaceId, user.data.id)).select('id,type,symbol,transaction_date,shares,amount,price,fees').single()
  if (result.error) return { data: null as never, error: result.error }
  return { data: transactionRowToTransaction(result.data as TransactionRow), error: null }
}

export async function deleteWorkspaceTransaction(workspaceId: string, transactionId: number): Promise<WorkspaceResult<null>> {
  const user = await currentUser()
  if (user.error) return { data: null, error: user.error }
  const client = configuredClient()!
  const result = await client.from('transactions').select('id,type,symbol,transaction_date,shares,amount,price,fees').eq('workspace_id', workspaceId).eq('user_id', user.data.id)
  if (result.error) return { data: null, error: result.error }
  const row = (result.data as TransactionRow[]).find((candidate) => transactionRowToTransaction(candidate).id === transactionId)
  if (!row) return { data: null, error: new Error('Could not find that remote transaction.') }
  const deleted = await client.from('transactions').delete().eq('id', row.id).eq('workspace_id', workspaceId).eq('user_id', user.data.id)
  return deleted.error ? { data: null, error: deleted.error } : { data: null, error: null }
}