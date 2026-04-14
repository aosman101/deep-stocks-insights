import { useEffect, useState } from 'react'
import { macroApi, marketApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Gauge,
  Globe,
  Layers,
  LineChart as LineIcon,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react'

const TRADING_CONCEPTS = [
  {
    id: 'market-framework',
    title: 'Market Framework',
    icon: Layers,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    summary: 'Start with regime, trend, and macro before worrying about entries.',
    content: [
      {
        heading: 'Regime First',
        text: 'Decide whether the asset is trending, ranging, or breaking down. Trend tools work best in directional markets; oscillators work better when price is rotating inside a range.',
      },
      {
        heading: 'Top-Down Structure',
        text: 'Read the higher timeframe first, then drop down for execution. Daily trend, 4H structure, and 1H trigger is usually more reliable than reacting only to intraday noise.',
      },
      {
        heading: 'Macro Matters',
        text: 'Rates, inflation, dollar strength, and volatility set the backdrop. Strong DXY or rising yields can pressure growth assets even when the chart still looks healthy.',
      },
    ],
  },
  {
    id: 'technical-analysis',
    title: 'Technical Analysis',
    icon: BarChart2,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10 border-accent-blue/20',
    summary: 'Use a few tools well: trend, momentum, volatility, and key levels.',
    content: [
      {
        heading: 'Trend + Momentum',
        text: 'Moving averages tell you direction; RSI and MACD help gauge pace. A setup is stronger when trend and momentum agree instead of fighting each other.',
      },
      {
        heading: 'Support, Resistance, Volume',
        text: 'Levels matter more when they have repeated reactions and strong participation. Breakouts without volume are easier to fade; breakouts with volume are easier to trust.',
      },
      {
        heading: 'Confirmation Over Prediction',
        text: 'Candles and patterns are context tools, not guarantees. A hammer at support in an uptrend is useful; the same candle in the middle of a messy range is weak information.',
      },
    ],
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    icon: ShieldAlert,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    summary: 'Edge survives only if sizing, stops, and drawdown control are disciplined.',
    content: [
      {
        heading: 'Position Size Before Entry',
        text: 'Risk the amount you are willing to lose first, then calculate size from stop distance. Small consistent losses are manageable; oversized trades destroy good systems.',
      },
      {
        heading: 'Use Volatility-Aware Stops',
        text: 'ATR-based stops are usually better than arbitrary percentages. If an asset regularly swings 3% a day, a 1% stop is often just noise.',
      },
      {
        heading: 'Protect the Equity Curve',
        text: 'Max drawdown matters more than a single winning trade. A strategy that compounds steadily with shallow drawdowns is more durable than one with occasional huge wins.',
      },
    ],
  },
  {
    id: 'machine-learning',
    title: 'ML Model Reading',
    icon: Brain,
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10 border-fuchsia-500/20',
    summary: 'Treat forecasts as probability tools, not certainty machines.',
    content: [
      {
        heading: 'What The Models Do',
        text: 'N-HiTS is strong for multi-horizon time-series forecasting, LightGBM is fast and good with engineered features, and ensembles work because different models fail in different ways.',
      },
      {
        heading: 'Validate Properly',
        text: 'Walk-forward testing is the standard because it preserves time order. If validation leaks the future, backtest quality is overstated and the live result disappoints.',
      },
      {
        heading: 'Confidence Is A Range',
        text: 'Prediction intervals matter as much as the central forecast. Wide bands mean low conviction and usually argue for smaller size or no trade.',
      },
    ],
  },
  {
    id: 'trading-playbooks',
    title: 'Trading Playbooks',
    icon: Target,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    summary: 'Keep execution styles simple and aligned to the market regime.',
    content: [
      {
        heading: 'Trend Following',
        text: 'Best when price is above major moving averages and ADX is rising. The goal is not to buy the bottom but to stay with strength while trailing risk.',
      },
      {
        heading: 'Mean Reversion',
        text: 'Best when price is stretched inside a range and momentum is exhausted. Use it carefully in strong trends because oversold can stay oversold.',
      },
      {
        heading: 'Breakout And DCA',
        text: 'Breakouts need confirmation and follow-through; DCA is better for long-term accumulation where timing precision matters less than consistency.',
      },
    ],
  },
]

const MARKET_CHECKLIST = [
  {
    title: 'Trend',
    text: 'Is price above or below the major averages? Trade with the dominant direction before looking for fine-tuned entries.',
  },
  {
    title: 'Momentum',
    text: 'Check RSI or MACD to see whether the move is strengthening, slowing, or diverging.',
  },
  {
    title: 'Volatility',
    text: 'Use ATR, Bollinger compression, or VIX to judge how wide stops and targets should be.',
  },
  {
    title: 'Catalysts',
    text: 'Macro data, earnings, and crypto headlines can invalidate a clean chart very quickly.',
  },
]

const CORE_INDICATORS = [
  {
    name: '50 / 200 SMA',
    use: 'Primary trend filter',
    bullish: '50 above 200, price holds above both',
    bearish: '50 below 200, rallies fail under both',
  },
  {
    name: 'RSI (14)',
    use: 'Momentum and exhaustion',
    bullish: 'Reclaims 50 or turns up from oversold',
    bearish: 'Loses 50 or rolls over from overbought',
  },
  {
    name: 'MACD',
    use: 'Momentum confirmation',
    bullish: 'MACD crosses above signal with expanding histogram',
    bearish: 'MACD crosses below signal with weakening histogram',
  },
  {
    name: 'Bollinger Bands',
    use: 'Volatility and stretch',
    bullish: 'Rebound from lower band in healthy uptrend',
    bearish: 'Rejection from upper band in healthy downtrend',
  },
  {
    name: 'ADX (14)',
    use: 'Trend strength',
    bullish: 'Above 25 with +DI leading',
    bearish: 'Above 25 with -DI leading',
  },
  {
    name: 'ATR (14)',
    use: 'Risk and stop placement',
    bullish: 'Rising ATR can validate a directional move',
    bearish: 'ATR spike after extension can warn of exhaustion',
  },
]

const PATTERN_GUIDE = [
  {
    name: 'Hammer',
    type: 'Bullish reversal',
    bestUse: 'At support after a selloff',
  },
  {
    name: 'Shooting Star',
    type: 'Bearish reversal',
    bestUse: 'At resistance after an extended push',
  },
  {
    name: 'Engulfing',
    type: 'Momentum reversal',
    bestUse: 'When the new candle fully takes control of the prior bar',
  },
  {
    name: 'Doji',
    type: 'Indecision',
    bestUse: 'Useful only when it appears at a major level or after a strong move',
  },
  {
    name: 'Three Soldiers / Crows',
    type: 'Trend continuation',
    bestUse: 'Confirms sustained buying or selling pressure',
  },
]

function ConceptSection({ concept, isOpen, onToggle }) {
  const Icon = concept.icon

  return (
    <div className={`rounded-xl border transition-colors ${isOpen ? concept.bg : 'border-surface-border bg-surface-card hover:border-surface-border/80'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOpen ? concept.bg : 'bg-surface-hover'}`}>
          <Icon className={`w-5 h-5 ${concept.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{concept.title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{concept.summary}</p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3">
          {concept.content.map((item) => (
            <div key={item.heading} className="bg-surface/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-white mb-2">{item.heading}</h4>
              <p className="text-sm text-gray-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MarketCard({ label, price, change, icon: Icon, color }) {
  const isUp = change >= 0

  return (
    <div className="card flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-base font-bold text-white font-mono">
          {typeof price === 'number'
            ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            : '—'}
        </p>
      </div>
      {change != null && (
        <div className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </div>
      )}
    </div>
  )
}

function MacroStat({ label, value, unit }) {
  return (
    <div className="bg-surface-hover rounded-lg px-4 py-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-white font-mono">
        {value != null ? (typeof value === 'number' ? value.toFixed(2) : value) : '—'}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  )
}

export default function LearnPage() {
  const [openSection, setOpenSection] = useState('market-framework')
  const [quotes, setQuotes] = useState({})
  const [macro, setMacro] = useState(null)
  const [fng, setFng] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      try {
        const assets = ['BTC', 'GOLD', 'AAPL', 'TSLA', 'SPY', 'ETH']
        const [quotesRes, macroRes, fngRes] = await Promise.allSettled([
          marketApi.getQuotes(assets),
          macroApi.getSummary(),
          macroApi.getFearGreed(1),
        ])

        if (quotesRes.status === 'fulfilled') {
          setQuotes(Object.fromEntries((quotesRes.value.data ?? []).map((quote) => [quote.asset, quote])))
        }

        if (macroRes.status === 'fulfilled') {
          setMacro(macroRes.value?.data ?? null)
        }

        if (fngRes.status === 'fulfilled') {
          const fngData = fngRes.value?.data
          setFng(fngData?.current ?? fngData)
        }
      } catch (error) {
        console.warn('Failed to fetch market data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  const macroVal = (key) => {
    if (!macro) return null
    const entry = macro[key]
    if (entry && typeof entry === 'object' && 'value' in entry) return entry.value
    if (typeof entry === 'number') return entry
    return null
  }

  const fngValue = fng?.value ?? fng?.data?.[0]?.value ?? null
  const fngClass = fng?.classification ?? fng?.value_classification ?? fng?.data?.[0]?.value_classification ?? null

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent-blue" />
          Learn & Markets
        </h1>
        <p className="text-gray-400 text-sm mt-1 max-w-3xl">
          A condensed market briefing: live context, the core concepts that matter, and the minimum indicator set worth knowing.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent-blue" />
          Market Snapshot
        </h2>

        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <MarketCard
                label="Bitcoin (BTC)"
                price={quotes.BTC?.price}
                change={quotes.BTC?.change_24h_pct}
                icon={TrendingUp}
                color="bg-orange-500/10 text-orange-400"
              />
              <MarketCard
                label="Ethereum (ETH)"
                price={quotes.ETH?.price}
                change={quotes.ETH?.change_24h_pct}
                icon={TrendingUp}
                color="bg-blue-500/10 text-blue-400"
              />
              <MarketCard
                label="Gold (XAU/USD)"
                price={quotes.GOLD?.price}
                change={quotes.GOLD?.change_24h_pct}
                icon={DollarSign}
                color="bg-yellow-500/10 text-yellow-400"
              />
              <MarketCard
                label="Apple (AAPL)"
                price={quotes.AAPL?.price}
                change={quotes.AAPL?.change_24h_pct}
                icon={BarChart2}
                color="bg-gray-500/10 text-gray-400"
              />
              <MarketCard
                label="Tesla (TSLA)"
                price={quotes.TSLA?.price}
                change={quotes.TSLA?.change_24h_pct}
                icon={Activity}
                color="bg-red-500/10 text-red-400"
              />
              <MarketCard
                label="S&P 500 (SPY)"
                price={quotes.SPY?.price}
                change={quotes.SPY?.change_24h_pct}
                icon={TrendingUp}
                color="bg-green-500/10 text-green-400"
              />
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Macro Panel</h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">Rates · Inflation · Risk</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MacroStat label="Fed Funds" value={macroVal('fed_funds_rate')} unit="%" />
                <MacroStat label="CPI (YoY)" value={macroVal('cpi_yoy')} unit="%" />
                <MacroStat label="10Y Treasury" value={macroVal('treasury_10y')} unit="%" />
                <MacroStat label="Unemployment" value={macroVal('unemployment')} unit="%" />
                <MacroStat label="DXY" value={macroVal('dxy')} unit="" />
                <MacroStat label="VIX" value={macroVal('vix')} unit="" />
              </div>
            </div>

            {fngValue != null && (
              <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${
                fngValue >= 60
                  ? 'bg-green-500/10 border-green-500/20'
                  : fngValue <= 40
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                <Gauge className={`w-6 h-6 ${
                  fngValue >= 60
                    ? 'text-green-400'
                    : fngValue <= 40
                      ? 'text-red-400'
                      : 'text-yellow-400'
                }`} />
                <div>
                  <p className="text-xs text-gray-400">Crypto Fear & Greed</p>
                  <p className="text-lg font-bold text-white">
                    {fngValue}
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      {fngClass ?? (
                        fngValue >= 75
                          ? 'Extreme Greed'
                          : fngValue >= 60
                            ? 'Greed'
                            : fngValue >= 40
                              ? 'Neutral'
                              : fngValue >= 25
                                ? 'Fear'
                                : 'Extreme Fear'
                      )}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <LineIcon className="w-4 h-4 text-accent-blue" />
          How To Read A Market Fast
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          A simple sequence that prevents over-analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MARKET_CHECKLIST.map((item) => (
            <div key={item.title} className="rounded-lg border border-surface-border bg-surface/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-blue" />
          Core Learning Modules
          <span className="font-mono text-[10px] text-gray-500 ml-1">· {TRADING_CONCEPTS.length} essentials</span>
        </h2>
        <div className="space-y-3">
          {TRADING_CONCEPTS.map((concept) => (
            <ConceptSection
              key={concept.id}
              concept={concept}
              isOpen={openSection === concept.id}
              onToggle={() => toggleSection(concept.id)}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-blue" />
          Core Indicator Cheat Sheet
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          These six do most of the work. Learn them before adding more.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Indicator</th>
                <th className="pb-2 pr-4 font-medium">Best For</th>
                <th className="pb-2 pr-4 font-medium text-green-400">Bullish Read</th>
                <th className="pb-2 font-medium text-red-400">Bearish Read</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {CORE_INDICATORS.map((indicator, index) => (
                <tr
                  key={indicator.name}
                  className={index === CORE_INDICATORS.length - 1 ? '' : 'border-b border-surface-border/50'}
                >
                  <td className="py-2 pr-4 font-medium text-white">{indicator.name}</td>
                  <td className="py-2 pr-4 text-gray-400">{indicator.use}</td>
                  <td className="py-2 pr-4 text-green-400">{indicator.bullish}</td>
                  <td className="py-2 text-red-400">{indicator.bearish}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-accent-blue" />
          Pattern Cheat Sheet
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Price patterns are strongest when they appear at meaningful levels and with confirmation.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Pattern</th>
                <th className="pb-2 pr-4 font-medium">Message</th>
                <th className="pb-2 font-medium">Best Use</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {PATTERN_GUIDE.map((pattern, index) => (
                <tr
                  key={pattern.name}
                  className={index === PATTERN_GUIDE.length - 1 ? '' : 'border-b border-surface-border/50'}
                >
                  <td className="py-2 pr-4 font-medium text-white">{pattern.name}</td>
                  <td className="py-2 pr-4">{pattern.type}</td>
                  <td className="py-2 text-gray-400">{pattern.bestUse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-xs text-gray-600 pb-6">
        Use this page as a framework, not a script. Context, risk sizing, and discipline matter more than any single signal.
      </p>
    </div>
  )
}
