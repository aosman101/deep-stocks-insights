import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, analyticsApi, marketApi, predictionsApi, scannerApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import AssetSelector from '../components/ui/AssetSelector'
import SignalBadge from '../components/ui/SignalBadge'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import MonteCarloCone from '../components/charts/MonteCarloCone'
import { DEFAULT_PREDICT_ASSET, getDefaultModelKeys } from '../lib/predictConfig'
import {
  Activity,
  BarChart2,
  BrainCircuit,
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
  nhits: {
    label: 'N-HiTS',
    title: 'Hierarchical Forecaster',
    icon: Cpu,
    accent: 'text-accent-blue',
    border: 'border-accent-blue/40',
    button: 'btn-primary',
    summary: 'Multi-horizon sequence forecasts with hierarchical temporal blocks and MC dropout bands.',
  },
  tft: {
    label: 'TFT',
    title: 'Attention Forecaster',
    icon: BrainCircuit,
    accent: 'text-emerald-400',
    border: 'border-emerald-500/30',
    button: 'btn-ghost',
    summary: 'Transformer-style temporal forecasting with gated variable selection and self-attention.',
  },
  lightgbm: {
    label: 'LightGBM',
    title: 'Universal Booster',
    icon: BarChart2,
    accent: 'text-yellow-400',
    border: 'border-yellow-500/30',
    button: 'btn-ghost',
    summary: 'Universal next-close prediction with directional probabilities and feature importances.',
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
  if (!predictions?.length || predictions.length < 2) return null

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

function ProbabilityPanel({ probabilities }) {
  if (!probabilities) return null

  const rows = [
    { key: 'buy', label: 'BUY', color: 'bg-green-500', text: 'text-green-400' },
    { key: 'hold', label: 'HOLD', color: 'bg-yellow-500', text: 'text-yellow-400' },
    { key: 'sell', label: 'SELL', color: 'bg-red-500', text: 'text-red-400' },
  ]

  return (
    <div className="mt-5 grid grid-cols-3 gap-4">
      {rows.map(({ key, label, color, text }) => {
        const value = probabilities[key] ?? 0
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
  )
}

function ModelModeCard({ active, modelKey, payload, onSelect }) {
  const meta = MODEL_META[modelKey]
  const Icon = meta.icon
  const signal = payload?.prediction?.signal ?? payload?.signal
  const confidence = payload?.prediction?.confidence ?? payload?.confidence
  const version = payload?.model_version
  const status = payload?.status

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

        {version && <span className="font-mono text-xs text-gray-500">{version}</span>}
        {status === 'untrained' && <span className="text-xs text-yellow-400">Needs training</span>}
        {status && status !== 'ok' && status !== 'untrained' && (
          <span className="text-xs text-red-400">{payload?.error ?? payload?.message ?? 'Unavailable'}</span>
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
  const [activeModel, setActiveModel] = useState(searchParams.get('model') ?? 'nhits')
  const [workspace, setWorkspace] = useState(null)
  const [quote, setQuote] = useState(null)
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(false)
  const [trainingModel, setTrainingModel] = useState('')
  const [mcData, setMcData] = useState(null)
  const [histData, setHistData] = useState([])

  const availableModels = useMemo(() => {
    if (workspace?.models?.length) return workspace.models
    return getDefaultModelKeys(asset).map((modelKey) => ({
      model_key: modelKey,
      model_label: MODEL_META[modelKey]?.label ?? modelKey,
      status: 'loading',
    }))
  }, [asset, workspace])

  const modelsByKey = useMemo(
    () => Object.fromEntries((workspace?.models ?? []).map((item) => [item.model_key, item])),
    [workspace],
  )

  useEffect(() => {
    const supportedKeys = availableModels.map((item) => item.model_key)
    if (!supportedKeys.includes(activeModel)) {
      setActiveModel(supportedKeys[0] ?? 'lightgbm')
    }
  }, [activeModel, availableModels])

  useEffect(() => {
    setSearchParams({ asset, model: activeModel }, { replace: true })
  }, [activeModel, asset, setSearchParams])

  const fetchPredictions = async (symbol = asset) => {
    setLoading(true)
    setPageError('')

    try {
      const [workspaceResult, quoteResult] = await Promise.allSettled([
        predictionsApi.getWorkspace(symbol),
        marketApi.getLiveQuote(symbol),
      ])

      if (workspaceResult.status === 'fulfilled') {
        setWorkspace(workspaceResult.value.data)
      } else {
        setWorkspace(null)
        setPageError(getErrorMessage(workspaceResult.reason, 'No predictions are available for this asset right now.'))
      }

      if (quoteResult.status === 'fulfilled') {
        setQuote(quoteResult.value.data)
      } else {
        setQuote(null)
      }

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
      if (modelKey === 'lightgbm') {
        await scannerApi.trainSymbol(asset)
      } else {
        await adminApi.trainModel(asset, { model_key: modelKey })
      }
      await fetchPredictions(asset)
    } catch (error) {
      setPageError(getErrorMessage(error, `Failed to retrain ${asset}.`))
    } finally {
      setTrainingModel('')
    }
  }

  const activePayload = modelsByKey[activeModel]
  const activePrediction = activePayload?.prediction
  const activeModelMeta = MODEL_META[activeModel] ?? MODEL_META.lightgbm
  const ActiveModelIcon = activeModelMeta.icon
  const currentPrice = quote?.price ?? activePrediction?.current_price ?? workspace?.current_price
  const isUp = activePrediction?.predicted_change_pct >= 0
  const heroLabel = availableModels.length >= 3
    ? 'Featured asset with the full sequence-model stack plus universal booster coverage.'
    : 'Universal coverage asset using the LightGBM prediction stack.'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Target className="h-5 w-5 text-accent-blue" />
            Predict
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            One workspace for N-HiTS, TFT, and LightGBM forecasts using one shared schema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AssetSelector value={asset} onChange={setAsset} />
          <button onClick={() => fetchPredictions(asset)} className="btn-ghost" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {user?.role === 'admin' && activePayload && (
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
              <p className="mt-1 max-w-xl text-sm text-gray-400">{heroLabel}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableModels.map((model) => (
                <span
                  key={model.model_key}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    model.model_key === 'nhits'
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : model.model_key === 'tft'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-yellow-500/15 text-yellow-400'
                  }`}
                >
                  {MODEL_META[model.model_key]?.label ?? model.model_label}
                </span>
              ))}
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
            The selected model returns the same core fields as every other model. Extra sections only appear when that model produces them.
          </p>
        </div>
      </div>

      <div className={`grid gap-4 ${
        availableModels.length >= 3 ? 'lg:grid-cols-3' : availableModels.length === 2 ? 'lg:grid-cols-2' : 'grid-cols-1'
      }`}>
        {availableModels.map((model) => (
          <ModelModeCard
            key={model.model_key}
            active={activeModel === model.model_key}
            modelKey={model.model_key}
            payload={modelsByKey[model.model_key] ?? model}
            onSelect={() => setActiveModel(model.model_key)}
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

      {!loading && activePayload?.status === 'ok' && activePrediction && (
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
              value={<SignalBadge signal={activePrediction.signal} />}
              sub={activePrediction.confidence != null ? `${activePrediction.confidence.toFixed(1)}% confidence` : null}
              icon={Gauge}
            />
            <StatCard
              title="Predicted Close"
              value={formatPrice(activePrediction.predicted_close)}
              sub={activePrediction.predicted_change_pct != null ? formatPercent(activePrediction.predicted_change_pct) : null}
              trend={activePrediction.predicted_change_pct != null ? (isUp ? 'up' : 'down') : null}
              icon={activeModel === 'lightgbm' ? BarChart2 : activeModel === 'tft' ? BrainCircuit : Cpu}
            />
            <StatCard
              title="Model Version"
              value={activeModelMeta.label}
              sub={activePayload.model_version ?? 'Unversioned'}
              icon={Shield}
            />
          </div>

          {activePayload.predictions?.length > 1 && (
            <div className="card space-y-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Cpu className="h-4 w-4 text-accent-blue" />
                  Multi-Horizon Forecasts
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Shared forecast rows across the supported horizons for this model.
                </p>
              </div>
              <HorizonTable predictions={activePayload.predictions} />
            </div>
          )}

          {(activePayload.risk || activePayload.uncertainty) && (
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              {activePayload.risk && (
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
                  <RiskPanel risk={activePayload.risk} />
                </div>
              )}

              {activePayload.uncertainty && (
                <div className="card">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-accent-blue" />
                    Uncertainty Band
                  </h2>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'Lower bound', value: activePayload.uncertainty.lower },
                      { label: 'Median forecast', value: activePayload.uncertainty.median },
                      { label: 'Upper bound', value: activePayload.uncertainty.upper },
                    ].map((row) => (
                      <div key={row.label} className="rounded-xl bg-surface-hover px-4 py-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500">{row.label}</p>
                        <p className="mt-1 text-xl font-bold text-white">{formatPrice(row.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(activePayload.probabilities || activePayload.top_features?.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              {activePayload.probabilities && (
                <div className="card">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Gauge className="h-4 w-4 text-accent-blue" />
                    Signal Probabilities
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Classifier confidence across BUY, HOLD, and SELL outcomes.
                  </p>
                  <ProbabilityPanel probabilities={activePayload.probabilities} />
                </div>
              )}

              {activePayload.top_features?.length > 0 && (
                <div className="card">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <BarChart2 className="h-4 w-4 text-accent-blue" />
                    Top Feature Importances
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Most influential engineered signals behind the current booster prediction.
                  </p>
                  <div className="mt-5">
                    <FeatureImportanceBar features={activePayload.top_features} />
                  </div>
                </div>
              )}
            </div>
          )}

          {mcData?.projection && (
            <div className="card space-y-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <TrendingUp className="h-4 w-4 text-accent-blue" />
                  Monte Carlo Simulation
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {mcData.simulations ?? 200} simulated price paths showing confidence intervals over {mcData.projection?.length ?? 7} days.
                </p>
              </div>
              <MonteCarloCone historicalData={histData} projectionData={mcData.projection} height={280} />
              {mcData.summary && (
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  {[
                    { label: 'Mean', value: mcData.summary.mean },
                    { label: 'Median', value: mcData.summary.median },
                    { label: 'P5 (bear)', value: mcData.summary.p5 },
                    { label: 'P95 (bull)', value: mcData.summary.p95 },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-surface-hover px-3 py-2 text-center">
                      <p className="text-gray-500">{label}</p>
                      <p className="font-mono text-sm font-bold text-white">{formatPrice(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!loading && activePayload && activePayload.status !== 'ok' && (
        <EmptyModelState
          icon={ActiveModelIcon}
          title={`${activeModelMeta.label} is unavailable for ${asset}`}
          body={activePayload.error ?? activePayload.message ?? 'This model could not produce a forecast right now.'}
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
