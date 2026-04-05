import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { scannerApi, marketApi } from '../services/api'
import SignalBadge from '../components/ui/SignalBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, Filter,
  ChevronDown, ChevronUp, BarChart2, Activity, Gauge, Target,
  ArrowUpRight, ArrowDownRight, Zap, Shield, Eye, Grid3X3,
  List, Info,
} from 'lucide-react'

// ─── Score bar ─────────────────────────────────────────────────
function ScoreBar({ score }) {
  const pct = ((score + 1) / 2) * 100
  const color = score > 0.25 ? '#22c55e' : score < -0.25 ? '#ef4444' : '#eab308'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-surface rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-12 text-right" style={{ color }}>
        {score >= 0 ? '+' : ''}{score.toFixed(3)}
      </span>
    </div>
  )
}

// ─── Market sentiment gauge ────────────────────────────────────
function SentimentGauge({ buyCount, sellCount, holdCount, bias }) {
  const total = buyCount + sellCount + holdCount
  const buyPct = total ? (buyCount / total * 100) : 0
  const holdPct = total ? (holdCount / total * 100) : 0
  const sellPct = total ? (sellCount / total * 100) : 0

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Gauge className="w-4 h-4 text-accent-blue" />
        Market Sentiment
      </h2>
      <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden mb-3">
        {buyPct > 0 && <div className="h-full bg-green-500 transition-all" style={{ width: `${buyPct}%` }} />}
        {holdPct > 0 && <div className="h-full bg-yellow-500 transition-all" style={{ width: `${holdPct}%` }} />}
        {sellPct > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${sellPct}%` }} />}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-green-400 font-medium">{buyCount} Buy ({buyPct.toFixed(0)}%)</span>
        <span className="text-yellow-400 font-medium">{holdCount} Hold ({holdPct.toFixed(0)}%)</span>
        <span className="text-red-400 font-medium">{sellCount} Sell ({sellPct.toFixed(0)}%)</span>
      </div>
      <div className={`mt-3 text-center py-2 rounded-lg border text-sm font-bold ${
        bias === 'BULLISH' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
        bias === 'BEARISH' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
        'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      }`}>
        Overall: {bias}
      </div>
    </div>
  )
}

// ─── Top mover card ────────────────────────────────────────────
function MoverCard({ r, rank, type }) {
  const navigate = useNavigate()
  const isGainer = type === 'gainer'
  const color = isGainer ? 'text-green-400' : 'text-red-400'
  const bg = isGainer ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'

  return (
    <button
      onClick={() => navigate(`/predict?asset=${r.symbol}&model=xgboost`)}
      className={`rounded-xl border p-4 text-left transition-colors hover:border-accent-blue/40 ${bg}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">#{rank}</span>
          <span className="font-mono font-bold text-white text-sm">{r.symbol}</span>
        </div>
        <SignalBadge signal={r.signal} size="sm" />
      </div>
      <p className="text-lg font-bold font-mono text-white">
        ${r.current_price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </p>
      <div className={`flex items-center gap-1 text-sm font-medium mt-1 ${color}`}>
        {isGainer ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        {r.predicted_change_pct >= 0 ? '+' : ''}{r.predicted_change_pct?.toFixed(2)}%
      </div>
      <p className="text-xs text-gray-500 mt-1 truncate">{r.name}</p>
    </button>
  )
}

// ─── Heatmap grid cell ─────────────────────────────────────────
function HeatmapCell({ r, onClick }) {
  const score = r.score ?? 0
  const intensity = Math.min(Math.abs(score) * 2, 1)
  const bg = score > 0.15
    ? `rgba(34, 197, 94, ${intensity * 0.4})`
    : score < -0.15
      ? `rgba(239, 68, 68, ${intensity * 0.4})`
      : 'rgba(234, 179, 8, 0.1)'
  const border = score > 0.15
    ? `rgba(34, 197, 94, ${intensity * 0.3})`
    : score < -0.15
      ? `rgba(239, 68, 68, ${intensity * 0.3})`
      : 'rgba(234, 179, 8, 0.15)'

  return (
    <button
      onClick={onClick}
      className="rounded-lg p-3 text-center transition-all hover:scale-105 border"
      style={{ background: bg, borderColor: border }}
    >
      <p className="font-mono font-bold text-white text-xs">{r.symbol}</p>
      <p className={`text-xs font-medium mt-0.5 ${
        r.predicted_change_pct >= 0 ? 'text-green-400' : 'text-red-400'
      }`}>
        {r.predicted_change_pct >= 0 ? '+' : ''}{r.predicted_change_pct?.toFixed(1)}%
      </p>
    </button>
  )
}

// ─── Detailed expanded asset row ───────────────────────────────
function AssetRow({ r, expanded, onToggle }) {
  const navigate = useNavigate()

  return (
    <div className="border-b border-surface-border/50 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
      >
        <div className="w-16 flex-shrink-0">
          <span className="font-mono font-bold text-white text-sm">{r.symbol}</span>
          <p className="text-xs text-gray-500 truncate">{r.name}</p>
        </div>
        <div className="flex-1 min-w-0">
          <ScoreBar score={r.score} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right w-24">
            <p className="text-sm font-mono text-white">${r.current_price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p className={`text-xs font-mono ${r.predicted_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {r.predicted_change_pct >= 0 ? '+' : ''}{r.predicted_change_pct?.toFixed(2)}%
            </p>
          </div>
          <SignalBadge signal={r.signal} size="sm" />
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Insight text */}
          <p className="text-sm text-gray-300 leading-relaxed bg-surface-hover rounded-lg px-3 py-2">
            {r.insight}
          </p>

          {/* Indicator details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {r.rsi_14 != null && (
              <div className="bg-surface rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-1">RSI (14)</p>
                <p className={`text-sm font-bold font-mono ${r.rsi_14 < 35 ? 'text-green-400' : r.rsi_14 > 65 ? 'text-red-400' : 'text-white'}`}>
                  {r.rsi_14?.toFixed(1)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.rsi_14 < 30 ? 'Oversold' : r.rsi_14 < 35 ? 'Near oversold' : r.rsi_14 > 70 ? 'Overbought' : r.rsi_14 > 65 ? 'Near overbought' : 'Neutral'}
                </p>
              </div>
            )}
            {r.macd_histogram != null && (
              <div className="bg-surface rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-1">MACD Histogram</p>
                <p className={`text-sm font-bold font-mono ${r.macd_histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.macd_histogram?.toFixed(4)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.macd_histogram > 0 ? 'Bullish momentum' : 'Bearish momentum'}
                </p>
              </div>
            )}
            {r.adx_14 != null && (
              <div className="bg-surface rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-1">ADX (14)</p>
                <p className={`text-sm font-bold font-mono ${r.adx_14 > 25 ? 'text-accent-blue' : 'text-gray-400'}`}>
                  {r.adx_14?.toFixed(1)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.adx_14 > 40 ? 'Very strong trend' : r.adx_14 > 25 ? 'Trending' : 'Weak/ranging'}
                </p>
              </div>
            )}
            {r.bb_percent != null && (
              <div className="bg-surface rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-1">Bollinger %B</p>
                <p className={`text-sm font-bold font-mono ${r.bb_percent < 0.2 ? 'text-green-400' : r.bb_percent > 0.8 ? 'text-red-400' : 'text-white'}`}>
                  {r.bb_percent?.toFixed(3)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.bb_percent < 0.2 ? 'Near lower band' : r.bb_percent > 0.8 ? 'Near upper band' : 'Mid-band'}
                </p>
              </div>
            )}
          </div>

          {/* Indicator signal summary */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Indicators:</span>
            <span className="text-xs text-green-400">{r.bullish_count ?? 0} bullish</span>
            <span className="text-xs text-gray-600">|</span>
            <span className="text-xs text-red-400">{r.bearish_count ?? 0} bearish</span>
            <span className="text-xs text-gray-600">|</span>
            <span className="text-xs text-gray-400">Overall: {r.overall_indicator_signal ?? '—'}</span>
            <span className="text-xs text-gray-600">|</span>
            <span className="text-xs text-gray-400">Model: {r.model_used === 'lightgbm' ? 'LightGBM' : 'Indicators only'}</span>
            {r.confidence != null && (
              <>
                <span className="text-xs text-gray-600">|</span>
                <span className="text-xs text-gray-400">Confidence: {r.confidence.toFixed(1)}%</span>
              </>
            )}
          </div>

          {/* Score components */}
          {r.score_components && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Score Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(r.score_components).map(([k, v]) => (
                  <div key={k} className="bg-surface rounded px-2 py-1.5 flex items-center justify-between">
                    <span className="text-xs text-gray-400 capitalize">{k.replace('_signal', '')}</span>
                    <span className={`text-xs font-mono font-semibold ${v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {v >= 0 ? '+' : ''}{v.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => navigate(`/predict?asset=${r.symbol}&model=xgboost`)}
              className="btn-primary text-xs py-1.5"
            >
              <Target className="w-3.5 h-3.5" /> Predict
            </button>
            <button
              onClick={() => navigate(`/graph-analysis?asset=${r.symbol}`)}
              className="btn-ghost text-xs py-1.5"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Chart
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sector breakdown bar ──────────────────────────────────────
function SectorBar({ name, data }) {
  const color = data.avg_score > 0.15 ? '#22c55e' : data.avg_score < -0.15 ? '#ef4444' : '#eab308'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-24 truncate capitalize">{name}</span>
      <div className="flex-1 bg-surface rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(Math.abs(data.avg_score) * 100 + 20, 100)}%`,
            background: color,
            opacity: 0.7,
          }}
        />
      </div>
      <span className="text-xs font-mono w-14 text-right" style={{ color }}>
        {data.avg_score >= 0 ? '+' : ''}{data.avg_score.toFixed(3)}
      </span>
      <span className="text-xs text-gray-600 w-8 text-right">({data.count})</span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────
export default function AIInsightsPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [assetType, setAssetType] = useState('all')
  const [tab, setTab] = useState('buy')
  const [viewMode, setViewMode] = useState('list') // list | heatmap
  const [expanded, setExpanded] = useState({})
  const [sortBy, setSortBy] = useState('score') // score | change | name

  const runScan = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await scannerApi.run(assetType, 40)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Scanner failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runScan() }, [assetType])

  const toggleExpand = (sym) => setExpanded(e => ({ ...e, [sym]: !e[sym] }))

  // Sorted results for tabs
  const sortFn = (a, b) => {
    if (sortBy === 'change') return Math.abs(b.predicted_change_pct ?? 0) - Math.abs(a.predicted_change_pct ?? 0)
    if (sortBy === 'name') return a.symbol.localeCompare(b.symbol)
    return b.score - a.score
  }

  const tabData = {
    buy: (result?.buy_signals ?? []).sort(sortFn),
    hold: (result?.hold_signals ?? []).sort(sortFn),
    sell: (result?.sell_signals ?? []).sort(sortFn),
  }

  // Top gainers and losers
  const allResults = result?.all_results ?? []
  const topGainers = [...allResults].filter(r => r.predicted_change_pct > 0).sort((a, b) => b.predicted_change_pct - a.predicted_change_pct).slice(0, 4)
  const topLosers = [...allResults].filter(r => r.predicted_change_pct < 0).sort((a, b) => a.predicted_change_pct - b.predicted_change_pct).slice(0, 4)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            AI Insights Scanner
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            LightGBM + indicator composite scoring across {result?.total_scanned ?? 'all'} assets
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Asset type filter */}
          <div className="flex items-center gap-1 bg-surface-hover border border-surface-border rounded-lg px-1 py-1">
            {['all', 'crypto', 'stocks'].map(t => (
              <button
                key={t}
                onClick={() => setAssetType(t)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  assetType === t ? 'bg-accent-blue text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={runScan}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-white hover:border-accent-blue/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Re-scan
          </button>
        </div>
      </div>

      {loading && (
        <div className="card flex flex-col items-center justify-center py-16 gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 text-sm">Scanning {assetType === 'all' ? 'all' : assetType} assets...</p>
          <p className="text-gray-600 text-xs">Fetching prices, computing indicators, running LightGBM models</p>
        </div>
      )}

      {error && <div className="card text-center py-10 text-red-400 text-sm">{error}</div>}

      {!loading && result && (
        <>
          {/* ─── Summary Stats + Sentiment ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sentiment gauge */}
            <SentimentGauge
              buyCount={result.summary.buy_count}
              sellCount={result.summary.sell_count}
              holdCount={result.summary.hold_count}
              bias={result.summary.market_bias}
            />

            {/* Stat cards */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-white flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Scanned</p>
                  <p className="text-xl font-bold text-white">{result.total_scanned}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Buy Signals</p>
                  <p className="text-xl font-bold text-green-400">{result.summary.buy_count}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <Minus className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Hold Signals</p>
                  <p className="text-xl font-bold text-yellow-400">{result.summary.hold_count}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Sell Signals</p>
                  <p className="text-xl font-bold text-red-400">{result.summary.sell_count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Top Movers ─── */}
          {(topGainers.length > 0 || topLosers.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top gainers */}
              {topGainers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                    Biggest Predicted Gainers
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {topGainers.map((r, i) => (
                      <MoverCard key={r.symbol} r={r} rank={i + 1} type="gainer" />
                    ))}
                  </div>
                </div>
              )}
              {/* Top losers */}
              {topLosers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    Biggest Predicted Decliners
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {topLosers.map((r, i) => (
                      <MoverCard key={r.symbol} r={r} rank={i + 1} type="loser" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Market Heatmap ─── */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-accent-blue" />
                Market Heatmap
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500/40 inline-block" /> Bullish</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-yellow-500/20 inline-block" /> Neutral</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-500/40 inline-block" /> Bearish</span>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {allResults.map(r => (
                <HeatmapCell
                  key={r.symbol}
                  r={r}
                  onClick={() => navigate(`/predict?asset=${r.symbol}&model=xgboost`)}
                />
              ))}
            </div>
          </div>

          {/* ─── Top Opportunities (AI Insights) ─── */}
          {result.top_opportunities?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Top AI-Ranked Opportunities
              </h2>
              <div className="space-y-3">
                {result.top_opportunities.map((r, i) => (
                  <div key={r.symbol} className="flex items-start gap-3 bg-surface-hover rounded-lg p-3">
                    <span className="text-xs text-gray-600 w-4 flex-shrink-0 mt-0.5 font-bold">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-white text-sm">{r.symbol}</span>
                        <SignalBadge signal={r.signal} size="sm" />
                        <span className="text-xs text-gray-500">{r.name}</span>
                        {r.confidence != null && (
                          <span className="text-xs text-gray-600 ml-auto">{r.confidence.toFixed(0)}% conf</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{r.insight}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono text-white">${r.current_price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                      <p className={`text-xs font-medium ${r.predicted_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {r.predicted_change_pct >= 0 ? '+' : ''}{r.predicted_change_pct?.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Sector Breakdown ─── */}
          {result.sector_breakdown && Object.keys(result.sector_breakdown).length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent-blue" />
                Sector Breakdown
              </h2>
              <div className="space-y-2.5">
                {Object.entries(result.sector_breakdown)
                  .sort(([, a], [, b]) => b.avg_score - a.avg_score)
                  .map(([name, data]) => (
                    <SectorBar key={name} name={name} data={data} />
                  ))}
              </div>
            </div>
          )}

          {/* ─── All Results (Tabbed List) ─── */}
          <div className="card p-0 overflow-hidden">
            {/* Tab headers + controls */}
            <div className="flex items-center justify-between border-b border-surface-border">
              <div className="flex">
                {[
                  { id: 'buy', label: `Buy (${result.summary.buy_count})`, color: 'text-green-400' },
                  { id: 'hold', label: `Hold (${result.summary.hold_count})`, color: 'text-yellow-400' },
                  { id: 'sell', label: `Sell (${result.summary.sell_count})`, color: 'text-red-400' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                      tab === t.id
                        ? `border-accent-blue ${t.color}`
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pr-3">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-surface-hover border border-surface-border rounded text-xs text-gray-400 px-2 py-1 focus:outline-none"
                >
                  <option value="score">Sort: Score</option>
                  <option value="change">Sort: Change %</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>
            </div>

            {/* Tab content */}
            <div>
              {tabData[tab].length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No {tab} signals found</p>
              ) : (
                tabData[tab].map(r => (
                  <AssetRow
                    key={r.symbol}
                    r={r}
                    expanded={!!expanded[r.symbol]}
                    onToggle={() => toggleExpand(r.symbol)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Scores are algorithmic signals combining LightGBM predictions with technical indicators.
              They should not be used as sole investment advice. Always do your own research.
              Scanned at {new Date(result.scanned_at).toLocaleTimeString()}.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
