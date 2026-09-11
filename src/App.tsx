import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { calculateReturns, parseTransactions, serializeTransactions, validateTransaction } from './portfolio'
import type { Transaction, TransactionType } from './portfolio'
import { getDemoPriceSnapshots } from './marketData'
import { buildInsights, calculateAllocation } from './insights'
import { getCurrentSession, signInWithEmail, signOut, signUpWithEmail } from './auth'
import { isSupabaseConfigured, supabase } from './supabase'
import { addWorkspaceTransaction, deleteWorkspaceTransaction, findOrCreatePersonalWorkspace, loadWatchlistSymbols, loadWorkspaceTransactions, saveWatchlistSymbols } from './workspaceData'
import type { Session } from '@supabase/supabase-js'
import './App.css'

const names: Record<string, string> = { NVDA: 'NVIDIA Corporation', AAPL: 'Apple Inc.', MSFT: 'Microsoft Corporation', AMZN: 'Amazon.com Inc.' }
const colors: Record<string, string> = { NVDA: '#78b9a4', AAPL: '#e87c62', MSFT: '#6d95c8', AMZN: '#e4b56b' }
const storageKey = 'returns-cockpit.transactions.v1'
const watchlistStorageKey = 'returns-cockpit.watchlist.v1'
const defaultWatchlist = ['TSLA', 'GOOGL', 'V']
const initialTransactions: Transaction[] = [
  { id: 1, type: 'buy', symbol: 'NVDA', date: '2025-08-12', shares: 24, amount: 2670, price: 111.25, fees: 0 },
  { id: 2, type: 'buy', symbol: 'AAPL', date: '2025-07-25', shares: 18, amount: 3420, price: 190, fees: 0 },
  { id: 3, type: 'buy', symbol: 'MSFT', date: '2025-06-18', shares: 12, amount: 5100, price: 425, fees: 0 },
  { id: 4, type: 'buy', symbol: 'AMZN', date: '2025-08-30', shares: 20, amount: 3900, price: 195, fees: 0 },
  { id: 5, type: 'dividend', symbol: 'AAPL', date: '2025-09-10', shares: 0, amount: 18.4, price: 0, fees: 0 },
]
const money = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signedMoney = (value: number) => `${value >= 0 ? '+' : '-'}${money(Math.abs(value))}`
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function AuthScreen({ initialError = '' }: { initialError?: string }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(initialError ? { type: 'error', message: initialError } : null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setIsSubmitting(true)
    const result = mode === 'sign-in' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password)
    setIsSubmitting(false)
    if (result.error) {
      setStatus({ type: 'error', message: result.error.message })
      return
    }
    if (mode === 'sign-up' && !result.data.session) setStatus({ type: 'success', message: 'Account created. Check your email to confirm your account.' })
  }

  return <main className="auth-shell"><section className="auth-card" aria-labelledby="auth-title"><div className="brand auth-brand"><span className="brand-mark">R</span><span>returns<span className="brand-accent">/</span>cockpit</span></div><p className="eyebrow">YOUR PORTFOLIO, CLEARLY</p><h1 id="auth-title">{mode === 'sign-in' ? 'Welcome back.' : 'Create your account.'}</h1><p className="auth-copy">{mode === 'sign-in' ? 'Sign in to continue to your returns cockpit.' : 'Start keeping a clear view of your portfolio.'}</p><div className="auth-toggle" role="group" aria-label="Authentication mode"><button type="button" className={mode === 'sign-in' ? 'active' : ''} onClick={() => { setMode('sign-in'); setStatus(null) }}>Sign in</button><button type="button" className={mode === 'sign-up' ? 'active' : ''} onClick={() => { setMode('sign-up'); setStatus(null) }}>Sign up</button></div><form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={6} required /></label>{status && <p className={`auth-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.message}</p>}<button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button></form></section></main>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let mounted = true
    getCurrentSession().then((result) => {
      if (!mounted) return
      setSession(result.data.session)
      if (result.error) setAuthError(result.error.message)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : initialTransactions
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const addTransactionButtonRef = useRef<HTMLButtonElement>(null)
  const transactionTypeRef = useRef<HTMLSelectElement>(null)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [activeNav, setActiveNav] = useState('Overview')
  const [errors, setErrors] = useState<string[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem(watchlistStorageKey)
    return saved ? JSON.parse(saved) : defaultWatchlist
  })
  const [watchlistInput, setWatchlistInput] = useState('')
  const [backupError, setBackupError] = useState('')
  const closeTransactionModal = () => {
    setIsModalOpen(false)
    setErrors([])
    addTransactionButtonRef.current?.focus()
  }
  const closeDeleteDialog = () => {
    setTransactionToDelete(null)
    deleteTriggerRef.current?.focus()
  }
  useEffect(() => {
    if (!isModalOpen) return
    transactionTypeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeTransactionModal() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])
  useEffect(() => {
    if (!transactionToDelete) return
    deleteCancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDeleteDialog() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [transactionToDelete])
  useEffect(() => {
    if (!isSupabaseConfigured || !session) return
    let active = true
    findOrCreatePersonalWorkspace().then(async (workspaceResult) => {
      if (!active) return
      setDataLoading(true)
      if (workspaceResult.error || !workspaceResult.data) {
        setDataError(workspaceResult.error?.message || 'Could not open your workspace.')
        setDataLoading(false)
        return
      }
      const [transactionsResult, watchlistResult] = await Promise.all([loadWorkspaceTransactions(workspaceResult.data.id), loadWatchlistSymbols(workspaceResult.data.id)])
      if (!active) return
      if (transactionsResult.error || watchlistResult.error) {
        setDataError(transactionsResult.error?.message || watchlistResult.error?.message || 'Could not load your workspace data.')
        setDataLoading(false)
        return
      }
      setWorkspaceId(workspaceResult.data.id)
      setTransactions(transactionsResult.data)
      setWatchlist(watchlistResult.data)
      setDataLoading(false)
    })
    return () => { active = false }
  }, [session])
  const priceSnapshots = getDemoPriceSnapshots()
  const summary = calculateReturns(transactions, priceSnapshots)
  const allocation = calculateAllocation(summary.holdings)
  const insights = buildInsights(summary.holdings, { realized: summary.realized, unrealized: summary.unrealized, dividends: summary.dividends })

  useEffect(() => { localStorage.setItem('returns-cockpit.transactions.v1', JSON.stringify(transactions)) }, [transactions])
  useEffect(() => { localStorage.setItem(watchlistStorageKey, JSON.stringify(watchlist)) }, [watchlist])

  const exportLedger = () => {
    const blob = new Blob([serializeTransactions(transactions)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'returns-cockpit-transactions.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importLedger = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseTransactions(await file.text())
      setTransactions(imported)
      setBackupError('Ledger imported successfully.')
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not import this ledger.')
    }
  }

  const addTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const type = String(form.get('type')) as TransactionType
    const draft = { type, symbol: String(form.get('symbol') || '').trim().toUpperCase(), date: String(form.get('date') || ''), shares: Number(form.get('shares') || 0), amount: Number(form.get('amount') || 0), price: Number(form.get('price') || 0), fees: Number(form.get('fees') || 0) }
    const nextErrors = validateTransaction(draft, transactions)
    if (nextErrors.length) { setErrors(nextErrors); return }
    const transaction = { id: Date.now(), ...draft, amount: draft.amount || draft.shares * draft.price }
    if (session && workspaceId) {
      const result = await addWorkspaceTransaction(workspaceId, transaction)
      if (result.error) { setDataError(`Could not save transaction: ${result.error.message}`); return }
      setTransactions((current) => [...current, result.data])
    } else setTransactions((current) => [...current, transaction])
    setErrors([])
    closeTransactionModal()
  }

  const removeTransaction = async () => {
    if (!transactionToDelete) return
    const id = transactionToDelete.id
    if (session && workspaceId) {
      const result = await deleteWorkspaceTransaction(workspaceId, id)
      if (result.error) { setDataError(`Could not delete transaction: ${result.error.message}`); return }
    }
    setTransactions((current) => current.filter((transaction) => transaction.id !== id))
    closeDeleteDialog()
  }

  const addWatchlistSymbol = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const symbol = watchlistInput.trim().toUpperCase()
    if (!symbol || watchlist.includes(symbol)) return
    const next = [...watchlist, symbol]
    if (session && workspaceId) {
      const result = await saveWatchlistSymbols(workspaceId, next)
      if (result.error) { setDataError(`Could not save watchlist: ${result.error.message}`); return }
    }
    setWatchlist(next)
    setWatchlistInput('')
  }

  const handleSignOut = async () => {
    const result = await signOut()
    if (result.error) setAuthError(result.error.message)
  }

  const asOf = priceSnapshots.AAPL.asOf ? new Date(priceSnapshots.AAPL.asOf).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown'

  if (isSupabaseConfigured && authLoading) return <main className="auth-shell"><div className="auth-loading" role="status">Checking your session...</div></main>
  if (isSupabaseConfigured && !session) return <AuthScreen initialError={authError} />
  if (isSupabaseConfigured && dataLoading) return <main className="auth-shell"><div className="auth-loading" role="status">Loading your workspace...</div></main>

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand"><span className="brand-mark">R</span><span>returns<span className="brand-accent">/</span>cockpit</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{['Overview', 'Portfolio', 'Watchlist', 'Activity'].map((item) => <button className={activeNav === item ? 'nav-item active' : 'nav-item'} type="button" key={item} onClick={() => setActiveNav(item)}><span className="nav-icon" aria-hidden="true">{item[0]}</span>{item}</button>)}</nav>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="mobile-brand">returns<span>/</span>cockpit</div><div className="breadcrumb">Workspace <span>/</span> {activeNav}</div><div className="top-actions"><span className="workspace-status">{isSupabaseConfigured ? 'Signed in workspace' : 'Local demo workspace'}</span>{session && <><span className="account-email">{session.user.email}</span><button className="secondary-button sign-out-button" type="button" onClick={handleSignOut}>Sign out</button></> }<button className="icon-button" aria-label="Notifications" type="button">!</button><button className="avatar avatar-small" aria-label="Open profile menu" type="button">JM</button></div></header>
        {(authError || dataError) && <p className="auth-inline-error" role="alert">{authError || dataError}</p>}
        <div className={`page-content view-${activeNav.toLowerCase()}`}>
          <section className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} <span className="market-status">Demo prices - sample data</span></p><h1>Good morning, Jordan.</h1><p className="muted">Here is your portfolio at a glance.</p><p className="price-note">Prices are demo values from the local sample provider, as of {asOf}.</p></div><button ref={addTransactionButtonRef} className="primary-button" type="button" onClick={() => { setErrors([]); setIsModalOpen(true) }}><span aria-hidden="true">+</span> Add transaction</button></section>
          {activeNav === 'Overview' && <section className="metric-grid" aria-label="Portfolio summary"><article className="metric-card featured"><p>Portfolio value <span className="trend">+</span></p><strong>{money(summary.marketValue)}</strong><span className="metric-foot positive-text">{signedMoney(summary.totalReturn)} <small>total return</small></span></article><article className="metric-card"><p>Total return</p><strong className="teal-text">{signedMoney(summary.totalReturn)}</strong><span className="metric-foot">Realized + unrealized + dividends</span></article><article className="metric-card"><p>Unrealized P/L</p><strong>{signedMoney(summary.unrealized)}</strong><span className="metric-foot">Across open positions</span></article><article className="metric-card"><p>Realized P/L</p><strong>{signedMoney(summary.realized)}</strong><span className="metric-foot">Closed positions</span></article></section>}
          {activeNav === 'Overview' && <>
          <section className="panel insight-panel"><div className="panel-heading"><div><p className="eyebrow">EDUCATIONAL VIEW</p><h2>Portfolio insights</h2></div><span className="panel-note">Observations, not recommendations</span></div><div className="insight-grid">{insights.map((insight) => <article className={`insight-card ${insight.severity}`} key={`${insight.category}-${insight.title}`}><span className="insight-label">{insight.category}</span><strong>{insight.title}</strong><p>{insight.explanation}</p><small>{insight.input}: {insight.category === 'concentration' ? `${(insight.value * 100).toFixed(1)}%` : money(insight.value)}</small></article>)}</div><div className="allocation-list"><strong>Allocation by current market value</strong>{allocation.map((item) => <div className="allocation-row" key={item.symbol}><span><i style={{ background: colors[item.symbol] || '#7fc2ae' }} />{item.symbol}</span><span>{(item.percentage * 100).toFixed(1)}% - {money(item.marketValue)}</span></div>)}</div></section>
          <section className="panel holdings-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR POSITIONS</p><h2>Current holdings</h2></div><span className="panel-note">{summary.holdings.length} positions</span></div><div className="table-wrap"><table><thead><tr><th>Company</th><th>Shares</th><th>Avg. cost</th><th>Market value</th><th>Unrealized</th></tr></thead><tbody>{summary.holdings.map((holding) => <tr key={holding.symbol}><td><span className="stock-dot" style={{ background: colors[holding.symbol] || '#7fc2ae' }}>{holding.symbol.slice(0, 1)}</span><strong>{holding.symbol}</strong><small>{names[holding.symbol] || `${holding.symbol} position`}</small></td><td>{holding.shares.toLocaleString()} shares</td><td>{money(holding.averageCost)}</td><td><strong>{money(holding.marketValue)}</strong></td><td className={holding.unrealized >= 0 ? 'positive-text' : 'negative-text'}>{signedMoney(holding.unrealized)}</td></tr>)}</tbody></table></div></section>
          <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">LEDGER</p><h2>Recent activity</h2></div><span className="panel-note">{transactions.length} transactions</span></div><div className="activity-list">{[...transactions].reverse().slice(0, 5).map((transaction) => <div className="activity-row" key={transaction.id}><span className="activity-icon">{transaction.type === 'buy' ? '+' : transaction.type === 'sell' ? '-' : '$'}</span><span><strong>{transaction.type[0].toUpperCase() + transaction.type.slice(1)} {transaction.symbol && `- ${transaction.symbol}`}</strong><small>{dateLabel(transaction.date)}</small></span><strong>{transaction.type === 'buy' || transaction.type === 'sell' ? `${transaction.shares} shares` : money(transaction.amount)}</strong><button className="delete-button" type="button" onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setTransactionToDelete(transaction) }} aria-label={`Delete ${transaction.type} transaction`}>x</button></div>)}</div></section>
          </>}
          {activeNav === 'Portfolio' && <section className="panel view-panel"><div className="panel-heading"><div><p className="eyebrow">PORTFOLIO</p><h2>Holdings and allocation</h2></div><span className="panel-note">{summary.holdings.length} positions</span></div><div className="allocation-list">{allocation.map((item) => <div className="allocation-row" key={item.symbol}><span><i style={{ background: colors[item.symbol] || '#7fc2ae' }} />{item.symbol} - {names[item.symbol] || 'Position'}</span><span>{(item.percentage * 100).toFixed(1)}% - {money(item.marketValue)}</span></div>)}</div><div className="table-wrap"><table><thead><tr><th>Symbol</th><th>Shares</th><th>Market value</th><th>Unrealized</th></tr></thead><tbody>{summary.holdings.map((holding) => <tr key={holding.symbol}><td><strong>{holding.symbol}</strong></td><td>{holding.shares.toLocaleString()}</td><td>{money(holding.marketValue)}</td><td className={holding.unrealized >= 0 ? 'positive-text' : 'negative-text'}>{signedMoney(holding.unrealized)}</td></tr>)}</tbody></table></div></section>}
          {activeNav === 'Watchlist' && <section className="panel view-panel"><div className="panel-heading"><div><p className="eyebrow">WATCHLIST</p><h2>Symbols to watch</h2></div><span className="panel-note">{watchlist.length} symbols</span></div><form onSubmit={addWatchlistSymbol}><label>Ticker<input value={watchlistInput} onChange={(event) => setWatchlistInput(event.target.value)} placeholder="Add symbol" /></label><button className="primary-button" type="submit">Add to watchlist</button></form><div className="activity-list">{watchlist.map((symbol) => <div className="activity-row" key={symbol}><span className="stock-dot" style={{ background: colors[symbol] || '#7fc2ae' }}>{symbol.slice(0, 1)}</span><span><strong>{symbol}</strong><small>{names[symbol] || 'Market symbol'}</small></span><button className="delete-button" type="button" onClick={async () => { const next = watchlist.filter((item) => item !== symbol); if (session && workspaceId) { const result = await saveWatchlistSymbols(workspaceId, next); if (result.error) { setDataError(`Could not save watchlist: ${result.error.message}`); return } } setWatchlist(next) }} aria-label={`Remove ${symbol} from watchlist`}>x</button></div>)}</div></section>}
          {activeNav === 'Activity' && <section className="panel view-panel"><div className="panel-heading"><div><p className="eyebrow">FULL LEDGER</p><h2>Transaction activity</h2></div><span className="panel-note">{transactions.length} transactions</span></div><div className="top-actions"><button className="secondary-button" type="button" onClick={exportLedger}>Export JSON</button><label className="secondary-button">Import JSON<input type="file" accept="application/json,.json" onChange={importLedger} hidden /></label></div>{backupError && <p className="muted" role="status">{backupError}</p>}<div className="activity-list">{[...transactions].reverse().map((transaction) => <div className="activity-row" key={transaction.id}><span className="activity-icon">{transaction.type === 'buy' ? '+' : transaction.type === 'sell' ? '-' : '$'}</span><span><strong>{transaction.type[0].toUpperCase() + transaction.type.slice(1)} {transaction.symbol && `- ${transaction.symbol}`}</strong><small>{dateLabel(transaction.date)}</small></span><strong>{transaction.type === 'buy' || transaction.type === 'sell' ? `${transaction.shares} shares` : money(transaction.amount)}</strong><button className="delete-button" type="button" onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setTransactionToDelete(transaction) }} aria-label={`Delete ${transaction.type} transaction`}>x</button></div>)}</div></section>}
        </div>
      </main>
      {isModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeTransactionModal() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title"><div className="modal-heading"><div><p className="eyebrow">PORTFOLIO LEDGER</p><h2 id="transaction-title">Add transaction</h2></div><button type="button" className="close-button" aria-label="Close dialog" onClick={closeTransactionModal}>x</button></div>{errors.length > 0 && <div className="form-errors" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<form onSubmit={addTransaction}><label>Type<select ref={transactionTypeRef} name="type" defaultValue="buy"><option value="buy">Buy</option><option value="sell">Sell</option><option value="dividend">Dividend</option><option value="fee">Fee</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></label><p className="muted">Buy and sell use shares and price. Cash events use amount.</p><label>Ticker<input name="symbol" placeholder="AAPL" /></label><label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Shares<input name="shares" type="number" min="0" step="any" placeholder="10" /></label><label>Price per share<input name="price" type="number" min="0" step="any" placeholder="195.64" /></label><label>Amount<input name="amount" type="number" min="0" step="any" placeholder="Optional total" /></label><label>Fees<input name="fees" type="number" min="0" step="any" defaultValue="0" /></label><button className="primary-button modal-submit" type="submit">Save transaction</button></form></section></div>}
      {transactionToDelete && <div className="modal-backdrop" role="presentation"><section className="modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><p className="eyebrow">PORTFOLIO LEDGER</p><h2 id="delete-title">Delete transaction?</h2><p id="delete-description" className="confirm-copy">Delete the {transactionToDelete.type} transaction{transactionToDelete.symbol && ` for ${transactionToDelete.symbol}`} dated {dateLabel(transactionToDelete.date)}. {transactionToDelete.type === 'buy' || transactionToDelete.type === 'sell' ? `${transactionToDelete.shares} shares at ${money(transactionToDelete.price)}` : money(transactionToDelete.amount)}. This cannot be undone.</p><div className="confirm-actions"><button ref={deleteCancelRef} className="secondary-button" type="button" onClick={closeDeleteDialog}>Cancel</button><button className="danger-button" type="button" onClick={removeTransaction}>Delete</button></div></section></div>}
    </div>
  )
}

export default App
