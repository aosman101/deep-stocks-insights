import { useState, useEffect, useCallback } from 'react'
import { agentApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  Bot, Plus, Play, Pause, Square, Trash2, TrendingUp, TrendingDown,
  DollarSign, BarChart3, RefreshCw, ChevronRight, X
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const STATUS_COLORS = {
  running: 'text-green-400 bg-green-400/10',
  paused: 'text-yellow-400 bg-yellow-400/10',
  stopped: 'text-red-400 bg-red-400/10',
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-accent-blue' }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function CreateSessionModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', assets: 'BTC,GOLD', initial_capital: 10000,
    risk_per_trade: 0.02, max_open_trades: 5, notes: '',
  })

  if (!open) return null

  const handle = (e) => {
    e.preventDefault()
    onCreate(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">New Agent Session</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Session Name</label>
            <input className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Assets (comma-separated)</label>
            <input className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
              value={form.assets} onChange={e => setForm({ ...form, assets: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Initial Capital ($)</label>
              <input type="number" className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                value={form.initial_capital} onChange={e => setForm({ ...form, initial_capital: +e.target.value })} min="100" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Risk per Trade (%)</label>
              <input type="number" step="0.01" className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                value={form.risk_per_trade * 100} onChange={e => setForm({ ...form, risk_per_trade: +e.target.value / 100 })} min="0.5" max="10" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Open Trades</label>
            <input type="number" className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
              value={form.max_open_trades} onChange={e => setForm({ ...form, max_open_trades: +e.target.value })} min="1" max="20" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <textarea className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
              rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="w-full bg-accent-blue hover:bg-accent-blue/80 text-white font-medium py-2 rounded-lg transition-colors">
            Create Session
          </button>
        </form>
      </div>
    </div>
  )
}

function TradesTable({ trades }) {
  if (!trades.length) return <p className="text-gray-500 text-sm py-4">No trades yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase border-b border-surface-border">
            <th className="text-left py-2 px-2">Asset</th>
            <th className="text-left py-2 px-2">Side</th>
            <th className="text-right py-2 px-2">Entry</th>
            <th className="text-right py-2 px-2">Exit</th>
            <th className="text-right py-2 px-2">Qty</th>
            <th className="text-right py-2 px-2">P&L</th>
            <th className="text-left py-2 px-2">Status</th>
            <th className="text-left py-2 px-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(t => (
            <tr key={t.id} className="border-b border-surface-border/50 hover:bg-surface-hover">
              <td className="py-2 px-2 text-white font-medium">{t.asset}</td>
              <td className="py-2 px-2">
                <span className={t.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                  {t.side.toUpperCase()}
                </span>
              </td>
              <td className="py-2 px-2 text-right text-gray-300">${t.entry_price?.toFixed(2)}</td>
              <td className="py-2 px-2 text-right text-gray-300">{t.exit_price ? `$${t.exit_price.toFixed(2)}` : '—'}</td>
              <td className="py-2 px-2 text-right text-gray-400">{t.quantity?.toFixed(4)}</td>
              <td className={`py-2 px-2 text-right font-medium ${t.pnl > 0 ? 'text-green-400' : t.pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {t.pnl != null ? `$${t.pnl.toFixed(2)}` : '—'}
              </td>
              <td className="py-2 px-2">
                <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'open' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {t.status}
                </span>
              </td>
              <td className="py-2 px-2 text-gray-500 text-xs">{t.exit_reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SessionDetail({ session, onBack }) {
  const [stats, setStats] = useState(null)
  const [trades, setTrades] = useState([])
  const [equity, setEquity] = useState([])
  const [running, setRunning] = useState(false)
  const { addToast } = useToast()

  const load = useCallback(async () => {
    try {
      const [s, t, e] = await Promise.all([
        agentApi.getStats(session.id),
        agentApi.getTrades(session.id),
        agentApi.getEquity(session.id),
      ])
      setStats(s.data)
      setTrades(t.data)
      setEquity(e.data.map(p => ({ ...p, timestamp: new Date(p.timestamp).toLocaleDateString() })))
    } catch (e) {
      addToast('Failed to load session data', 'error')
    }
  }, [session.id])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    setRunning(true)
    try {
      const res = await agentApi.runCycle(session.id)
      const d = res.data
      addToast(`Cycle: ${d.opened?.length || 0} opened, ${d.closed?.length || 0} closed`, 'success')
      load()
    } catch (e) {
      addToast(e.response?.data?.detail || 'Cycle failed', 'error')
    }
    setRunning(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">&larr; Back</button>
        <h2 className="text-xl font-bold text-white">{session.name}</h2>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[session.status]}`}>
          {session.status}
        </span>
        {session.status === 'running' && (
          <button onClick={handleRun} disabled={running}
            className="ml-auto flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/80 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Cycle
          </button>
        )}
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Capital" value={`$${stats.current_capital.toLocaleString()}`} icon={DollarSign} />
          <StatCard label="Total P&L" value={`$${stats.total_pnl.toFixed(2)}`}
            color={stats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'} icon={stats.total_pnl >= 0 ? TrendingUp : TrendingDown} />
          <StatCard label="Win Rate" value={`${stats.win_rate}%`} sub={`${stats.winners}W / ${stats.losers}L`} icon={BarChart3} />
          <StatCard label="Return" value={`${stats.return_pct}%`}
            color={stats.return_pct >= 0 ? 'text-green-400' : 'text-red-400'} icon={TrendingUp} />
        </div>
      )}

      {/* Equity curve */}
      {equity.length > 1 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={equity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="timestamp" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                labelStyle={{ color: '#888' }} />
              <Line type="monotone" dataKey="total_value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trades */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Trade History</h3>
        <TradesTable trades={trades} />
      </div>
    </div>
  )
}

export default function AgentPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const { addToast } = useToast()

  const loadSessions = async () => {
    try {
      const res = await agentApi.getSessions()
      setSessions(res.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadSessions() }, [])

  const handleCreate = async (form) => {
    try {
      await agentApi.createSession(form)
      addToast('Session created', 'success')
      loadSessions()
    } catch (e) {
      addToast(e.response?.data?.detail || 'Failed to create session', 'error')
    }
  }

  const handleToggle = async (s) => {
    const next = s.status === 'running' ? 'paused' : 'running'
    try {
      await agentApi.updateSession(s.id, { status: next })
      loadSessions()
    } catch (e) {
      addToast('Failed to update session', 'error')
    }
  }

  const handleDelete = async (s) => {
    try {
      await agentApi.deleteSession(s.id)
      addToast('Session deleted', 'success')
      loadSessions()
    } catch (e) {
      addToast('Failed to delete session', 'error')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  if (selected) {
    return <SessionDetail session={selected} onBack={() => { setSelected(null); loadSessions() }} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-accent-blue" /> AI Trading Agent
          </h1>
          <p className="text-gray-500 text-sm mt-1">Paper-trading agent powered by N-HiTS signals</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/80 text-white font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center">
          <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No agent sessions yet</p>
          <p className="text-gray-600 text-sm">Create a session to start paper trading with AI signals.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map(s => (
            <div key={s.id} className="bg-surface-card border border-surface-border rounded-xl p-4 hover:border-accent-blue/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium truncate">{s.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Assets: {s.assets}</span>
                    <span>Capital: ${s.current_capital?.toLocaleString()}</span>
                    <span>Risk: {(s.risk_per_trade * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(s)} title={s.status === 'running' ? 'Pause' : 'Resume'}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors">
                    {s.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(s)} title="Delete"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-surface-hover transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSelected(s)}
                    className="p-2 rounded-lg text-gray-400 hover:text-accent-blue hover:bg-surface-hover transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateSessionModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </div>
  )
}
