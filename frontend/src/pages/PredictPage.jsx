import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { adminApi, marketApi, predictionsApi, scannerApi, analyticsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import AssetSelector from '../components/ui/AssetSelector'
import SignalBadge from '../components/ui/SignalBadge'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import MonteCarloCone from '../components/charts/MonteCarloCone'
import { DEFAULT_PREDICT_ASSET, supportsLstm } from '../lib/predictConfig'
import {
  Activity,
  BarChart2,
  Cpu,
  Gauge,
  Info,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'

const MODEL_META = {
  lstm: {
    label: 'N-HiTS',
    title: 'Temporal Forecaster',
    icon: Cpu,
    accent: 'text-accent-blue',
    border: 'border-accent-blue/40',
    button: 'btn-primary',
    summary: 'Fast multi-horizon forecasts with hierarchical temporal blocks and MC dropout uncertainty.',
  },
  xgboost: {
    label: 'LightGBM',
    title: 'Universal Booster',
    icon: BarChart2,
    accent: 'text-yellow-400',
    border: 'border-yellow-500/30',
    button: 'btn-ghost',
    summary: 'Universal next-close prediction with signal probabilities and feature importances.',
  },
}

function formatPrice(value) {
  return value != null
    ? `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : '—'
}

function formatPercent(value, digits = 2) {
  return value != null ? `${value >= 0 ? '+' : ''}${Number(value).toFixed(digits)}%` : '—'
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.detail ?? error?.message ?? fallback
}

function FeatureImportanceBar({ features = [] }) {
  if (!features.length) return null
  const max = features[0]?.importance ?? 1

  return (
    <div className="space-y-2">
      {features.map((feature) => (
        <div key={feature.feature} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 truncate text-xs text-gray-400">{feature.feature}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-accent-blue"
              style={{ width: `${(feature.importance / max) * 100}%` }}
            />
          </div>
          <span className="w-12 text-right font-mono text-xs text-gray-300">{feature.importance?.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

function RiskPanel({ risk }) {
  if (!risk) return null

  const tiers = [
    { key: 'conservative', label: 'Conservative', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    { key: 'standard', label: 'Standard', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
    { key: 'aggressive', label: 'Aggressive', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiers.map(({ key, label, color, bg }) => {
        const tier = risk[key] ?? {}
        return (
          <div key={key} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Stop-loss</span>
                <span className="font-mono text-red-400">{formatPrice(tier.stop_loss)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Take-profit</span>
                <span className="font-mono text-green-400">{formatPrice(tier.take_profit)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">R:R</span>
                <span className="font-mono text-white">
                  {tier.risk_reward_ratio != null ? tier.risk_reward_ratio.toFixed(2) : '—'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HorizonTable({ predictions }) {
  if (!predictions?.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs text-gray-400">
            <th className="py-2 text-left font-medium">Horizon</th>
            <th className="py-2 text-right font-medium">Predicted Price</th>
            <th className="py-2 text-right font-medium">Change</th>
            <th className="py-2 text-right font-medium">Signal</th>
            <th className="py-2 text-right font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((prediction) => {
            const isUp = prediction.predicted_change_pct >= 0
            return (
              <tr key={prediction.horizon} className="border-b border-surface-border/50">
                <td className="py-2.5 font-medium text-white">{prediction.horizon}</td>
                <td className="py-2.5 text-right font-mono text-white">{formatPrice(prediction.predicted_close)}</td>
                <td className={`py-2.5 text-right font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(prediction.predicted_change_pct)}
                </td>
                <td className="py-2.5 text-right">
                  <SignalBadge signal={prediction.signal} size="sm" />
                </td>
                <td className="py-2.5 text-right text-gray-400">
                  {prediction.confidence != null ? `${prediction.confidence.toFixed(1)}%` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ModelModeCard({ active, modelKey, payload, error, onSelect }) {
  const meta = MODEL_META[modelKey]
  const Icon = meta.icon
  const signal = modelKey === 'lstm' ? payload?.prediction?.signal : payload?.signal
  const confidence = modelKey === 'lstm' ? payload?.prediction?.confidence : payload?.confidence
  const version = modelKey === 'lstm' ? payload?.version ?? payload?.model_version : payload?.model_version
  const isUntrained = modelKey === 'xgboost' && payload?.status === 'untrained'

  return (
    <button
      onClick={onSelect}
      className={`card text-left transition-colors ${
        active ? meta.border : 'border-surface-border hover:border-surface-border/80'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500">{meta.label}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{meta.title}</h2>
          <p className="mt-1 text-sm text-gray-400">{meta.summary}</p>
        </div>
        <div className={`rounded-xl border border-white/10 bg-surface px-3 py-3 ${meta.accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          active ? 'bg-white/10 text-white' : 'bg-surface-hover text-gray-400'
        }`}>
          {active ? 'Active model' : 'Click to view'}
        </span>

        {signal && <SignalBadge signal={signal} size="sm" />}

        {confidence != null && (
          <span className="text-xs text-gray-400">{confidence.toFixed(1)}% confidence</span>
        )}

        {version && (
          <span className="font-mono text-xs text-gray-500">{version}</span>
        )}

        {isUntrained && (
          <span className="text-xs text-yellow-400">Needs training</span>
        )}

        {!payload && !error && (
          <span className="text-xs text-gray-500">Loading…</span>
        )}

        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    </button>
  )
}

function EmptyModelState({ icon: Icon, title, body, action }) {
  return (
    <div className="card flex min-h-[240px] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-2xl border border-surface-border bg-surface p-4">
        <Icon className="h-8 w-8 text-yellow-400" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm text-gray-400">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export default function PredictPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [asset, setAsset] = useState(searchParams.get('asset')?.toUpperCase() ?? DEFAULT_PREDICT_ASSET)
  const [activeModel, setActiveModel] = useState(searchParams.get('model') === 'xgboost' ? 'xgboost' : 'lstm')
  const [trainedLstmAssets, setTrainedLstmAssets] = useState(new Set(['BTC', 'GOLD']))
  const [quote, setQuote] = useState(null)
  const [lstmData, setLstmData] = useState(null)
  const [xgbData, setXgbData] = useState(null)
  const [lstmError, setLstmError] = useState('')
  const [xgbError, setXgbError] = useState('')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(false)
  const [trainingModel, setTrainingModel] = useState('')
  const [mcData, setMcData] = useState(null)
  const [histData, setHistData] = useState([])

  const lstmSupported = supportsLstm(asset)
  const hasLstm = trainedLstmAssets.has(asset)
  const availableModels = hasLstm ? ['lstm', 'xgboost'] : ['xgboost']

  const refreshHealth = async () => {
    try {
      const response = await api.get('/health')
      const ready = new Set(
        Object.entries(response.data?.models ?? {})
          .filter(([, info]) => info?.trained)
          .map(([symbol]) => symbol.toUpperCase()),
      )
      if (ready.size) {
        setTrainedLstmAssets(ready)
      }
    } catch {}
  }

  useEffect(() => {
    refreshHealth()
  }, [])

  useEffect(() => {
    if (!hasLstm && activeModel === 'lstm') {
      setActiveModel('xgboost')
    }
  }, [activeModel, hasLstm])

  useEffect(() => {
    setSearchParams({ asset, model: hasLstm ? activeModel : 'xgboost' }, { replace: true })
  }, [activeModel, asset, hasLstm, setSearchParams])

  const fetchPredictions = async (symbol = asset) => {
    setLoading(true)
    setPageError('')
    setLstmError('')
    setXgbError('')

    const wantLstm = supportsLstm(symbol)
    const requests = [
      marketApi.getLiveQuote(symbol),
      scannerApi.predict(symbol),
      ...(wantLstm ? [predictionsApi.getMultiHorizon(symbol)] : []),
    ]

    try {
      const [quoteResult, xgbResult, lstmResult] = await Promise.allSettled(requests)

      if (quoteResult.status === 'fulfilled') {
        setQuote(quoteResult.value.data)
      } else {
        setQuote(null)
      }

      if (xgbResult.status === 'fulfilled') {
        setXgbData(xgbResult.value.data)
      } else {
        const message = getErrorMessage(xgbResult.reason, 'Failed to load the LightGBM prediction.')
        setXgbData(null)
        setXgbError(message)
      }

      if (wantLstm) {
        if (lstmResult?.status === 'fulfilled') {
          setLstmData(lstmResult.value.data)
        } else {
          const message = getErrorMessage(lstmResult?.reason, 'Failed to load the N-HiTS prediction.')
          setLstmData(null)
          setLstmError(message)
        }
      } else {
        setLstmData(null)
      }

      const failedModels = [
        xgbResult.status === 'rejected',
        wantLstm && lstmResult?.status === 'rejected',
      ].filter(Boolean).length

      if ((!wantLstm && xgbResult.status === 'rejected') || (wantLstm && failedModels === 2)) {
        setPageError(getErrorMessage(
          xgbResult.status === 'rejected' ? xgbResult.reason : lstmResult?.reason,
          'No predictions are available for this asset right now.',
        ))
      }

      // Fetch Monte Carlo + historical data for the cone chart (non-blocking)
      Promise.allSettled([
        analyticsApi.getMonteCarlo(symbol, 200, 7),
        marketApi.getHistorical(symbol, '3mo'),
      ]).then(([mcRes, histRes]) => {
        if (mcRes.status === 'fulfilled') setMcData(mcRes.value.data)
        else setMcData(null)
        if (histRes.status === 'fulfilled') setHistData(histRes.value.data?.data ?? histRes.value.data ?? [])
        else setHistData([])
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPredictions(asset)
  }, [asset])

  const handleRetrain = async (modelKey = activeModel) => {
    if (user?.role !== 'admin') return

    setTrainingModel(modelKey)
    setPageError('')

    try {
      if (modelKey === 'lstm') {
        await adminApi.trainModel(asset)
        setTrainedLstmAssets((current) => new Set([...current, asset]))
        setActiveModel('lstm')
      } else {
        await scannerApi.trainSymbol(asset)
      }
      await refreshHealth()
      await fetchPredictions(asset)
    } catch (error) {
      const message = getErrorMessage(error, `Failed to retrain ${asset}.`)
      if (modelKey === 'lstm') {
        setLstmError(message)
      } else {
        setXgbError(message)
      }
      setPageError(message)
    } finally {
      setTrainingModel('')
    }
  }

  const activePayload = activeModel === 'lstm' ? lstmData?.prediction : xgbData
  const activeError = activeModel === 'lstm' ? lstmError : xgbError
  const activeSignal = activeModel === 'lstm' ? activePayload?.signal : xgbData?.signal
  const activeConfidence = activeModel === 'lstm' ? activePayload?.confidence : xgbData?.confidence
  const activePredictedPrice = activeModel === 'lstm' ? activePayload?.predicted_close : xgbData?.predicted_price
  const activeVersion = activeModel === 'lstm'
    ? lstmData?.version ?? lstmData?.model_version
    : xgbData?.model_version
  const currentPrice = quote?.price ?? activePayload?.current_price
  const isUp = activeModel === 'lstm'
    ? activePayload?.predicted_change_pct >= 0
    : xgbData?.predicted_change_pct >= 0
  const activeModelMeta = MODEL_META[activeModel]
  const ActiveModelIcon = activeModelMeta.icon

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Target className="h-5 w-5 text-accent-blue" />
            Predict
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            One workspace for featured N-HiTS forecasts and universal LightGBM predictions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AssetSelector value={asset} onChange={setAsset} />
          <button
            onClick={() => fetchPredictions(asset)}
            className="btn-ghost"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => handleRetrain()}
              disabled={trainingModel === activeModel}
              className={activeModelMeta.button}
            >
              <Sparkles className={`h-4 w-4 ${trainingModel === activeModel ? 'animate-spin' : ''}`} />
              {trainingModel === activeModel ? 'Retraining…' : `Retrain ${activeModelMeta.label}`}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="card bg-gradient-to-br from-surface-card via-surface-card to-accent-blue/5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Prediction Workspace</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white">{asset}</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-400">
                {hasLstm
                  ? 'Featured asset with both sequence-model forecasts and universal booster coverage.'
                  : lstmSupported
                    ? 'This asset supports N-HiTS, but the trained weights are not loaded on disk yet. LightGBM remains available now.'
                    : 'Universal coverage asset using the LightGBM prediction stack.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableModels.map((modelKey) => (
                <span
                  key={modelKey}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    modelKey === 'lstm'
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : 'bg-yellow-500/15 text-yellow-400'
                  }`}
                >
                  {MODEL_META[modelKey].label}
                </span>
              ))}
              {user?.role === 'admin' && lstmSupported && !hasLstm && (
                <button
                  onClick={() => handleRetrain('lstm')}
                  disabled={trainingModel === 'lstm'}
                  className="rounded-full bg-accent-blue/15 px-3 py-1 text-xs font-medium text-accent-blue transition-colors hover:bg-accent-blue/25 disabled:opacity-60"
                >
                  {trainingModel === 'lstm' ? 'Training N-HiTS…' : 'Train N-HiTS'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Live Context</p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl font-bold text-white">{formatPrice(currentPrice)}</p>
              <p className={`mt-1 text-sm font-medium ${quote?.change_24h_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {quote?.change_24h_pct != null ? `${formatPercent(quote.change_24h_pct)} today` : 'Live quote pending'}
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface p-3">
              <ActiveModelIcon className={`h-5 w-5 ${activeModelMeta.accent}`} />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            {activeModel === 'lstm'
              ? 'Selected model is tuned for featured assets and returns 1d, 3d, and 7d horizons.'
              : 'Selected model is available for the full supported stock, crypto, and commodity universe.'}
          </p>
        </div>
      </div>

      <div className={`grid gap-4 ${availableModels.length === 2 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {availableModels.map((modelKey) => (
          <ModelModeCard
            key={modelKey}
            active={activeModel === modelKey}
            modelKey={modelKey}
            payload={modelKey === 'lstm' ? lstmData : xgbData}
            error={modelKey === 'lstm' ? lstmError : xgbError}
            onSelect={() => setActiveModel(modelKey)}
          />
        ))}
      </div>

      {pageError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {loading && (
        <div className="card flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && activePayload && activeModel === 'lstm' && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              title="Current Price"
              value={formatPrice(currentPrice)}
              sub={quote?.change_24h_pct != null ? `${formatPercent(quote.change_24h_pct)} today` : null}
              trend={quote?.change_24h_pct >= 0 ? 'up' : 'down'}
              icon={Activity}
              accent
            />
            <StatCard
              title="Model Signal"
              value={<SignalBadge signal={activeSignal} />}
              sub={activeConfidence != null ? `${activeConfidence.toFixed(1)}% confidence` : null}
              icon={Gauge}
            />
            <StatCard
              title="Predicted Close"
              value={formatPrice(activePredictedPrice)}
              sub={activePayload?.predicted_change_pct != null ? formatPercent(activePayload.predicted_change_pct) : null}
              trend={activePayload?.predicted_change_pct != null ? (isUp ? 'up' : 'down') : null}
              icon={Cpu}
            />
            <StatCard
              title="Model Version"
              value="N-HiTS"
              sub={activeVersion ?? 'Unversioned'}
              icon={Shield}
            />
          </div>

          <div className="card space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Cpu className="h-4 w-4 text-accent-blue" />
                Multi-Horizon Forecasts
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Featured-asset N-HiTS forecasts across 1d, 3d, and 7d horizons.
              </p>
            </div>
            <HorizonTable predictions={lstmData?.predictions} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="card space-y-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Shield className="h-4 w-4 text-yellow-400" />
                  Risk Management
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Stop-loss and take-profit levels derived from ATR volatility bands.
                </p>
              </div>
              <RiskPanel risk={lstmData?.risk} />
            </div>

            <div className="card">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-accent-blue" />
                Uncertainty Band
              </h2>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Lower bound', value: lstmData?.uncertainty?.lower },
                  { label: 'Median forecast', value: lstmData?.uncertainty?.median },
                  { label: 'Upper bound', value: lstmData?.uncertainty?.upper },
                ].map((row) => (
                  <div key={row.label} className="rounded-xl bg-surface-hover px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-gray-500">{row.label}</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatPrice(row.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monte Carlo Simulation Cone */}
          {mcData?.projection && (
            <div className="card space-y-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <TrendingUp className="h-4 w-4 text-accent-blue" />
                  Monte Carlo Simulation
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {mcData.simulations ?? 200} simulated price paths showing 50% and 90% confidence intervals over {mcData.projection?.length ?? 7} days.
                </p>
              </div>
              <MonteCarloCone
                historicalData={histData}
                projectionData={mcData.projection}
                height={280}
              />
              {mcData.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: 'Mean', value: mcData.summary.mean },
                    { label: 'Median', value: mcData.summary.median },
                    { label: 'P5 (bear)', value: mcData.summary.p5 },
                    { label: 'P95 (bull)', value: mcData.summary.p95 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-hover rounded-lg px-3 py-2 text-center">
                      <p className="text-gray-500">{label}</p>
                      <p className="text-sm font-bold text-white font-mono">{formatPrice(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!loading && activePayload && activeModel === 'xgboost' && xgbData?.status === 'ok' && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              title="Current Price"
              value={formatPrice(currentPrice)}
              sub={quote?.change_24h_pct != null ? `${formatPercent(quote.change_24h_pct)} today` : null}
              trend={quote?.change_24h_pct >= 0 ? 'up' : 'down'}
              icon={Activity}
              accent
            />
            <StatCard
              title="Model Signal"
              value={<SignalBadge signal={xgbData?.signal} />}
              sub={xgbData?.confidence != null ? `${xgbData.confidence.toFixed(1)}% confidence` : null}
              icon={Gauge}
            />
            <StatCard
              title="Predicted Close"
              value={formatPrice(xgbData?.predicted_price)}
              sub={xgbData?.predicted_change_pct != null ? formatPercent(xgbData.predicted_change_pct) : null}
              trend={xgbData?.predicted_change_pct != null ? (isUp ? 'up' : 'down') : null}
              icon={BarChart2}
            />
            <StatCard
              title="Model Version"
              value="LightGBM"
              sub={activeVersion ?? 'Unversioned'}
              icon={Shield}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="card">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Gauge className="h-4 w-4 text-accent-blue" />
                Signal Probabilities
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Classifier confidence across BUY, HOLD, and SELL outcomes.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-4">
                {[
                  { key: 'buy', label: 'BUY', color: 'bg-green-500', text: 'text-green-400' },
                  { key: 'hold', label: 'HOLD', color: 'bg-yellow-500', text: 'text-yellow-400' },
                  { key: 'sell', label: 'SELL', color: 'bg-red-500', text: 'text-red-400' },
                ].map(({ key, label, color, text }) => {
                  const value = xgbData?.probabilities?.[key] ?? 0
                  return (
                    <div key={key} className="text-center">
                      <div className="relative mb-2 h-3 w-full rounded-full bg-surface-hover">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-full ${color}`}
                          style={{ width: `${value}%`, opacity: 0.85 }}
                        />
                      </div>
                      <p className={`font-mono text-lg font-bold ${text}`}>{value.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <BarChart2 className="h-4 w-4 text-accent-blue" />
                Top Feature Importances
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Most influential engineered signals behind the current booster prediction.
              </p>
              <div className="mt-5">
                <FeatureImportanceBar features={xgbData?.top_features} />
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && activeModel === 'xgboost' && xgbData?.status === 'untrained' && (
        <EmptyModelState
          icon={BarChart2}
          title={`LightGBM is not trained for ${asset}`}
          body="This asset does not have a ready booster on disk yet. Train it now if you are an admin, or switch to the N-HiTS model when the asset supports it."
          action={user?.role === 'admin' ? (
            <button
              onClick={() => handleRetrain()}
              disabled={trainingModel === 'xgboost'}
              className="btn-primary"
            >
              <Sparkles className={`h-4 w-4 ${trainingModel === 'xgboost' ? 'animate-spin' : ''}`} />
              {trainingModel === 'xgboost' ? 'Training…' : 'Train LightGBM'}
            </button>
          ) : null}
        />
      )}

      {!loading && !activePayload && activeError && (
        <EmptyModelState
          icon={activeModel === 'lstm' ? Cpu : BarChart2}
          title={`${activeModelMeta.label} is unavailable for ${asset}`}
          body={activeError}
          action={user?.role === 'admin' ? (
            <button
              onClick={() => handleRetrain()}
              disabled={trainingModel === activeModel}
              className={activeModelMeta.button}
            >
              <Sparkles className={`h-4 w-4 ${trainingModel === activeModel ? 'animate-spin' : ''}`} />
              {trainingModel === activeModel ? 'Retraining…' : `Retrain ${activeModelMeta.label}`}
            </button>
          ) : null}
        />
      )}

      <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          Predictions are educational model outputs. Use them alongside broader market context, not as a standalone trading instruction.
        </span>
      </div>
    </div>
  )
}
