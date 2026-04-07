import { useCallback, useEffect, useMemo, useState } from 'react'
import { agentApi, marketApi } from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  BarChart3,
  Bot,
  ChevronRight,
  DollarSign,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const DEFAULT_FORM = {
  name: '',
  assets: 'BTC,GOLD',
  initial_capital: 10000,
  risk_per_trade: 0.02,
  max_open_trades: 5,
  notes: '',
}

const STATUS_STYLES = {
  running: 'bg-green-400/10 text-green-400 border border-green-400/20',
  paused: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20',
  stopped: 'bg-red-400/10 text-red-400 border border-red-400/20',
}

function formatMoney(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })
}

function formatPercent(value, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeAssets(rawAssets) {
  return rawAssets
    .split(',')
    .map(asset => asset.trim().toUpperCase())
    .filter(Boolean)
    .join(',')
}

function SessionStatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.paused}`}>
      {status}
    </span>
  )
}

function TradeStatusPill({ status }) {
  const className = status === 'open'
    ? 'border border-blue-400/20 bg-blue-400/10 text-blue-400'
    : 'border border-slate-500/20 bg-slate-500/10 text-slate-300'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  )
}

function MetricCard({ label, value, subtext, icon: Icon, tone = 'text-accent-blue' }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
        {Icon ? <Icon className={`h-4 w-4 ${tone}`} /> : null}
      </div>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-500">{subtext}</div>
    </div>
  )
}

function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div className="card flex min-h-[280px] flex-col items-center justify-center text-center">
      <Bot className="mb-4 h-12 w-12 text-gray-600" />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-gray-400">{body}</p>
      {actionLabel ? (
        <button onClick={onAction} className="btn-primary mt-6">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function CreateSessionModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM)
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    const created = await onCreate({
      ...form,
      assets: normalizeAssets(form.assets),
    })

    setSubmitting(false)
    if (created) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-surface-border bg-surface-card p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Create Agent Session</h2>
            <p className="mt-1 text-sm text-gray-400">
              Spin up a paper-trading session with a controlled risk budget and tracked equity curve.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-surface-hover hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Session Name</label>
            <input
              className="input mt-1"
              value={form.name}
              onChange={(event) => setForm(current => ({ ...current, name: event.target.value }))}
              placeholder="Macro swing basket"
              required
            />
          </div>

          <div>
            <label className="label">Assets</label>
            <input
              className="input mt-1"
              value={form.assets}
              onChange={(event) => setForm(current => ({ ...current, assets: event.target.value }))}
              placeholder="BTC,GOLD,TSLA"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated symbols, for example `BTC,GOLD,TSLA`.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Initial Capital</label>
              <input
                type="number"
                min="100"
                step="100"
                className="input mt-1"
                value={form.initial_capital}
                onChange={(event) => setForm(current => ({ ...current, initial_capital: Number(event.target.value) }))}
                required
              />
            </div>

            <div>
              <label className="label">Risk Per Trade</label>
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.1"
                className="input mt-1"
                value={form.risk_per_trade * 100}
                onChange={(event) => setForm(current => ({ ...current, risk_per_trade: Number(event.target.value) / 100 }))}
                required
              />
              <p className="mt-1 text-xs text-gray-500">Expressed as a percent of current capital.</p>
            </div>
          </div>

          <div>
            <label className="label">Max Open Trades</label>
            <input
              type="number"
              min="1"
              max="20"
              className="input mt-1"
              value={form.max_open_trades}
              onChange={(event) => setForm(current => ({ ...current, max_open_trades: Number(event.target.value) }))}
              required
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              rows={3}
              className="input mt-1 resize-none"
              value={form.notes}
              onChange={(event) => setForm(current => ({ ...current, notes: event.target.value }))}
              placeholder="Optional context for this strategy."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TradesTable({ trades, closingTradeId, onCloseTrade }) {
  if (!trades.length) {
    return <p className="py-10 text-center text-sm text-gray-500">No trades match this filter yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wider text-gray-500">
            <th className="px-2 py-3">Asset</th>
            <th className="px-2 py-3">Side</th>
            <th className="px-2 py-3 text-right">Entry</th>
            <th className="px-2 py-3 text-right">Exit</th>
            <th className="px-2 py-3 text-right">Quantity</th>
            <th className="px-2 py-3 text-right">P&L</th>
            <th className="px-2 py-3">Opened</th>
            <th className="px-2 py-3">Status</th>
            <th className="px-2 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const pnlClass =
              trade.pnl > 0 ? 'text-green-400' :
              trade.pnl < 0 ? 'text-red-400' :
              'text-gray-400'

            return (
              <tr key={trade.id} className="border-b border-surface-border/60 text-gray-300">
                <td className="px-2 py-3 font-medium text-white">{trade.asset}</td>
                <td className="px-2 py-3">
                  <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-3 text-right">{formatMoney(trade.entry_price)}</td>
                <td className="px-2 py-3 text-right">{trade.exit_price ? formatMoney(trade.exit_price) : '—'}</td>
                <td className="px-2 py-3 text-right">{trade.quantity?.toFixed(4) ?? '—'}</td>
                <td className={`px-2 py-3 text-right font-medium ${pnlClass}`}>
                  {trade.pnl == null ? '—' : formatMoney(trade.pnl)}
                </td>
                <td className="px-2 py-3 text-xs text-gray-500">{formatDate(trade.opened_at)}</td>
                <td className="px-2 py-3">
                  <TradeStatusPill status={trade.status} />
                </td>
                <td className="px-2 py-3">
                  {trade.status === 'open' ? (
                    <button
                      onClick={() => onCloseTrade(trade)}
                      disabled={closingTradeId === trade.id}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      {closingTradeId === trade.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                      Close
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">{trade.exit_reason || 'Closed'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SessionDetail({ sessionId, onBack, onSessionsChanged }) {
  const [session, setSession] = useState(null)
  const [stats, setStats] = useState(null)
  const [trades, setTrades] = useState([])
  const [equity, setEquity] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tradeFilter, setTradeFilter] = useState('all')
  const [runningCycle, setRunningCycle] = useState(false)
  const [actionName, setActionName] = useState('')
  const [closingTradeId, setClosingTradeId] = useState(null)
  const { addToast } = useToast()

  const loadSession = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)

    try {
      const tradeStatus = tradeFilter === 'all' ? undefined : tradeFilter
      const [sessionResponse, statsResponse, tradesResponse, equityResponse] = await Promise.all([
        agentApi.getSession(sessionId),
        agentApi.getStats(sessionId),
        agentApi.getTrades(sessionId, tradeStatus),
        agentApi.getEquity(sessionId),
      ])

      setSession(sessionResponse.data)
      setStats(statsResponse.data)
      setTrades(tradesResponse.data ?? [])
      setEquity(
        (equityResponse.data ?? []).map((point) => ({
          ...point,
          timestampLabel: formatDate(point.timestamp),
        }))
      )
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to load agent session', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast, sessionId, tradeFilter])

  useEffect(() => {
    loadSession(true)
  }, [loadSession])

  const syncParentSessions = async () => {
    if (onSessionsChanged) await onSessionsChanged()
  }

  const handleStatusChange = async (nextStatus) => {
    if (!session) return
    setActionName(nextStatus)
    try {
      await agentApi.updateSession(session.id, { status: nextStatus })
      await Promise.all([loadSession(), syncParentSessions()])
      addToast(`Session ${nextStatus}`, 'success')
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to update session', 'error')
    } finally {
      setActionName('')
    }
  }

  const handleRunCycle = async () => {
    if (!session) return
    setRunningCycle(true)
    try {
      const response = await agentApi.runCycle(session.id)
      const result = response.data ?? {}
      addToast(
        `Cycle complete: ${result.opened?.length || 0} opened, ${result.closed?.length || 0} closed`,
        'success'
      )
      await Promise.all([loadSession(), syncParentSessions()])
    } catch (error) {
      addToast(error.response?.data?.detail || 'Cycle failed', 'error')
    } finally {
      setRunningCycle(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!session) return
    if (!window.confirm(`Delete "${session.name}"? This removes the paper-trading session and its open positions.`)) {
      return
    }

    setActionName('delete')
    try {
      await agentApi.deleteSession(session.id)
      addToast('Session deleted', 'success')
      await syncParentSessions()
      onBack()
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to delete session', 'error')
    } finally {
      setActionName('')
    }
  }

  const handleCloseTrade = async (trade) => {
    if (!session) return
    setClosingTradeId(trade.id)
    try {
      const quoteResponse = await marketApi.getLiveQuote(trade.asset)
      await agentApi.closeTrade(session.id, trade.id, {
        exit_price: quoteResponse.data?.price,
      })
      addToast(`Closed ${trade.asset} at market`, 'success')
      await Promise.all([loadSession(), syncParentSessions()])
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to close trade', 'error')
    } finally {
      setClosingTradeId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return (
      <EmptyState
        title="Session unavailable"
        body="This session could not be loaded. It may have been deleted or the backend rejected the request."
        actionLabel="Back to sessions"
        onAction={onBack}
      />
    )
  }

  const sessionTone = stats?.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="border-b border-surface-border bg-gradient-to-r from-surface-card via-surface-hover to-surface-card px-5 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button onClick={onBack} className="btn-ghost mb-4 px-0 py-0 text-sm">
                ← Back to sessions
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-white">{session.name}</h1>
                <SessionStatusPill status={session.status} />
              </div>
              <p className="mt-2 max-w-2xl text-sm text-gray-400">
                Monitoring {session.assets} with {formatPercent(session.risk_per_trade * 100, 1)} risk per trade and up to {session.max_open_trades} concurrent positions.
              </p>
              {session.notes ? <p className="mt-3 text-sm text-gray-500">{session.notes}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button onClick={() => loadSession()} disabled={refreshing} className="btn-ghost">
                {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              {session.status === 'running' ? (
                <button onClick={() => handleStatusChange('paused')} disabled={actionName === 'paused'} className="btn-ghost">
                  {actionName === 'paused' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Pause
                </button>
              ) : (
                <button onClick={() => handleStatusChange('running')} disabled={actionName === 'running'} className="btn-primary">
                  {actionName === 'running' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {session.status === 'stopped' ? 'Restart' : 'Resume'}
                </button>
              )}
              {session.status !== 'stopped' ? (
                <button onClick={() => handleStatusChange('stopped')} disabled={actionName === 'stopped'} className="btn-ghost">
                  {actionName === 'stopped' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  Stop
                </button>
              ) : null}
              <button onClick={handleDeleteSession} disabled={actionName === 'delete'} className="btn-danger">
                {actionName === 'delete' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1.7fr,1fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Current Capital"
              value={formatMoney(stats?.current_capital)}
              subtext={`Started with ${formatMoney(session.initial_capital)}`}
              icon={DollarSign}
            />
            <MetricCard
              label="Total P&L"
              value={formatMoney(stats?.total_pnl)}
              subtext={`${stats?.total_trades ?? 0} closed trades recorded`}
              icon={stats?.total_pnl >= 0 ? TrendingUp : TrendingDown}
              tone={sessionTone}
            />
            <MetricCard
              label="Win Rate"
              value={formatPercent(stats?.win_rate, 1)}
              subtext={`${stats?.winners ?? 0} winners / ${stats?.losers ?? 0} losers`}
              icon={BarChart3}
            />
            <MetricCard
              label="Open Trades"
              value={stats?.open_trades ?? '—'}
              subtext={`Max open limit: ${session.max_open_trades}`}
              icon={Bot}
            />
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface px-4 py-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Cycle Controls</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Run Agent</h2>
              </div>
              <Bot className="h-5 w-5 text-accent-blue" />
            </div>
            <p className="text-sm text-gray-400">
              Manual runs trigger one decision cycle across all configured assets using the latest prediction and market data.
            </p>
            <button
              onClick={handleRunCycle}
              disabled={runningCycle || session.status !== 'running'}
              className="btn-primary mt-4 w-full"
            >
              {runningCycle ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {session.status === 'running' ? 'Run Cycle Now' : 'Resume Session to Run'}
            </button>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div className="rounded-xl bg-surface-hover px-3 py-2">
                <div className="uppercase tracking-wider">Created</div>
                <div className="mt-1 text-sm text-white">{formatDate(session.created_at)}</div>
              </div>
              <div className="rounded-xl bg-surface-hover px-3 py-2">
                <div className="uppercase tracking-wider">Return</div>
                <div className={`mt-1 text-sm ${stats?.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(stats?.return_pct, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Equity Curve</h2>
              <p className="text-sm text-gray-500">Portfolio snapshots captured after each cycle.</p>
            </div>
          </div>

          {equity.length > 1 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={equity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                <XAxis dataKey="timestampLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `$${Math.round(value).toLocaleString()}`} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  labelFormatter={(label) => label}
                  contentStyle={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 12 }}
                />
                <Line type="monotone" dataKey="total_value" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-surface-border text-sm text-gray-500">
              Run at least one cycle to start drawing the equity curve.
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white">Session Configuration</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-surface-hover px-4 py-3">
              <span className="text-gray-500">Strategy</span>
              <span className="font-medium text-white">{session.strategy}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-hover px-4 py-3">
              <span className="text-gray-500">Tracked Assets</span>
              <span className="font-medium text-white">{session.assets}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-hover px-4 py-3">
              <span className="text-gray-500">Risk Per Trade</span>
              <span className="font-medium text-white">{formatPercent(session.risk_per_trade * 100, 1)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-hover px-4 py-3">
              <span className="text-gray-500">Max Open Trades</span>
              <span className="font-medium text-white">{session.max_open_trades}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-hover px-4 py-3">
              <span className="text-gray-500">Stopped At</span>
              <span className="font-medium text-white">{formatDate(session.stopped_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Trade History</h2>
            <p className="text-sm text-gray-500">Review open positions and closed outcomes for this agent.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'open', 'closed'].map((filter) => (
              <button
                key={filter}
                onClick={() => setTradeFilter(filter)}
                className={tradeFilter === filter ? 'btn-primary px-3 py-2 text-xs uppercase' : 'btn-ghost px-3 py-2 text-xs uppercase'}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <TradesTable trades={trades} closingTradeId={closingTradeId} onCloseTrade={handleCloseTrade} />
      </div>
    </div>
  )
}

function SessionCard({ session, onOpen, onDelete, onChangeStatus, actionId }) {
  const isRunning = session.status === 'running'

  return (
    <div className="card-hover p-0">
      <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{session.name}</h2>
            <SessionStatusPill status={session.status} />
          </div>
          <p className="mt-2 text-sm text-gray-400">
            {session.assets} · {formatPercent(session.risk_per_trade * 100, 1)} risk per trade · max {session.max_open_trades} open trades
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-hover px-3 py-3">
              <div className="text-xs uppercase tracking-wider text-gray-500">Capital</div>
              <div className="mt-1 text-sm font-medium text-white">{formatMoney(session.current_capital)}</div>
            </div>
            <div className="rounded-xl bg-surface-hover px-3 py-3">
              <div className="text-xs uppercase tracking-wider text-gray-500">Created</div>
              <div className="mt-1 text-sm font-medium text-white">{formatDate(session.created_at)}</div>
            </div>
            <div className="rounded-xl bg-surface-hover px-3 py-3">
              <div className="text-xs uppercase tracking-wider text-gray-500">Strategy</div>
              <div className="mt-1 text-sm font-medium text-white">{session.strategy}</div>
            </div>
          </div>
          {session.notes ? <p className="mt-3 text-sm text-gray-500">{session.notes}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            onClick={() => onChangeStatus(session, isRunning ? 'paused' : 'running')}
            disabled={actionId === `${session.id}:${isRunning ? 'paused' : 'running'}`}
            className={isRunning ? 'btn-ghost' : 'btn-primary'}
          >
            {actionId === `${session.id}:${isRunning ? 'paused' : 'running'}` ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? 'Pause' : session.status === 'stopped' ? 'Restart' : 'Resume'}
          </button>

          {session.status !== 'stopped' ? (
            <button
              onClick={() => onChangeStatus(session, 'stopped')}
              disabled={actionId === `${session.id}:stopped`}
              className="btn-ghost"
            >
              {actionId === `${session.id}:stopped` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              Stop
            </button>
          ) : null}

          <button
            onClick={() => onDelete(session)}
            disabled={actionId === `${session.id}:delete`}
            className="btn-danger"
          >
            {actionId === `${session.id}:delete` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>

          <button onClick={() => onOpen(session.id)} className="btn-ghost">
            Open
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [actionId, setActionId] = useState('')
  const { addToast } = useToast()

  const loadSessions = useCallback(async () => {
    try {
      const response = await agentApi.getSessions()
      setSessions(response.data ?? [])
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to load agent sessions', 'error')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const overview = useMemo(() => {
    const trackedAssets = new Set()
    let capital = 0

    sessions.forEach((session) => {
      capital += session.current_capital || 0
      session.assets.split(',').map(asset => asset.trim()).filter(Boolean).forEach(asset => trackedAssets.add(asset))
    })

    return {
      running: sessions.filter(session => session.status === 'running').length,
      paused: sessions.filter(session => session.status === 'paused').length,
      totalCapital: capital,
      trackedAssets: trackedAssets.size,
    }
  }, [sessions])

  const handleCreate = async (form) => {
    try {
      await agentApi.createSession(form)
      addToast('Session created', 'success')
      await loadSessions()
      return true
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to create session', 'error')
      return false
    }
  }

  const handleChangeStatus = async (session, nextStatus) => {
    const nextActionId = `${session.id}:${nextStatus}`
    setActionId(nextActionId)

    try {
      await agentApi.updateSession(session.id, { status: nextStatus })
      addToast(`Session ${nextStatus}`, 'success')
      await loadSessions()
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to update session', 'error')
    } finally {
      setActionId('')
    }
  }

  const handleDelete = async (session) => {
    if (!window.confirm(`Delete "${session.name}"? This cannot be undone.`)) return

    const nextActionId = `${session.id}:delete`
    setActionId(nextActionId)

    try {
      await agentApi.deleteSession(session.id)
      addToast('Session deleted', 'success')
      if (selectedSessionId === session.id) setSelectedSessionId(null)
      await loadSessions()
    } catch (error) {
      addToast(error.response?.data?.detail || 'Failed to delete session', 'error')
    } finally {
      setActionId('')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (selectedSessionId) {
    return (
      <SessionDetail
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
        onSessionsChanged={loadSessions}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="flex flex-col gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.82))] px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-blue">
              <Bot className="h-3.5 w-3.5" />
              Agent Dashboard
            </div>
            <h1 className="text-3xl font-semibold text-white">Run paper-trading agents from one control room.</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Create multi-asset sessions, trigger manual cycles, review equity curves, and close trades at market without leaving the main workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={loadSessions} className="btn-ghost">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              New Session
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-surface-border px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Running Sessions"
            value={overview.running}
            subtext={`${overview.paused} paused or stopped sessions`}
            icon={Bot}
          />
          <MetricCard
            label="Paper Capital"
            value={formatMoney(overview.totalCapital)}
            subtext="Combined current capital across all sessions"
            icon={DollarSign}
          />
          <MetricCard
            label="Tracked Assets"
            value={overview.trackedAssets}
            subtext="Unique symbols covered by active configurations"
            icon={BarChart3}
          />
          <MetricCard
            label="Session Count"
            value={sessions.length}
            subtext="Create multiple strategies and compare them side by side"
            icon={TrendingUp}
          />
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No agent sessions yet"
          body="Create your first AI agent session to start paper trading with the backend execution engine that has already been wired up."
          actionLabel="Create Session"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={setSelectedSessionId}
              onDelete={handleDelete}
              onChangeStatus={handleChangeStatus}
              actionId={actionId}
            />
          ))}
        </div>
      )}

      <CreateSessionModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
