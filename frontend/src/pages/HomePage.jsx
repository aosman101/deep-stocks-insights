import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { marketApi, macroApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import FearGreedGauge from '../components/ui/FearGreedGauge'
import MacroCard from '../components/ui/MacroCard'
import SignalBadge from '../components/ui/SignalBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import NewsFeed from '../components/ui/NewsFeed'
import {
  TrendingUp, TrendingDown, Activity, BarChart2,
  Zap, Globe, ArrowRight,
} from 'lucide-react'

const TOP_ASSETS = ['BTC', 'ETH', 'GOLD', 'TSLA', 'AAPL', 'MSFT', 'NVDA', 'AMZN']

function QuoteRow({ symbol, quote, loading }) {
  const navigate = useNavigate()

  if (!quote) {
    if (loading) {
      return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border animate-pulse">
          <div className="h-4 w-24 bg-surface-hover rounded" />
          <div className="h-4 w-20 bg-surface-hover rounded" />
        </div>
      )
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="font-mono font-bold text-white text-sm w-14">{symbol}</span>
        <span className="text-xs text-gray-500">Quote unavailable</span>
      </div>
    )
  }

  const isUp = quote.change_24h_pct >= 0
  return (
    <button
      onClick={() => navigate('/graph-analysis?asset=' + symbol)}
      className="w-full flex items-center justify-between px-4 py-3 border-b border-surface-border hover:bg-surface-hover transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-white text-sm w-14 text-left">{symbol}</span>
        {isUp
          ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
        }
      </div>
      <div className="text-right">
        <p className="text-white text-sm font-mono">
          ${quote.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <p className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{quote.change_24h_pct?.toFixed(2)}%
        </p>
      </div>
    </button>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [quotes, setQuotes] = useState({})
  const [macro,  setMacro]  = useState(null)
  const [fng,    setFng]    = useState(null)
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [macroLoading, setMacroLoading] = useState(true)
  const [fngLoading, setFngLoading] = useState(true)

  useEffect(() => {
    let active = true

    setQuotesLoading(true)
    marketApi.getQuotes(TOP_ASSETS)
      .then((response) => {
        if (!active) return
        setQuotes(Object.fromEntries((response.data ?? []).map(quote => [quote.asset, quote])))
      })
      .catch(() => {
        if (active) setQuotes({})
      })
      .finally(() => {
        if (active) setQuotesLoading(false)
      })

    setMacroLoading(true)
    macroApi.getSummary()
      .then((response) => {
        if (active) setMacro(response?.data ?? null)
      })
      .catch(() => {
        if (active) setMacro(null)
      })
      .finally(() => {
        if (active) setMacroLoading(false)
      })

    setFngLoading(true)
    macroApi.getFearGreed()
      .then((response) => {
        if (active) setFng(response?.data ?? null)
      })
      .catch(() => {
        if (active) setFng(null)
      })
      .finally(() => {
        if (active) setFngLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Backend returns macro data at top-level as { fed_funds_rate: {value, label, unit}, ... }
  // Extract numeric values for indicator cards
  const macroIndicators = macro ? Object.fromEntries(
    Object.entries(macro)
      .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
      .map(([k, v]) => [k, v.value])
  ) : {}
  const macroInsights = macro?.insights ?? []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, <span className="text-accent-blue">{user?.full_name || user?.username}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Universal prediction workspace across N-HiTS and LightGBM
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/ai-insights')}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Zap className="w-4 h-4" />
            AI Insights
          </button>
          <button
            onClick={() => navigate('/graph-analysis')}
            className="flex items-center gap-2 px-4 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-white hover:border-accent-blue/50 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Graph Analysis
          </button>
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Predict',            path: '/predict',       icon: TrendingUp,  color: 'text-btc',         desc: 'Unified N-HiTS + LightGBM predictions' },
          { label: 'Graph Analysis',     path: '/graph-analysis',icon: Activity,    color: 'text-green-400',   desc: 'Full indicator suite' },
          { label: 'Comparison',         path: '/comparison',    icon: BarChart2,   color: 'text-accent-blue', desc: 'Backtests and model scoring' },
          { label: 'AI Insights',        path: '/ai-insights',   icon: Zap,         color: 'text-yellow-400',  desc: 'Market scanner & ranking' },
        ].map(({ label, path, icon: Icon, color, desc }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="card text-left hover:border-accent-blue/40 transition-colors group"
          >
            <Icon className={`w-6 h-6 ${color} mb-2`} />
            <p className="text-sm font-semibold text-white group-hover:text-accent-blue transition-colors">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live market movers */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-blue" />
              Live Market Quotes
            </h2>
            <button
              onClick={() => navigate('/graph-analysis')}
              className="flex items-center gap-1 text-xs text-accent-blue hover:underline"
            >
              View charts <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {TOP_ASSETS.map(sym => (
            <QuoteRow key={sym} symbol={sym} quote={quotes[sym]} loading={quotesLoading} />
          ))}
        </div>

        {/* Right column: Fear & Greed + macro */}
        <div className="space-y-4">
          {/* Fear & Greed */}
          {fngLoading ? (
            <div className="card flex items-center justify-center h-48">
              <LoadingSpinner />
            </div>
          ) : (
            <FearGreedGauge
              value={fng?.value}
              classification={fng?.classification ?? fng?.value_classification}
              updated={fng?.updated_at}
            />
          )}

          {/* Macro headline */}
          <div className="card">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              Macro Overview
            </h2>
            {macroLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(macroIndicators).slice(0, 6).map(([key, val]) => (
                  <div key={key} className="bg-surface-hover rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-bold text-white font-mono">
                      {typeof val === 'number' ? val.toFixed(2) : val ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Macro insight cards */}
      {!macroLoading && macroIndicators && Object.keys(macroIndicators).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent-blue" />
            Macro Indicators
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'fed_rate',     key: 'fed_funds_rate' },
              { id: 'cpi_yoy',     key: 'cpi_yoy' },
              { id: 'treasury_10y',key: 'treasury_10y' },
              { id: 'dxy',         key: 'usd_index' },
              { id: 'unemployment',key: 'unemployment' },
              { id: 'vix',         key: 'vix' },
            ].map(({ id, key }) => {
              const raw = macroIndicators[key] ?? macroIndicators[id]
              const val = typeof raw === 'object' && raw !== null ? raw.value : raw
              return (
                <MacroCard
                  key={id}
                  seriesId={id}
                  value={val != null ? Number(val) : null}
                  impact={null}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* AI macro insights */}
      {!macroLoading && macroInsights.length > 0 && (
        <div className="card">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">
            Macro AI Insights
          </h2>
          <div className="space-y-2">
            {macroInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <SignalBadge signal={insight.sentiment ?? insight.signal} size="sm" />
                <div>
                  <span className="text-white font-medium">{insight.title ?? insight.asset}: </span>
                  <span className="text-gray-400">{insight.body ?? insight.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market News Feed */}
      <NewsFeed category="general" maxItems={6} />

      {/* Disclaimer */}
      <div className="text-center text-xs text-gray-600 py-2">
        All predictions are generated by machine learning models and should be used as one of many tools in your research.
      </div>
    </div>
  )
}
