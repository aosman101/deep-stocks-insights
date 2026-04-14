import { useState, useEffect } from 'react'
import { macroApi, marketApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  BookOpen, TrendingUp, TrendingDown, Globe, BarChart2,
  ShieldAlert, Target, Brain, Layers, ChevronDown, ChevronUp,
  DollarSign, Activity, Gauge, ArrowUpRight, ArrowDownRight,
  Clock, Coins, Scale, AlertTriangle, Calculator, Network,
  Search, BookMarked,
} from 'lucide-react'

// ─── Trading concepts data ──────────────────────────────────
const TRADING_CONCEPTS = [
  {
    id: 'technical-analysis',
    title: 'Technical Analysis',
    icon: BarChart2,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10 border-accent-blue/20',
    summary: 'Analysing price charts and patterns to forecast future movements.',
    content: [
      {
        heading: 'Moving Averages (SMA / EMA)',
        text: 'Moving averages smooth price data to reveal the underlying trend. The Simple Moving Average (SMA) gives equal weight to all prices in the window, while the Exponential Moving Average (EMA) weights recent prices more heavily, making it more responsive to new information. A common strategy is the "Golden Cross" — when the 50-day SMA crosses above the 200-day SMA, signalling a bullish trend reversal.',
      },
      {
        heading: 'Relative Strength Index (RSI)',
        text: 'RSI measures the speed and magnitude of recent price changes on a scale of 0-100. Readings below 30 suggest an asset is oversold (potential buy), while readings above 70 suggest overbought conditions (potential sell). RSI divergences — where price makes new highs but RSI does not — can signal an impending reversal.',
      },
      {
        heading: 'MACD (Moving Average Convergence Divergence)',
        text: 'MACD tracks the relationship between two EMAs (typically 12 and 26 periods). The MACD line crossing above the signal line is a bullish signal; crossing below is bearish. The histogram shows the distance between the two lines — growing bars indicate strengthening momentum.',
      },
      {
        heading: 'Bollinger Bands',
        text: 'Bollinger Bands place a band 2 standard deviations above and below a 20-period SMA. When price touches the lower band, the asset may be oversold; touching the upper band may indicate overbought conditions. A "squeeze" (narrowing bands) often precedes a sharp move in either direction.',
      },
      {
        heading: 'Support & Resistance',
        text: 'Support is a price level where demand is strong enough to prevent further decline. Resistance is where supply overwhelms demand and prevents further advance. These levels are identified from historical price action — previous highs, lows, and areas of consolidation. Breakouts above resistance or below support often lead to significant moves.',
      },
    ],
  },
  {
    id: 'fundamental-analysis',
    title: 'Fundamental Analysis',
    icon: Layers,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    summary: 'Evaluating the intrinsic value of an asset based on financial data and economic factors.',
    content: [
      {
        heading: 'Earnings & Revenue',
        text: 'For stocks, quarterly earnings reports are the most important fundamental catalyst. Revenue growth shows whether a company is expanding. Earnings per share (EPS) beats or misses relative to analyst expectations often drive sharp price moves. Look for consistent revenue growth alongside expanding profit margins.',
      },
      {
        heading: 'P/E Ratio & Valuation Metrics',
        text: 'The Price-to-Earnings (P/E) ratio compares a stock\'s price to its earnings per share. A high P/E may indicate overvaluation or high growth expectations. Compare P/E against the sector average and the company\'s historical range. Other metrics like P/S (Price-to-Sales) and P/B (Price-to-Book) provide additional valuation perspectives.',
      },
      {
        heading: 'Crypto Fundamentals',
        text: 'Cryptocurrency valuation differs from traditional stocks. Key metrics include: on-chain activity (active addresses, transaction volume), network hash rate (for proof-of-work coins), total value locked (TVL) in DeFi, developer activity on GitHub, and token supply dynamics (halving events, token burns, staking ratios).',
      },
      {
        heading: 'Macroeconomic Indicators',
        text: 'Central bank interest rates, inflation (CPI), GDP growth, and unemployment data all impact asset prices. Higher interest rates tend to strengthen the dollar and weigh on risk assets. Gold traditionally benefits from inflation fears and economic uncertainty. Bitcoin increasingly responds to liquidity conditions and real interest rates.',
      },
    ],
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    icon: ShieldAlert,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    summary: 'Protecting your capital is more important than maximising returns.',
    content: [
      {
        heading: 'Position Sizing',
        text: 'Never risk more than 1-2% of your total portfolio on a single trade. If your account is $10,000 and your stop loss is 5% below entry, your position should be no larger than $2,000-$4,000. This ensures that a string of losses won\'t devastate your portfolio. Professional traders prioritise capital preservation above all else.',
      },
      {
        heading: 'Stop-Loss Orders',
        text: 'A stop-loss automatically exits a position when it moves against you by a defined amount. ATR-based stops (using the Average True Range) adapt to market volatility — in calm markets, stops are tighter; in volatile markets, they are wider. Deep Stock Insights provides three tiers: conservative (2x ATR), standard (1.5x ATR), and aggressive (1x ATR).',
      },
      {
        heading: 'Risk-Reward Ratio',
        text: 'Before entering any trade, calculate the potential reward versus the potential risk. A minimum 2:1 risk-reward ratio means you need to be right only 33% of the time to break even. If your stop loss is $50 below entry, your take-profit target should be at least $100 above entry.',
      },
      {
        heading: 'Diversification',
        text: 'Spread your investments across different asset classes (stocks, crypto, commodities), sectors, and geographies. Correlation matters: during market crashes, highly correlated assets tend to fall together. Gold and Bitcoin sometimes act as hedges, but their correlation with equities varies over time.',
      },
    ],
  },
  {
    id: 'ml-models',
    title: 'Machine Learning in Trading',
    icon: Brain,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    summary: 'How Deep Stock Insights uses AI to generate predictions and signals.',
    content: [
      {
        heading: 'N-HiTS (Neural Hierarchical Interpolation for Time Series)',
        text: 'N-HiTS is a hierarchical forecasting architecture that pools temporal patterns at multiple resolutions before reconstructing forecasts. Deep Stock Insights uses an N-HiTS-style network on 50-day sliding windows of OHLCV data plus technical indicators to produce fast multi-horizon forecasts with uncertainty bands.',
      },
      {
        heading: 'LightGBM (Light Gradient Boosting Machine)',
        text: 'LightGBM is a histogram-based gradient boosting tree model optimized for speed and strong performance on tabular features. Deep Stock Insights trains a LightGBM classifier (BUY/HOLD/SELL direction) and regressor (next-day price) for every asset using engineered signals such as price lags, momentum, volatility, and volume metrics.',
      },
      {
        heading: 'Monte Carlo Dropout',
        text: 'A key challenge with neural network predictions is knowing how confident the model is. Monte Carlo Dropout runs multiple forward passes through the N-HiTS network with dropout enabled, producing a distribution of predictions. The spread of this distribution gives an uncertainty estimate — wider spreads indicate less confidence. Deep Stock Insights uses 50 MC samples to generate 90% confidence intervals.',
      },
      {
        heading: 'Limitations & Caveats',
        text: 'ML models are trained on historical data and assume the future will resemble the past. They cannot predict black swan events, regulatory changes, or sudden shifts in market structure. Models can overfit to noise, especially with limited training data. Always combine model outputs with fundamental analysis and risk management — no model is infallible.',
      },
    ],
  },
  {
    id: 'trading-strategies',
    title: 'Trading Strategies',
    icon: Target,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    summary: 'Common approaches used by traders across different timeframes.',
    content: [
      {
        heading: 'Trend Following',
        text: 'The core principle: "the trend is your friend." Trend followers buy assets in uptrends (price above key moving averages, ADX > 25) and sell short in downtrends. They let winners run with trailing stops and cut losers quickly. This strategy works well in strongly trending markets but suffers during sideways ranges.',
      },
      {
        heading: 'Mean Reversion',
        text: 'Mean reversion assumes that prices tend to return to their average over time. When RSI drops below 30 or price touches the lower Bollinger Band, a mean-reversion trader would buy, expecting a bounce. This strategy works in ranging markets but can be dangerous during strong trends or crashes.',
      },
      {
        heading: 'Breakout Trading',
        text: 'Breakout traders identify key support/resistance levels and enter when price breaks through with high volume. The idea is that a breakout signals a new trend. False breakouts are common, so confirmation via volume and follow-through is critical. Pivot points and Fibonacci levels can help identify potential breakout zones.',
      },
      {
        heading: 'Dollar-Cost Averaging (DCA)',
        text: 'For long-term investors, DCA involves investing a fixed amount at regular intervals regardless of price. This removes the emotional pressure of timing the market. Over time, you accumulate more shares when prices are low and fewer when prices are high, resulting in a lower average cost basis.',
      },
    ],
  },
]

// ─── Accordion section ──────────────────────────────────────
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
        {isOpen
          ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        }
      </button>
      {isOpen && (
        <div className="px-5 pb-5 space-y-4">
          {concept.content.map((item, i) => (
            <div key={i} className="bg-surface/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-white mb-2">{item.heading}</h4>
              <p className="text-sm text-gray-300 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Market overview card ───────────────────────────────────
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

// ─── Macro stat pill ────────────────────────────────────────
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

// ─── Main page ──────────────────────────────────────────────
export default function LearnPage() {
  const [openSection, setOpenSection] = useState('technical-analysis')
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
          setQuotes(Object.fromEntries((quotesRes.value.data ?? []).map(quote => [quote.asset, quote])))
        }

        if (macroRes.status === 'fulfilled') setMacro(macroRes.value?.data ?? null)
        if (fngRes.status === 'fulfilled') {
          const fngData = fngRes.value?.data
          setFng(fngData?.current ?? fngData)
        }
      } catch (e) {
        console.warn('Failed to fetch market data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleSection = (id) => {
    setOpenSection(prev => prev === id ? null : id)
  }

  // Extract macro values safely
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
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent-blue" />
          Trading Education & Global Markets
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Learn key trading concepts, understand how our AI models work, and stay informed on global market conditions.
        </p>
      </div>

      {/* ── Global Markets Overview ─────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent-blue" />
          Global Markets Overview
        </h2>

        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live price grid */}
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

            {/* Macro indicators row */}
            <div className="card">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Macro Indicators</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MacroStat label="Fed Funds Rate" value={macroVal('fed_funds_rate')} unit="%" />
                <MacroStat label="CPI (YoY)" value={macroVal('cpi_yoy')} unit="%" />
                <MacroStat label="10Y Treasury" value={macroVal('treasury_10y')} unit="%" />
                <MacroStat label="Unemployment" value={macroVal('unemployment')} unit="%" />
                <MacroStat label="USD Index (DXY)" value={macroVal('dxy')} unit="" />
                <MacroStat label="VIX" value={macroVal('vix')} unit="" />
              </div>
            </div>

            {/* Fear & Greed */}
            {fngValue != null && (
              <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${
                fngValue >= 60 ? 'bg-green-500/10 border-green-500/20' :
                fngValue <= 40 ? 'bg-red-500/10 border-red-500/20' :
                'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                <Gauge className={`w-6 h-6 ${
                  fngValue >= 60 ? 'text-green-400' :
                  fngValue <= 40 ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div>
                  <p className="text-xs text-gray-400">Crypto Fear & Greed Index</p>
                  <p className="text-lg font-bold text-white">
                    {fngValue}
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      — {fngClass ?? (fngValue >= 75 ? 'Extreme Greed' : fngValue >= 60 ? 'Greed' : fngValue >= 40 ? 'Neutral' : fngValue >= 25 ? 'Fear' : 'Extreme Fear')}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Trading Education ───────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-blue" />
          Trading Concepts
        </h2>
        <div className="space-y-3">
          {TRADING_CONCEPTS.map(concept => (
            <ConceptSection
              key={concept.id}
              concept={concept}
              isOpen={openSection === concept.id}
              onToggle={() => toggleSection(concept.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Market Insight Tips ─────────────────────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-accent-blue" />
          Quick Reference: Indicator Signals
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Indicator</th>
                <th className="pb-2 pr-4 font-medium text-green-400">Bullish Signal</th>
                <th className="pb-2 pr-4 font-medium text-red-400">Bearish Signal</th>
                <th className="pb-2 font-medium text-yellow-400">Neutral</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">RSI (14)</td>
                <td className="py-2 pr-4 text-green-400">Below 30 (oversold)</td>
                <td className="py-2 pr-4 text-red-400">Above 70 (overbought)</td>
                <td className="py-2 text-gray-400">30-70</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">MACD</td>
                <td className="py-2 pr-4 text-green-400">MACD crosses above signal</td>
                <td className="py-2 pr-4 text-red-400">MACD crosses below signal</td>
                <td className="py-2 text-gray-400">Lines converging</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Bollinger %B</td>
                <td className="py-2 pr-4 text-green-400">Below 0.2 (near lower band)</td>
                <td className="py-2 pr-4 text-red-400">Above 0.8 (near upper band)</td>
                <td className="py-2 text-gray-400">0.2-0.8</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">ADX</td>
                <td className="py-2 pr-4 text-green-400">Above 25 + DI+ {'>'} DI-</td>
                <td className="py-2 pr-4 text-red-400">Above 25 + DI- {'>'} DI+</td>
                <td className="py-2 text-gray-400">Below 25 (weak trend)</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Stochastic</td>
                <td className="py-2 pr-4 text-green-400">K crosses above D below 20</td>
                <td className="py-2 pr-4 text-red-400">K crosses below D above 80</td>
                <td className="py-2 text-gray-400">20-80</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">Volume</td>
                <td className="py-2 pr-4 text-green-400">Rising price + rising volume</td>
                <td className="py-2 pr-4 text-red-400">Rising price + falling volume</td>
                <td className="py-2 text-gray-400">Average volume</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-600 pb-6">
        Always do your own research and consult a qualified financial advisor before making investment decisions.
      </p>
    </div>
  )
}
