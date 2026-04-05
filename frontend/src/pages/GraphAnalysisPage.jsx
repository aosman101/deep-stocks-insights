import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { marketApi } from '../services/api'
import AssetSelector from '../components/ui/AssetSelector'
import SignalBadge from '../components/ui/SignalBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PriceChart from '../components/charts/PriceChart'
import IndicatorChart from '../components/charts/IndicatorChart'
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap'
import { LineChart, RefreshCw, Settings2, ChevronDown } from 'lucide-react'

const PERIOD_OPTIONS = ['1mo','3mo','6mo','1y','2y','5y','25y']

const INDICATOR_OPTIONS = [
  { id: 'RSI',       label: 'RSI (14)' },
  { id: 'MACD',      label: 'MACD (12,26,9)' },
  { id: 'Stochastic',label: 'Stochastic (14,3,3)' },
  { id: 'ADX',       label: 'ADX (14)' },
  { id: 'ATR',       label: 'ATR (14)' },
  { id: 'Williams',  label: "Williams %R" },
  { id: 'CCI',       label: 'CCI (20)' },
]

const OVERLAY_OPTIONS = [
  { id: 'sma',  label: 'SMA 20/50' },
  { id: 'ema',  label: 'EMA 20' },
  { id: 'bb',   label: 'Bollinger Bands' },
]

function ToggleChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-accent-blue text-white'
          : 'bg-surface-hover text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function PivotTable({ pivots }) {
  if (!pivots) return null
  const rows = [
    { label: 'R3', val: pivots.r3, color: 'text-red-400' },
    { label: 'R2', val: pivots.r2, color: 'text-red-300' },
    { label: 'R1', val: pivots.r1, color: 'text-red-200' },
    { label: 'PP', val: pivots.pp, color: 'text-white font-bold' },
    { label: 'S1', val: pivots.s1, color: 'text-green-200' },
    { label: 'S2', val: pivots.s2, color: 'text-green-300' },
    { label: 'S3', val: pivots.s3, color: 'text-green-400' },
  ]
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs mt-2">
      {rows.map(({ label, val, color }) => (
        <div key={label} className="bg-surface-hover rounded p-2">
          <p className="text-gray-500">{label}</p>
          <p className={`font-mono mt-0.5 ${color}`}>{val?.toFixed(2) ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

function FibTable({ fib }) {
  if (!fib) return null
  return (
    <div className="grid grid-cols-3 gap-2 text-xs mt-2">
      {Object.entries(fib).map(([level, val]) => (
        <div key={level} className="bg-surface-hover rounded px-3 py-2 flex justify-between">
          <span className="text-gray-400">{level.replace('fib_', '')} Fib</span>
          <span className="font-mono text-yellow-400">{val?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

export default function GraphAnalysisPage() {
  const [params]  = useSearchParams()
  const [asset,   setAsset]   = useState(params.get('asset') ?? 'BTC')
  const [period,  setPeriod]  = useState(params.get('period') ?? '1y')
  const [indicators, setIndicators] = useState(['RSI', 'MACD'])
  const [overlays,   setOverlays]   = useState(['sma'])
  const [data,    setData]    = useState([])
  const [indData, setIndData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [indicatorsLoading, setIndicatorsLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [indicatorsError, setIndicatorsError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const requestIdRef = useRef(0)

  const fetchData = async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setHistoryError('')
    setIndicatorsError('')
    setHistoryLoading(true)
    setIndicatorsLoading(true)

    marketApi.getHistorical(asset, period)
      .then((response) => {
        if (requestIdRef.current !== requestId) return
        setData(response.data?.data ?? response.data ?? [])
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) return
        setData([])
        setHistoryError(error.response?.data?.detail ?? 'Failed to load price history')
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setHistoryLoading(false)
        }
      })

    marketApi.getIndicators(asset, period)
      .then((response) => {
        if (requestIdRef.current !== requestId) return
        setIndData(response.data ?? null)
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) return
        setIndData(null)
        setIndicatorsError(error.response?.data?.detail ?? 'Failed to load technical indicators')
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIndicatorsLoading(false)
        }
      })
  }

  useEffect(() => { fetchData() }, [asset, period])

  const toggleIndicator = (id) => {
    setIndicators(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }
  const toggleOverlay = (id) => {
    setOverlays(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Merge indicator values into OHLCV data for sub-charts
  const chartData = data.map((candle, i) => ({
    ...candle,
    ...(indData?.series?.[i] ?? {}),
  }))

  const summary = indData?.summary ?? indData ?? {}
  const pivots  = indData?.pivot_points ?? summary.pivot_points ?? null
  const fib     = indData?.fibonacci ?? summary.fibonacci ?? null
  const corr    = indData?.correlation_matrix ?? null
  const firstPoint = chartData[0]
  const lastPoint = chartData[chartData.length - 1]
  const dateRangeLabel = firstPoint && lastPoint
    ? `${new Date(firstPoint.timestamp ?? firstPoint.date).getFullYear()} - ${new Date(lastPoint.timestamp ?? lastPoint.date).getFullYear()}`
    : null

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LineChart className="w-5 h-5 text-green-400" />
            Graph Analysis
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Long-range chart workspace with up to 25 years of market data for trend tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AssetSelector value={asset} onChange={setAsset} />
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-surface-hover border border-surface-border rounded-lg px-1 py-1">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === p ? 'bg-accent-blue text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-surface-hover border border-surface-border text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
              showSettings ? 'bg-accent-blue/20 border-accent-blue/40 text-accent-blue' : 'bg-surface-hover border-surface-border text-gray-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Indicators</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Indicator settings panel */}
      {showSettings && (
        <div className="card space-y-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Overlays</p>
            <div className="flex flex-wrap gap-2">
              {OVERLAY_OPTIONS.map(o => (
                <ToggleChip key={o.id} label={o.label} active={overlays.includes(o.id)} onClick={() => toggleOverlay(o.id)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Sub-chart indicators</p>
            <div className="flex flex-wrap gap-2">
              {INDICATOR_OPTIONS.map(o => (
                <ToggleChip key={o.id} label={o.label} active={indicators.includes(o.id)} onClick={() => toggleIndicator(o.id)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {historyLoading && (
        <div className="card flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {historyError && (
        <div className="card text-center py-10 text-red-400 text-sm">{historyError}</div>
      )}

      {!historyLoading && chartData.length > 0 && (
        <>
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Dataset Window</p>
              <p className="text-sm font-semibold text-white">
                {dateRangeLabel ?? 'Unknown range'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-gray-500">Points Loaded</p>
              <p className="text-sm font-semibold text-white font-mono">{chartData.length}</p>
            </div>
          </div>

          {/* Overall signal */}
          {summary.overall_signal && (
            <div className="flex items-center gap-4 px-4 py-3 bg-surface-card border border-surface-border rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Overall signal:</span>
                <SignalBadge signal={summary.overall_signal} />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="text-green-400">▲ {summary.bullish_count ?? 0} bullish</span>
                <span className="text-red-400">▼ {summary.bearish_count ?? 0} bearish</span>
                {summary.current_price != null && (
                  <span className="text-white font-mono">
                    ${summary.current_price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Main price chart */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3">{asset} — Price Chart ({period})</h2>
            <PriceChart
              data={chartData}
              height={340}
              showSMA={overlays.includes('sma')}
              showEMA={overlays.includes('ema')}
              showBB={overlays.includes('bb')}
            />
          </div>

          {/* Sub-chart indicators */}
          {indicatorsLoading && (
            <div className="card flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          )}

          {indicatorsError && (
            <div className="card text-center py-6 text-yellow-400 text-sm">{indicatorsError}</div>
          )}

          {indicators.length > 0 && indData && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-2">Technical Indicators</h2>
              <IndicatorChart data={chartData} indicators={indicators} />
            </div>
          )}

          {/* Key indicator values */}
          {indData && summary && Object.keys(summary).length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3">Current Indicator Values</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { key: 'rsi_14',        label: 'RSI (14)' },
                  { key: 'macd',          label: 'MACD' },
                  { key: 'macd_signal',   label: 'MACD Signal' },
                  { key: 'adx_14',        label: 'ADX (14)' },
                  { key: 'atr_14',        label: 'ATR (14)' },
                  { key: 'bb_percent',    label: 'BB %B' },
                  { key: 'stoch_k',       label: 'Stoch %K' },
                  { key: 'williams_r',    label: "Williams %R" },
                  { key: 'cci_20',        label: 'CCI (20)' },
                  { key: 'obv',           label: 'OBV' },
                ].map(({ key, label }) => summary[key] != null && (
                  <div key={key} className="bg-surface-hover rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-white font-mono mt-0.5">
                      {typeof summary[key] === 'number'
                        ? summary[key] >= 10000
                          ? summary[key].toExponential(2)
                          : summary[key].toFixed(2)
                        : summary[key]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pivot Points */}
          {indData && pivots && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-1">Pivot Points</h2>
              <p className="text-xs text-gray-500 mb-2">Classic pivot levels for support/resistance</p>
              <PivotTable pivots={pivots} />
            </div>
          )}

          {/* Fibonacci levels */}
          {indData && fib && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-1">Fibonacci Retracement</h2>
              <p className="text-xs text-gray-500 mb-2">Key Fibonacci levels based on recent swing high/low</p>
              <FibTable fib={fib} />
            </div>
          )}

          {/* Correlation heatmap */}
          {indData && corr && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3">Correlation Matrix</h2>
              <CorrelationHeatmap matrix={corr} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
