/**
 * ComparisonPage — Model Benchmarking
 * Shows walk-forward benchmark scores for N-HiTS, LightGBM, and their
 * combined ensemble, plus a baseline technical-strategy backtest.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { analyticsApi } from '../services/api'
import AssetSelector from '../components/ui/AssetSelector'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  BarChart2,
  Cpu,
  Gauge,
  Layers3,
  Sparkles,
} from 'lucide-react'

const PERIOD_OPTIONS = [
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
]

const METHOD_META = {
  nhits: {
    label: 'N-HiTS',
    icon: Cpu,
    accent: 'text-accent-blue',
    border: 'border-accent-blue/35',
    bg: 'bg-accent-blue/10',
  },
  lightgbm: {
    label: 'LightGBM',
    icon: BarChart2,
    accent: 'text-yellow-400',
    border: 'border-yellow-500/35',
    bg: 'bg-yellow-500/10',
  },
  ensemble: {
    label: 'Ensemble',
    icon: Layers3,
    accent: 'text-green-400',
    border: 'border-green-500/35',
    bg: 'bg-green-500/10',
  },
}

const METHOD_ALIASES = {
  lstm: 'nhits',
  nhits: 'nhits',
  xgboost: 'lightgbm',
  lightgbm: 'lightgbm',
  ensemble: 'ensemble',
}

function canonicalMethodKey(value) {
  if (!value) return 'ensemble'
  return METHOD_ALIASES[String(value).toLowerCase()] ?? 'ensemble'
}

function AccuracyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-xs">
      <p className="mb-1 text-gray-400">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono">${Number(entry.value).toFixed(2)}</span>
        </p>
      ))}
    </div>
  )
}

function MetricBox({ label, value, sub, tone = 'neutral' }) {
  const toneClass = tone === 'good'
    ? 'text-green-400'
    : tone === 'bad'
      ? 'text-red-400'
      : 'text-white'

  return (
    <div className="rounded-xl bg-surface-hover p-4 text-center">
      <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value ?? '—'}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
    </div>
  )
}

function MethodCard({ methodKey, method, active, onSelect, highlight }) {
  const meta = METHOD_META[methodKey]
  const Icon = meta.icon
  const isReady = method?.status === 'ok'

  return (
    <button
      onClick={() => isReady && onSelect(methodKey)}
      className={`card text-left transition-colors ${
        active ? meta.border : 'border-surface-border hover:border-surface-border/80'
      } ${!isReady ? 'opacity-80' : ''}`}
      disabled={!isReady}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{meta.label}</p>
            {highlight ? (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                Best now
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {isReady
              ? `${method.total_predictions} walk-forward predictions`
              : method?.reason ?? 'Unavailable'}
          </p>
        </div>
        <div className={`rounded-xl border border-white/10 px-3 py-3 ${meta.bg} ${meta.accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {isReady ? (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Dir Acc</p>
            <p className="mt-1 text-sm font-bold text-white">{method.directional_accuracy}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">MAE</p>
            <p className="mt-1 text-sm font-bold text-white">${method.mae?.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">MAPE</p>
            <p className="mt-1 text-sm font-bold text-white">{method.mape?.toFixed(2)}%</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-surface-hover px-3 py-3 text-xs text-yellow-300">
          {method?.reason ?? 'This model is unavailable for the selected asset and period.'}
        </div>
      )}
    </button>
  )
}

export default function ComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPeriod = PERIOD_OPTIONS.some(option => option.key === searchParams.get('period'))
    ? searchParams.get('period')
    : '1y'
  const [asset, setAsset] = useState(searchParams.get('asset')?.toUpperCase() ?? 'BTC')
  const [period, setPeriod] = useState(initialPeriod)
  const [selectedMethod, setSelectedMethod] = useState(canonicalMethodKey(searchParams.get('method')))
  const [accuracy, setAccuracy] = useState(null)
  const [backtest, setBacktest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async (symbol = asset, nextPeriod = period) => {
    setLoading(true)
    setError('')
    setAccuracy(null)
    setBacktest(null)
    try {
      const [accRes, btRes] = await Promise.all([
        analyticsApi.getAccuracy(symbol, nextPeriod),
        analyticsApi.backtest(symbol, nextPeriod).catch(() => null),
      ])
      const accPayload = accRes.data
      setAccuracy(accPayload)
      setBacktest(btRes?.data)

      const preferredMethod = accPayload?.methods?.[selectedMethod]?.status === 'ok'
        ? selectedMethod
        : canonicalMethodKey(accPayload?.best_method ?? accPayload?.selected_method)
      setSelectedMethod(preferredMethod)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Failed to load comparison data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(asset, period)
  }, [asset, period])

  useEffect(() => {
    setSearchParams({ asset, period, method: selectedMethod }, { replace: true })
  }, [asset, period, selectedMethod, setSearchParams])

  const methods = accuracy?.methods ?? {}
  const activeMethod = methods[selectedMethod] ?? null
  const comparisonRows = activeMethod?.comparison ?? accuracy?.comparison ?? []
  const activeMeta = METHOD_META[selectedMethod] ?? METHOD_META.ensemble
  const ActiveMethodIcon = activeMeta.icon

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <GitCompare className="h-5 w-5 text-accent-blue" />
            Model Benchmarking
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Walk-forward scores for N-HiTS, LightGBM, and the combined ensemble.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AssetSelector value={asset} onChange={setAsset} />
          <div className="flex rounded-xl border border-surface-border bg-surface p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setPeriod(option.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === option.key
                    ? 'bg-accent-blue text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : null}

      {error ? (
        <div className="card py-10 text-center text-sm text-red-400">{error}</div>
      ) : null}

      {!loading && accuracy ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="card bg-gradient-to-br from-surface-card via-surface-card to-accent-blue/5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Leaderboard</p>
              <h2 className="mt-3 text-2xl font-bold text-white">
                {accuracy.best_method_label ? `${accuracy.best_method_label} leads on ${asset}` : 'No model benchmark available'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-400">
                {accuracy.best_method_label
                  ? `${accuracy.best_method_label} currently has the strongest directional accuracy in the selected walk-forward window.`
                  : 'The selected asset or backend environment does not currently support this benchmark.'}
              </p>
              <p className="mt-4 text-xs text-gray-500">
                Period: {accuracy.period} · Generated: {new Date(accuracy.generated_at).toLocaleString()}
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Active View</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{activeMethod?.label ?? 'Select a model'}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {activeMethod?.status === 'ok'
                      ? activeMethod.method
                      : activeMethod?.reason ?? 'No model selected.'}
                  </p>
                </div>
                <div className={`rounded-xl border border-white/10 bg-surface px-3 py-3 ${activeMeta.accent}`}>
                  <ActiveMethodIcon className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {Object.entries(METHOD_META).map(([key]) => (
              <MethodCard
                key={key}
                methodKey={key}
                method={methods[key]}
                active={selectedMethod === key}
                onSelect={setSelectedMethod}
                highlight={accuracy.best_method === key}
              />
            ))}
          </div>

          {activeMethod?.status === 'ok' ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricBox
                  label="Directional Accuracy"
                  value={activeMethod.directional_accuracy != null ? `${activeMethod.directional_accuracy}%` : '—'}
                  sub={`${activeMethod.correct_directions}/${activeMethod.verified} correct`}
                  tone={activeMethod.directional_accuracy >= 55 ? 'good' : 'bad'}
                />
                <MetricBox
                  label="RMSE"
                  value={activeMethod.rmse != null ? `$${activeMethod.rmse.toFixed(2)}` : '—'}
                  sub="Root Mean Squared Error"
                  tone="neutral"
                />
                <MetricBox
                  label="MAE"
                  value={activeMethod.mae != null ? `$${activeMethod.mae.toFixed(2)}` : '—'}
                  sub="Mean Absolute Error"
                  tone="neutral"
                />
                <MetricBox
                  label="MAPE"
                  value={activeMethod.mape != null ? `${activeMethod.mape.toFixed(2)}%` : '—'}
                  sub={`${activeMethod.total_predictions} days tested`}
                  tone={activeMethod.mape < 5 ? 'good' : 'neutral'}
                />
              </div>

              <div className="text-center text-xs text-gray-500">
                Method: {activeMethod.method}
              </div>

              {comparisonRows.length > 0 ? (
                <div className="card">
                  <h2 className="mb-3 text-sm font-semibold text-white">
                    Predicted vs Actual (last {comparisonRows.length} sessions)
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={comparisonRows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={value => value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`}
                        width={56}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<AccuracyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                      <Line type="monotone" dataKey="current_close" name="Prior close" stroke="#6b7280" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="actual_close" name="Actual" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="predicted_close" name="Predicted" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              {comparisonRows.length > 0 ? (
                <div className="card">
                  <h2 className="mb-3 text-sm font-semibold text-white">Absolute Prediction Error</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={comparisonRows} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                      <Tooltip />
                      <Bar
                        dataKey="error"
                        name="|Error|"
                        maxBarSize={10}
                        shape={(props) => {
                          const fill = props.payload.was_correct_direction ? '#22c55e' : '#ef4444'
                          return <rect {...props} fill={fill} fillOpacity={0.72} />
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-xs text-gray-500">
                    Green bars = correct direction · Red bars = incorrect direction
                  </p>
                </div>
              ) : null}

              {comparisonRows.length > 0 ? (
                <div className="card overflow-hidden p-0">
                  <div className="border-b border-surface-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-white">Recent Forecast Log</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-surface-border text-gray-400">
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-right font-medium">Prior Close</th>
                          <th className="px-4 py-2 text-right font-medium">Predicted</th>
                          <th className="px-4 py-2 text-right font-medium">Actual</th>
                          <th className="px-4 py-2 text-right font-medium">Error</th>
                          <th className="px-4 py-2 text-center font-medium">Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.slice(-20).reverse().map((row, index) => (
                          <tr key={`${row.date}-${index}`} className="border-b border-surface-border/40 hover:bg-surface-hover">
                            <td className="px-4 py-2 text-gray-400">{row.date}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-400">${row.current_close?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-right font-mono text-white">${row.predicted_close?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-300">${row.actual_close?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-400">${row.error?.toFixed(2)}</td>
                            <td className="px-4 py-2 text-center">
                              {row.was_correct_direction
                                ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-400" />
                                : <XCircle className="mx-auto h-4 w-4 text-red-400" />
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="card py-12 text-center">
              <Gauge className="mx-auto mb-3 h-10 w-10 text-yellow-400" />
              <p className="text-sm text-white">The selected model does not have a benchmark result yet.</p>
              <p className="mt-1 text-xs text-gray-500">{activeMethod?.reason ?? 'Try another asset or period.'}</p>
            </div>
          )}

          {backtest ? (
            <div className="card">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-accent-blue" />
                Baseline Technical Backtest
              </h2>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total trades', val: backtest.total_trades ?? backtest.strategy_metrics?.total_trades },
                  { label: 'Win rate', val: backtest.win_rate != null ? `${(backtest.win_rate * 100).toFixed(1)}%` : '—' },
                  {
                    label: 'Total return',
                    val: backtest.total_return_pct != null
                      ? `${backtest.total_return_pct.toFixed(2)}%`
                      : backtest.strategy_metrics?.annualised_return_pct != null
                        ? `${backtest.strategy_metrics.annualised_return_pct.toFixed(2)}%`
                        : '—',
                  },
                  { label: 'Sharpe', val: backtest.sharpe_ratio?.toFixed(2) ?? backtest.strategy_metrics?.sharpe_ratio?.toFixed(2) ?? '—' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-surface-hover p-3 text-center">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="mt-0.5 text-base font-bold text-white">{item.val ?? '—'}</p>
                  </div>
                ))}
              </div>
              {backtest.equity_curve?.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={backtest.equity_curve} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip />
                    <ReferenceLine y={100} stroke="#4b5563" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="equity" name="Equity" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
