import { useState, useEffect } from 'react'
import { predictionsApi, marketApi } from '../services/api'
import AssetSelector from '../components/ui/AssetSelector'
import SignalBadge from '../components/ui/SignalBadge'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { TrendingUp, TrendingDown, Activity, Info, Shield } from 'lucide-react'

function RiskPanel({ risk }) {
  if (!risk) return null
  const tiers = [
    { key: 'conservative', label: 'Conservative', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    { key: 'standard',     label: 'Standard',     color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
    { key: 'aggressive',   label: 'Aggressive',   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      {tiers.map(({ key, label, color, bg }) => {
        const t = risk[key] ?? {}
        return (
          <div key={key} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{label}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Stop-loss</span>
                <span className="font-mono text-red-400">${t.stop_loss?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Take-profit</span>
                <span className="font-mono text-green-400">${t.take_profit?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">R:R</span>
                <span className="font-mono text-white">{t.risk_reward_ratio?.toFixed(2)}</span>
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
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-surface-border">
            <th className="text-left py-2 font-medium">Horizon</th>
            <th className="text-right py-2 font-medium">Predicted Price</th>
            <th className="text-right py-2 font-medium">Change</th>
            <th className="text-right py-2 font-medium">Signal</th>
            <th className="text-right py-2 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((p, i) => {
            const isUp = p.predicted_change_pct >= 0
            return (
              <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                <td className="py-2.5 font-medium text-white">{p.horizon ?? `${i+1}d`}</td>
                <td className="py-2.5 text-right font-mono text-white">
                  ${p.predicted_close?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </td>
                <td className={`py-2.5 text-right font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{p.predicted_change_pct?.toFixed(2)}%
                </td>
                <td className="py-2.5 text-right">
                  <SignalBadge signal={p.signal} size="sm" />
                </td>
                <td className="py-2.5 text-right text-gray-400">
                  {p.confidence?.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function CryptoPredictionsPage() {
  const [asset,   setAsset]   = useState('BTC')
  const [pred,    setPred]    = useState(null)
  const [quote,   setQuote]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fetchData = async (sym) => {
    setLoading(true)
    setError('')
    setPred(null)
    try {
      const [predRes, quoteRes] = await Promise.all([
        predictionsApi.getMultiHorizon(sym),
        marketApi.getLiveQuote(sym),
      ])
      setPred(predRes.data)
      setQuote(quoteRes.data)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(asset) }, [asset])

  const latest = pred?.predictions?.[0] ?? pred?.prediction ?? null
  const isUp   = latest?.predicted_change_pct >= 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-btc" />
            N-HiTS Predictions
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Multi-horizon N-HiTS forecasts for the featured assets: BTC and GOLD
          </p>
        </div>
        <AssetSelector value={asset} onChange={setAsset} allowedSymbols={['BTC', 'GOLD']} />
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2.5 text-xs text-yellow-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Educational predictions only. Not financial advice. BTC and gold can both be volatile.
      </div>

      {loading && (
        <div className="card flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <div className="card text-center py-10 text-red-400 text-sm">{error}</div>
      )}

      {!loading && pred && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Current Price"
              value={quote?.price != null ? `$${quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              sub={quote?.change_24h_pct != null ? `${quote.change_24h_pct >= 0 ? '+' : ''}${quote.change_24h_pct.toFixed(2)}% 24h` : null}
              trend={quote?.change_24h_pct >= 0 ? 'up' : 'down'}
              icon={Activity}
              accent
            />
            <StatCard
              title="Model Signal"
              value={<SignalBadge signal={latest?.signal} />}
              sub={latest?.confidence != null ? `${latest.confidence.toFixed(1)}% confidence` : null}
              icon={TrendingUp}
            />
            <StatCard
              title="Predicted (1d)"
              value={latest?.predicted_close != null ? `$${latest.predicted_close.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              sub={latest?.predicted_change_pct != null ? `${isUp ? '+' : ''}${latest.predicted_change_pct.toFixed(2)}%` : null}
              trend={isUp ? 'up' : 'down'}
              icon={isUp ? TrendingUp : TrendingDown}
            />
            <StatCard
              title="Model Type"
              value={pred.model_type ?? (asset === 'BTC' || asset === 'GOLD' ? 'N-HiTS' : 'LightGBM')}
              sub={pred.version ?? 'Deep Stock N-HiTS v1'}
              icon={Shield}
            />
          </div>

          {/* Multi-horizon table */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-blue" />
              Multi-Horizon Predictions
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              N-HiTS predictions for 1-day, 3-day, 7-day horizons with uncertainty bounds
            </p>
            <HorizonTable predictions={pred.predictions} />
          </div>

          {/* Risk levels */}
          {pred.risk && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                Risk Management
              </h2>
              <p className="text-xs text-gray-500">
                Stop-loss &amp; take-profit at three risk tiers based on ATR volatility
              </p>
              <RiskPanel risk={pred.risk} />
            </div>
          )}

          {/* MC uncertainty */}
          {pred.uncertainty && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3">MC Dropout Uncertainty</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Lower bound (5th pct)', val: pred.uncertainty.lower },
                  { label: 'Median', val: pred.uncertainty.median },
                  { label: 'Upper bound (95th pct)', val: pred.uncertainty.upper },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">
                      {val != null ? `$${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
