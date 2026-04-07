import { useState, useEffect } from 'react'
import { scannerApi, marketApi } from '../services/api'
import AssetSelector from '../components/ui/AssetSelector'
import SignalBadge from '../components/ui/SignalBadge'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { BarChart2, TrendingUp, TrendingDown, Activity, Info, Shield, Clock } from 'lucide-react'

function FeatureImportanceBar({ features = [] }) {
  if (!features.length) return null
  const max = features[0]?.importance ?? 1
  return (
    <div className="space-y-2 mt-2">
      {features.map(f => (
        <div key={f.feature} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-28 truncate flex-shrink-0">{f.feature}</span>
          <div className="flex-1 bg-surface-hover rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-blue"
              style={{ width: `${(f.importance / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-300 w-12 text-right">{f.importance?.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

export default function StockPredictionsPage() {
  const [asset,   setAsset]   = useState('TSLA')
  const [pred,    setPred]    = useState(null)
  const [quote,   setQuote]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [training, setTraining] = useState(false)

  const fetchPrediction = async (sym) => {
    setLoading(true)
    setError('')
    setPred(null)
    try {
      const [predRes, quoteRes] = await Promise.all([
        scannerApi.predict(sym),
        marketApi.getLiveQuote(sym),
      ])
      setPred(predRes.data)
      setQuote(quoteRes.data)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Failed to load prediction')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPrediction(asset) }, [asset])

  const handleTrain = async () => {
    setTraining(true)
    try {
      await scannerApi.trainSymbol(asset)
      await fetchPrediction(asset)
    } catch (e) {
      setError('Training failed: ' + (e.response?.data?.detail ?? e.message))
    } finally {
      setTraining(false)
    }
  }

  const isUp  = pred?.predicted_change_pct >= 0
  const probabilities = pred?.probabilities ?? {
    buy: pred?.signal_probabilities?.BUY ?? 0,
    hold: pred?.signal_probabilities?.HOLD ?? 0,
    sell: pred?.signal_probabilities?.SELL ?? 0,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-accent-blue" />
            Stock Predictions
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            LightGBM classifier + regressor for top 20 stocks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AssetSelector value={asset} onChange={setAsset} assetType="stock" />
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2.5 text-xs text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Stock prices from Yahoo Finance (15-min delayed).
      </div>

      {loading && (
        <div className="card flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <div className="card text-center py-8">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={() => fetchPrediction(asset)} className="btn-primary text-sm">Retry</button>
        </div>
      )}

      {!loading && pred && (
        <>
          {/* Stats row */}
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
              title="LightGBM Signal"
              value={<SignalBadge signal={pred.signal} />}
              sub={pred.confidence != null ? `${pred.confidence.toFixed(1)}% confidence` : null}
              icon={BarChart2}
            />
            <StatCard
              title="Predicted Price"
              value={pred.predicted_price != null ? `$${pred.predicted_price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              sub={pred.predicted_change_pct != null ? `${isUp ? '+' : ''}${pred.predicted_change_pct.toFixed(2)}%` : null}
              trend={isUp ? 'up' : 'down'}
              icon={isUp ? TrendingUp : TrendingDown}
            />
            <StatCard
              title="Data Delay"
              value="~15 min"
              sub="Yahoo Finance"
              icon={Clock}
            />
          </div>

          {/* Signal probabilities */}
          {(pred?.probabilities || pred?.signal_probabilities) && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent-blue" />
                LightGBM Signal Probabilities
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'buy',  label: 'BUY',  color: 'bg-green-500', text: 'text-green-400' },
                  { key: 'hold', label: 'HOLD', color: 'bg-yellow-500', text: 'text-yellow-400' },
                  { key: 'sell', label: 'SELL', color: 'bg-red-500',   text: 'text-red-400' },
                ].map(({ key, label, color, text }) => {
                  const pct = probabilities[key] ?? 0
                  return (
                    <div key={key} className="text-center">
                      <div className="relative w-full bg-surface-hover rounded-full h-3 mb-2">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-full ${color}`}
                          style={{ width: `${pct}%`, opacity: 0.8 }}
                        />
                      </div>
                      <p className={`text-lg font-bold font-mono ${text}`}>{pct.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Feature importance */}
          {pred.top_features?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-1">Top Feature Importances</h2>
              <p className="text-xs text-gray-500 mb-3">
                LightGBM feature importances driving this prediction
              </p>
              <FeatureImportanceBar features={pred.top_features} />
            </div>
          )}

          {/* Train button for untrained models */}
          {pred.status === 'untrained' && (
            <div className="card text-center py-6">
              <Shield className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">LightGBM model not trained for {asset}</p>
              <p className="text-gray-400 text-sm mb-4">
                Training uses 2 years of historical data and takes ~30 seconds
              </p>
              <button
                onClick={handleTrain}
                disabled={training}
                className="btn-primary text-sm"
              >
                {training ? 'Training…' : 'Train model now'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
