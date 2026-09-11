import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { calculateReturns, parseTransactions, serializeTransactions, validateTransaction } from './portfolio'
import type { Transaction, TransactionType } from './portfolio'
import { getDemoPriceSnapshots } from './marketData'
import { buildInsights, calculateAllocation } from './insights'
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

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : initialTransactions
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('Overview')
  const [errors, setErrors] = useState<string[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem(watchlistStorageKey)
    return saved ? JSON.parse(saved) : defaultWatchlist
  })
  const [watchlistInput, setWatchlistInput] = useState('')
  const [backupError, setBackupError] = useState('')
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

  const addTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const type = String(form.get('type')) as TransactionType
    const draft = { type, symbol: String(form.get('symbol') || '').trim().toUpperCase(), date: String(form.get('date') || ''), shares: Number(form.get('shares') || 0), amount: Number(form.get('amount') || 0), price: Number(form.get('price') || 0), fees: Number(form.get('fees') || 0) }
    const nextErrors = validateTransaction(draft, transactions)
    if (nextErrors.length) { setErrors(nextErrors); return }
    setTransactions((current) => [...current, { id: Date.now(), ...draft, amount: draft.amount || draft.shares * draft.price }])
    setErrors([])
    setIsModalOpen(false)
  }

  const removeTransaction = (id: number) => {
    if (window.confirm('Delete this transaction? This cannot be undone.')) setTransactions((current) => current.filter((transaction) => transaction.id !== id))
  }

  const addWatchlistSymbol = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const symbol = watchlistInput.trim().toUpperCase()
    if (!symbol || watchlist.includes(symbol)) return
    setWatchlist((current) => [...current, symbol])
    setWatchlistInput('')
  }

  const asOf = priceSnapshots.AAPL.asOf ? new Date(priceSnapshots.AAPL.asOf).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown'

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand"><span className="brand-mark">R</span><span>returns<span className="brand-accent">/</span>cockpit</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{['Overview', 'Portfolio', 'Watchlist', 'Activity'].map((item) => <button className={activeNav === item ? 'nav-item active' : 'nav-item'} type="button" key={item} onClick={() => setActiveNav(item)}><span className="nav-icon">Gùê</span>{item}</button>)}</nav>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="mobile-brand">returns<span>/</span>cockpit</div><div className="breadcrumb">Workspace <span>/</span> {activeNav}</div><div className="top-actions"><span className="live-dot">GùÅ Demo prices</span><button className="icon-button" aria-label="Notifications" type="button">GÖó</button><button className="avatar avatar-small" aria-label="Open profile menu" type="button">JM</button></div></header>
        <div className={`page-content view-${activeNav.toLowerCase()}`}>
          <section className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} <span className="market-status">GùÅ Sample data</span></p><h1>Good morning, Jordan.</h1><p className="muted">Here is your portfolio at a glance.</p><p className="price-note">Prices are demo/static values, as of {asOf}.</p></div><button className="primary-button" type="button" onClick={() => { setErrors([]); setIsModalOpen(true) }}><span>+</span> Add transaction</button></section>
          {activeNav === 'Overview' && <section className="metric-grid" aria-label="Portfolio summary"><article className="metric-card featured"><p>Portfolio value <span className="trend">Gåù</span></p><strong>{money(summary.marketValue)}</strong><span className="metric-foot positive-text">{signedMoney(summary.totalReturn)} <small>total return</small></span></article><article className="metric-card"><p>Total return</p><strong className="teal-text">{signedMoney(summary.totalReturn)}</strong><span className="metric-foot">Realized + unrealized + dividends</span></article><article className="metric-card"><p>Unrealized P/L</p><strong>{signedMoney(summary.unrealized)}</strong><span className="metric-foot">Across open positions</span></article><article className="metric-card"><p>Realized P/L</p><strong>{signedMoney(summary.realized)}</strong><span className="metric-foot">Closed positions</span></article></section>}
          {activeNav === 'Overview' && <>
          <section className="panel insight-panel"><div className="panel-heading"><div><p className="eyebrow">EDUCATIONAL VIEW</p><h2>Portfolio insights</h2></div><span className="panel-note">Observations, not recommendations</span></div><div className="insight-grid">{insights.map((insight) => <article className={`insight-card ${insight.severity}`} key={`${insight.category}-${insight.title}`}><span className="insight-label">{insight.category}</span><strong>{insight.title}</strong><p>{insight.explanation}</p><small>{insight.input}: {insight.category === 'concentration' ? `${(insight.value * 100).toFixed(1)}%` : money(insight.value)}</small></article>)}</div><div className="allocation-list"><strong>Allocation by current market value</strong>{allocation.map((item) => <div className="allocation-row" key={item.symbol}><span><i style={{ background: colors[item.symbol] || '#7fc2ae' }} />{item.symbol}</span><span>{(item.percentage * 100).toFixed(1)}% -+ {money(item.marketValue)}</span></div>)}</div></section>
          <section className="panel holdings-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR POSITIONS</p><h2>Current holdings</h2></div><span className="panel-note">{summary.holdings.length} positions</span></div><div className="table-wrap"><table><thead><tr><th>Company</th><th>Shares</th><th>Avg. cost</th><th>Market value</th><th>Unrealized</th></tr></thead><tbody>{summary.holdings.map((holding) => <tr key={holding.symbol}><td><span className="stock-dot" style={{ background: colors[holding.symbol] || '#7fc2ae' }}>{holding.symbol.slice(0, 1)}</span><strong>{holding.symbol}</strong><small>{names[holding.symbol] || `${holding.symbol} position`}</small></td><td>{holding.shares.toLocaleString()} shares</td><td>{money(holding.averageCost)}</td><td><strong>{money(holding.marketValue)}</strong></td><td className={holding.unrealized >= 0 ? 'positive-text' : 'negative-text'}>{signedMoney(holding.unrealized)}</td></tr>)}</tbody></table></div></section>
          <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">LEDGER</p><h2>Recent activity</h2></div><span className="panel-note">{transactions.length} transactions</span></div><div className="activity-list">{[...transactions].reverse().slice(0, 5).map((transaction) => <div className="activity-row" key={transaction.id}><span className="activity-icon">{transaction.type === 'buy' ? 'Gåù' : transaction.type === 'sell' ? 'Gåÿ' : '$'}</span><span><strong>{transaction.type[0].toUpperCase() + transaction.type.slice(1)} {transaction.symbol && `-+ ${transaction.symbol}`}</strong><small>{dateLabel(transaction.date)}</small></span><strong>{transaction.type === 'buy' || transaction.type === 'sell' ? `${transaction.shares} shares` : money(transaction.amount)}</strong><button className="delete-button" type="button" onClick={() => removeTransaction(transaction.id)} aria-label={`Delete ${transaction.type} transaction`}>+ù</button></div>)}</div></section>
          </>}
          {activeNav === 'Portfolio' && <section className="panel view-panel"><div className="panel-heading"><div><p className="eyebrow">PORTFOLIO</p><h2>Holdings and allocation</h2></div><span className="panel-note">{summary.holdings.length} positions</span></div><div className="allocation-list">{allocation.map((item) => <div className="allocation-row" key={item.symbol}><span><i style={{ background: colors[item.symbol] || '#7fc2ae' }} />{item.symbol} - {names[item.symbol] || 'Position'}</span><span>{(item.percentage * 100).toFixed(1)}% - {money(item.marketValue)}</span></div>)}</div><div className="table-wrap"><table><thead><tr><th>Symbol</th><th>Shares</th><th>Market value</th><th>Unrealized</th></tr></thead><tbody>{summary.holdings.map((holding) => <tr key={holding.symbol}><td><strong>{holding.symbol}</strong></td><td>{holding.shares.toLocaleString()}</td><td>{money(holding.marketValue)}</td><td className={holding.unrealized >= 0 ? 'positive-text' : 'negative-text'}>{signedMoney(holding.unrealized)}</td></tr>)}</tbody></table></div></section>}
          {activeNav === 'Watchlist' && <section className="panel view-panel"><div className="panel-heading"><div><p className="eyebrow">WATCHLIST</p><h2>Symbols to watch</h2></div><span className="panel-note">{watchlist.length} symbols</span></div><form onSubmit={addWatchlistSymbol}><label>Ticker<input value={watchlistInput} onChange={(event) => setWatchlistInput(event.target.value)} placeholder="Add symbol" /></label><button className="primary-button" type="submit">Add to watchlist</button></form><div className="activity-list">{watchlist.map((symbol) => <div className="activity-row" key={symbol}><span className="stock-dot" style={{ background: colors[symbol] || '#7fc2ae' }}>{symbol.slice(0, 1)}</span><span><strong>{symbol}</strong><small>{names[symbol] || 'Market symbol'}</small></span><button className="delete-button" type="button" onClick={() => setWatchlist((current) => current.filter((item) => item !== symbol))} aria-label={`Remove ${symbol} from watchlist`}>+ù</button></div>)}</div></section>}
          {activeNav === 'Activity' && <section className="panel view-panel"><div className="panel-heading"><div><p className="eyebrow">FULL LEDGER</p><h2>Transaction activity</h2></div><span className="panel-note">{transactions.length} transactions</span></div><div className="top-actions"><button className="secondary-button" type="button" onClick={exportLedger}>Export JSON</button><label className="secondary-button">Import JSON<input type="file" accept="application/json,.json" onChange={importLedger} hidden /></label></div>{backupError && <p className="muted" role="status">{backupError}</p>}<div className="activity-list">{[...transactions].reverse().map((transaction) => <div className="activity-row" key={transaction.id}><span className="activity-icon">{transaction.type === 'buy' ? 'Gåù' : transaction.type === 'sell' ? 'Gåÿ' : '$'}</span><span><strong>{transaction.type[0].toUpperCase() + transaction.type.slice(1)} {transaction.symbol && `-+ ${transaction.symbol}`}</strong><small>{dateLabel(transaction.date)}</small></span><strong>{transaction.type === 'buy' || transaction.type === 'sell' ? `${transaction.shares} shares` : money(transaction.amount)}</strong><button className="delete-button" type="button" onClick={() => removeTransaction(transaction.id)} aria-label={`Delete ${transaction.type} transaction`}>+ù</button></div>)}</div></section>}
        </div>
      </main>
      {isModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsModalOpen(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title"><div className="modal-heading"><div><p className="eyebrow">PORTFOLIO LEDGER</p><h2 id="transaction-title">Add transaction</h2></div><button type="button" className="close-button" aria-label="Close dialog" onClick={() => setIsModalOpen(false)}>+ù</button></div>{errors.length > 0 && <div className="form-errors" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<form onSubmit={addTransaction}><label>Type<select name="type" defaultValue="buy"><option value="buy">Buy</option><option value="sell">Sell</option><option value="dividend">Dividend</option><option value="fee">Fee</option><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></label><label>Ticker<input name="symbol" placeholder="AAPL" /></label><label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Shares<input name="shares" type="number" min="0" step="any" placeholder="10" /></label><label>Price per share<input name="price" type="number" min="0" step="any" placeholder="195.64" /></label><label>Amount<input name="amount" type="number" min="0" step="any" placeholder="Optional total" /></label><label>Fees<input name="fees" type="number" min="0" step="any" defaultValue="0" /></label><button className="primary-button modal-submit" type="submit">Save transaction</button></form></section></div>}
    </div>
  )
}

export default App
