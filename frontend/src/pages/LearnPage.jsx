import { useState, useEffect } from 'react'
import { macroApi, marketApi } from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  BookOpen, TrendingUp, TrendingDown, Globe, BarChart2,
  ShieldAlert, Target, Brain, Layers, ChevronDown, ChevronUp,
  DollarSign, Activity, Gauge, ArrowUpRight, ArrowDownRight,
  Coins, Scale, AlertTriangle, Calculator, Network,
  Candy, Sigma, LineChart as LineIcon,
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
        text: 'Support is a price level where demand is strong enough to prevent further decline. Resistance is where supply overwhelms demand and prevents further advance. These levels are identified from historical price action — previous highs, lows, and areas of consolidation. Breakouts above resistance or below support often lead to significant moves. The more times a level is tested without breaking, the stronger it becomes — until the one test that finally breaks it.',
      },
      {
        heading: 'Candlestick Patterns',
        text: 'Individual candles encode open, high, low, and close. Key reversal patterns: Hammer (long lower wick at support = bullish reversal), Shooting Star (long upper wick at resistance = bearish reversal), Engulfing (current candle completely swallows prior = strong momentum shift), Doji (open ≈ close = indecision). Three White Soldiers and Three Black Crows confirm sustained momentum. Always confirm with volume and location in the trend.',
      },
      {
        heading: 'Chart Patterns',
        text: 'Classical technical patterns: Head & Shoulders (bearish reversal — left shoulder, higher head, right shoulder at same height), Inverse H&S (bullish version), Double Top / Double Bottom (two failed attempts at a level), Cup & Handle (bullish continuation after consolidation), Ascending/Descending Triangles (continuation patterns with measurable price targets equal to the triangle\'s widest point projected from the breakout).',
      },
      {
        heading: 'Fibonacci Retracements',
        text: 'After a strong move, price often retraces a portion before continuing. The key Fibonacci levels — 23.6%, 38.2%, 50%, 61.8%, 78.6% — are watched by millions of traders, making them self-fulfilling. A 50% retracement of a rally is considered healthy; deeper than 61.8% suggests the trend is failing. Extensions (127.2%, 161.8%, 261.8%) are used to project targets beyond the prior high.',
      },
      {
        heading: 'Volume Analysis',
        text: 'Volume confirms price. A breakout on low volume is suspect; a breakout on 2x-3x average volume is legitimate. Volume-Weighted Average Price (VWAP) is the institutional benchmark — price above VWAP favours bulls, below favours bears. Volume Profile shows where the most shares traded at each price, revealing "high-volume nodes" (strong S/R) and "low-volume gaps" (price moves through quickly).',
      },
      {
        heading: 'Ichimoku Cloud',
        text: 'A complete trend-following system in one indicator. The "cloud" (Kumo) is projected 26 periods ahead — price above the cloud = bullish, below = bearish, inside = no trade. The Tenkan (9) and Kijun (26) lines act as fast/slow MAs. The Chikou Span (current close plotted 26 bars back) confirms momentum. Popular in Japanese markets and for higher timeframe trend identification.',
      },
      {
        heading: 'Divergence Trading',
        text: 'A divergence occurs when price and an indicator disagree. Regular Bullish: price makes lower low, RSI makes higher low (reversal signal up). Regular Bearish: price higher high, RSI lower high (reversal down). Hidden Bullish: price higher low, RSI lower low (continuation of uptrend). Divergences on higher timeframes (4H, daily) are much more reliable than on 5-minute charts.',
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
      {
        heading: 'Free Cash Flow (FCF)',
        text: 'FCF = Operating Cash Flow − Capital Expenditures. It\'s the cash a company generates after funding operations and maintaining assets — money available for dividends, buybacks, debt reduction, or growth. Warren Buffett prefers FCF to earnings because it\'s harder to manipulate. A company with growing FCF and a FCF yield (FCF / Market Cap) above the 10-year Treasury yield often represents good value.',
      },
      {
        heading: 'Balance Sheet Health',
        text: 'Key solvency ratios: Current Ratio (current assets / current liabilities) should be > 1.5. Debt-to-Equity < 1 indicates conservative financing. Interest Coverage (EBIT / interest expense) should be > 3x — below 1.5 is a red flag. Net Debt / EBITDA < 3x is considered safe for most industries. Companies entering recession with weak balance sheets are the ones that get crushed.',
      },
      {
        heading: 'Return on Invested Capital (ROIC)',
        text: 'ROIC = NOPAT / Invested Capital. It measures how efficiently a company turns capital into profit. Companies with sustained ROIC > 15% have durable competitive advantages (economic moats). ROIC vs WACC (Weighted Average Cost of Capital) is the ultimate test — if ROIC exceeds WACC, the company creates shareholder value; if not, it destroys it.',
      },
      {
        heading: 'Sector Rotation',
        text: 'Different sectors lead at different stages of the economic cycle. Early recovery: Financials, Consumer Discretionary, Industrials. Mid-cycle: Technology, Industrials. Late cycle: Energy, Materials. Recession: Consumer Staples, Utilities, Healthcare (defensive). Watching relative strength between sectors (e.g., XLP vs XLY ratio) gives clues about where the economy is in the cycle.',
      },
      {
        heading: 'Insider Transactions',
        text: 'Corporate insiders (CEOs, directors, 10%+ shareholders) must disclose trades via SEC Form 4 within 2 business days. Insiders sell for many reasons (diversification, tax, lifestyle) but buy for only one — they think the stock is going up. Clusters of insider buying near 52-week lows, especially by CFOs, have historically preceded strong returns.',
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
      {
        heading: 'The Kelly Criterion',
        text: 'Kelly %: f* = (bp − q) / b, where b = odds, p = win probability, q = loss probability. This formula gives the mathematically optimal bet size to maximise long-term growth. Full Kelly is often too aggressive — most professionals use "Half Kelly" (half the recommended size) to reduce volatility. If you have a 55% win rate with 1:1 payoff, Kelly says bet 10% of capital; Half Kelly says 5%.',
      },
      {
        heading: 'Maximum Drawdown Tolerance',
        text: 'Before funding a strategy, decide the maximum drawdown you can psychologically tolerate — NOT financially, psychologically. Most traders abandon strategies at 20-30% drawdown regardless of their stated tolerance. A system with 40% historical max DD will almost certainly exceed that live. Plan for drawdowns 1.5x worse than any seen in backtesting.',
      },
      {
        heading: 'Hedging Techniques',
        text: 'Protective Put — buy a put option to insure long stock against a crash (cost: the premium). Collar — sell a call above current price to fund the protective put (caps upside). Inverse ETFs (SH, SQQQ) provide short exposure in a regular brokerage account. Futures hedging — short ES futures against an equity portfolio. Each hedge costs something; the question is whether the protection is worth the cost.',
      },
      {
        heading: 'Black Swan Protection',
        text: 'Nassim Taleb\'s "barbell strategy": keep 85-90% in very safe assets (Treasuries, cash) and 10-15% in extremely high-risk / high-reward bets (deep OTM options, small crypto positions). This caps downside while preserving massive upside from rare events. The 2020 pandemic and 2008 crash rewarded those holding long-dated volatility positions by 10-100x.',
      },
      {
        heading: 'The 1% Rule & Martingale Trap',
        text: 'Never risk more than 1% of your account on a single trade. Even a brilliant trader loses 40%+ of the time. Ten losses at 1% = -10% drawdown (recoverable). Ten losses at 5% = -40% drawdown (account-killer). NEVER use Martingale (doubling down after losses) — a 7-loss streak wipes out 128x your base bet. The math guarantees ruin.',
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
      {
        heading: 'LSTM (Long Short-Term Memory)',
        text: 'LSTMs are recurrent neural networks designed to remember long sequences without the "vanishing gradient" problem of vanilla RNNs. They use three gates (forget, input, output) to control what information persists. In finance, LSTMs excel at capturing sequence dependencies in OHLCV data — recognising that a 3-day pullback within an uptrend is structurally different from a 3-day crash. Deep Stock Insights uses LSTMs as a baseline architecture against which N-HiTS is compared.',
      },
      {
        heading: 'Temporal Fusion Transformer (TFT)',
        text: 'TFT combines the attention mechanism from Transformers with LSTM encoders to handle multi-horizon forecasting with both static and time-varying features. Its key innovation is interpretability — TFT produces attention weights showing WHICH historical timestamps and WHICH features drove each prediction. For a stock forecast, you can see "the model is paying 40% attention to the VIX spike 5 days ago."',
      },
      {
        heading: 'Feature Engineering',
        text: 'Raw OHLCV data is rarely fed directly into models. Engineered features dramatically improve performance: returns (instead of prices), log returns (for normality), rolling volatility, price relative to moving averages, regime indicators (bull/bear flags), calendar features (day-of-week, month-end effects), and cross-asset signals (BTC price for Ethereum model). Feature selection via SHAP values identifies which inputs actually matter.',
      },
      {
        heading: 'Walk-Forward Validation',
        text: 'Standard k-fold cross-validation leaks future information into training and gives misleadingly optimistic results. Walk-forward validation trains on [2010-2015], validates on 2016; then trains on [2010-2016], validates on 2017; and so on. This mimics how the model would actually be deployed. A strategy that looks great on standard CV but breaks on walk-forward is overfit — a very common failure mode.',
      },
      {
        heading: 'Regime Detection',
        text: 'Markets cycle through regimes: trending, mean-reverting, high-volatility, low-volatility. A single model rarely performs well across all regimes. Advanced systems use Hidden Markov Models (HMM) or rule-based classifiers to detect the current regime, then apply a specialist model. Simple proxies: VIX > 25 = high-vol regime; ADX > 25 = trending; ADX < 20 = range-bound.',
      },
      {
        heading: 'Ensemble Methods',
        text: 'Why Deep Stock Insights uses an ensemble: no single model is best in all conditions. N-HiTS excels at smooth trends; LightGBM captures nonlinear feature interactions; TFT handles regime shifts. Simple averaging, weighted voting, or stacking (meta-model that learns which base model to trust when) all outperform any individual component. The diversity of errors matters more than individual accuracy.',
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
      {
        heading: 'Pairs Trading (Market-Neutral)',
        text: 'Pairs trading involves going long one asset and short another correlated asset, profiting from the spread returning to its historical relationship. For example: long Coca-Cola, short Pepsi when the ratio deviates 2 standard deviations from its 60-day mean. This hedges out broad market moves, leaving only the relative performance.',
      },
      {
        heading: 'Swing vs Day vs Position Trading',
        text: 'Day traders close all positions before market close to avoid overnight risk. Swing traders hold for days to weeks, capturing medium-term moves. Position traders hold for months to years, focusing on long-term trends and fundamentals. Each timeframe has different tax implications, stress levels, and capital requirements.',
      },
    ],
  },
  {
    id: 'options-derivatives',
    title: 'Options & Derivatives',
    icon: Calculator,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    summary: 'Leveraged instruments that derive value from an underlying asset.',
    content: [
      {
        heading: 'Calls & Puts — The Basics',
        text: 'A CALL option gives you the right (not obligation) to BUY an asset at a fixed strike price before expiration. A PUT gives you the right to SELL. You pay a premium for this right. Buying calls expresses a bullish view with limited downside (just the premium paid). Buying puts is a hedge or bearish bet.',
      },
      {
        heading: 'The Greeks',
        text: 'Delta (Δ) — sensitivity to underlying price (0.5 delta = $0.50 move per $1 move in stock). Gamma (Γ) — rate of change of delta. Theta (Θ) — time decay; how much value the option loses per day. Vega (ν) — sensitivity to implied volatility. Rho (ρ) — sensitivity to interest rates. Understanding these is essential before trading options.',
      },
      {
        heading: 'Implied Volatility (IV)',
        text: 'IV is the market\'s forward-looking estimate of how volatile an asset will be. High IV means expensive options; low IV means cheap options. Many strategies (iron condors, credit spreads) profit from IV contraction. Before earnings, IV spikes — then collapses after the announcement ("IV crush"). Professional traders watch IV rank and IV percentile.',
      },
      {
        heading: 'Common Strategies',
        text: 'Covered Call — own 100 shares, sell a call above current price to earn premium. Cash-Secured Put — sell a put below current price; if assigned, you buy the stock at a discount. Vertical Spread — buy one option and sell another at a different strike to cap risk. Iron Condor — sell both a call spread and put spread, profiting if the stock stays in a range.',
      },
      {
        heading: 'Futures & Perpetuals',
        text: 'Futures contracts lock in a price today for delivery at a future date. Crypto perpetual futures (perps) never expire but use a funding rate to peg price to spot. Funding rate positive = longs pay shorts (bullish crowd). Funding flips negative = shorts pay longs. Extreme funding often signals over-crowded trades about to unwind.',
      },
    ],
  },
  {
    id: 'portfolio-theory',
    title: 'Portfolio Theory & Metrics',
    icon: Scale,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    summary: 'Quantitative frameworks for building and evaluating portfolios.',
    content: [
      {
        heading: 'Modern Portfolio Theory (MPT)',
        text: 'Harry Markowitz\'s 1952 insight: risk can be reduced through diversification across uncorrelated assets, not just by picking "safer" ones. The "efficient frontier" is the set of portfolios offering maximum return for a given risk level. Adding even a volatile asset (like Bitcoin) to a stock portfolio can reduce overall variance if its returns are uncorrelated.',
      },
      {
        heading: 'Sharpe Ratio',
        text: 'Sharpe = (Portfolio Return − Risk-Free Rate) / Standard Deviation. It measures return per unit of risk. A Sharpe of 1.0 is good; 2.0 is very good; 3.0+ is exceptional. Hedge funds target Sharpe > 1.5. The risk-free rate is typically the 3-month T-bill yield. Sharpe penalises both upside and downside volatility equally — its main critique.',
      },
      {
        heading: 'Sortino & Calmar Ratios',
        text: 'Sortino is like Sharpe but only penalises DOWNSIDE volatility — upside spikes are rewards, not risk. Calmar = Return / Max Drawdown, useful for evaluating strategies over long periods. A strategy with 20% annual return and 10% max drawdown has a Calmar of 2.0 — attractive to institutional allocators.',
      },
      {
        heading: 'Drawdown & Recovery',
        text: 'Drawdown is the peak-to-trough decline in portfolio value. A 50% drawdown requires a 100% gain to recover. This asymmetry is why professionals obsess over drawdown control. Deep Stock Insights\' Agent Desk tracks equity curves, max drawdown, and underwater periods for every strategy.',
      },
      {
        heading: 'Correlation & Beta',
        text: 'Correlation measures how two assets move together (−1 to +1). Beta measures an asset\'s sensitivity to the broader market (S&P 500 = beta 1.0). Tesla\'s beta is ~2.0 — it moves twice as much as the market. Defensive stocks (utilities, consumer staples) have beta < 1. In crashes, correlations often jump to 1.0 — "diversification fails exactly when you need it most."',
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
          <span className="font-mono text-[10px] text-gray-500 ml-1">
            · {TRADING_CONCEPTS.length} modules
          </span>
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

      {/* ── Momentum Indicators ─────────────────────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-blue" />
          Momentum & Oscillator Indicators
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Measure the speed, strength and reversal potential of price moves.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Indicator</th>
                <th className="pb-2 pr-4 font-medium text-green-400">Bullish Signal</th>
                <th className="pb-2 pr-4 font-medium text-red-400">Bearish Signal</th>
                <th className="pb-2 font-medium text-yellow-400">Neutral / Note</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">RSI (14)</td>
                <td className="py-2 pr-4 text-green-400">Below 30 (oversold) + up-cross</td>
                <td className="py-2 pr-4 text-red-400">Above 70 (overbought) + down-cross</td>
                <td className="py-2 text-gray-400">30-70 · watch 50 line</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">MACD (12,26,9)</td>
                <td className="py-2 pr-4 text-green-400">MACD crosses above signal</td>
                <td className="py-2 pr-4 text-red-400">MACD crosses below signal</td>
                <td className="py-2 text-gray-400">Histogram shrinking</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Stochastic (14,3)</td>
                <td className="py-2 pr-4 text-green-400">K crosses above D below 20</td>
                <td className="py-2 pr-4 text-red-400">K crosses below D above 80</td>
                <td className="py-2 text-gray-400">20-80 range</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Stoch RSI</td>
                <td className="py-2 pr-4 text-green-400">Below 0.2 and turning up</td>
                <td className="py-2 pr-4 text-red-400">Above 0.8 and turning down</td>
                <td className="py-2 text-gray-400">Very fast · noisy</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Williams %R (14)</td>
                <td className="py-2 pr-4 text-green-400">Below −80 (oversold)</td>
                <td className="py-2 pr-4 text-red-400">Above −20 (overbought)</td>
                <td className="py-2 text-gray-400">−80 to −20</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">CCI (20)</td>
                <td className="py-2 pr-4 text-green-400">Above −100 rising from below</td>
                <td className="py-2 pr-4 text-red-400">Below +100 falling from above</td>
                <td className="py-2 text-gray-400">±100 range = trendless</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">ROC (Rate of Change)</td>
                <td className="py-2 pr-4 text-green-400">Crosses above zero</td>
                <td className="py-2 pr-4 text-red-400">Crosses below zero</td>
                <td className="py-2 text-gray-400">Around zero = stagnation</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">MFI (Money Flow)</td>
                <td className="py-2 pr-4 text-green-400">Below 20 (volume-weighted oversold)</td>
                <td className="py-2 pr-4 text-red-400">Above 80 (volume-weighted overbought)</td>
                <td className="py-2 text-gray-400">20-80</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">Awesome Oscillator</td>
                <td className="py-2 pr-4 text-green-400">Zero line cross up · twin peaks below</td>
                <td className="py-2 pr-4 text-red-400">Zero line cross down · twin peaks above</td>
                <td className="py-2 text-gray-400">Watch colour shifts</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Trend & Volatility Indicators ────────────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <LineIcon className="w-4 h-4 text-accent-blue" />
          Trend & Volatility Indicators
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Identify trend direction, strength, and the market's expansion/contraction phases.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Indicator</th>
                <th className="pb-2 pr-4 font-medium text-green-400">Bullish Signal</th>
                <th className="pb-2 pr-4 font-medium text-red-400">Bearish Signal</th>
                <th className="pb-2 font-medium text-yellow-400">Neutral / Note</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">50 / 200 SMA</td>
                <td className="py-2 pr-4 text-green-400">Golden Cross (50 &gt; 200)</td>
                <td className="py-2 pr-4 text-red-400">Death Cross (50 &lt; 200)</td>
                <td className="py-2 text-gray-400">Intertwined = chop</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">EMA (20/50)</td>
                <td className="py-2 pr-4 text-green-400">Price above both, 20 &gt; 50</td>
                <td className="py-2 pr-4 text-red-400">Price below both, 20 &lt; 50</td>
                <td className="py-2 text-gray-400">Compressing = breakout soon</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Bollinger Bands</td>
                <td className="py-2 pr-4 text-green-400">Touch of lower band in uptrend</td>
                <td className="py-2 pr-4 text-red-400">Touch of upper band in downtrend</td>
                <td className="py-2 text-gray-400">Squeeze = breakout pending</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Bollinger %B</td>
                <td className="py-2 pr-4 text-green-400">Below 0.2 (near lower band)</td>
                <td className="py-2 pr-4 text-red-400">Above 0.8 (near upper band)</td>
                <td className="py-2 text-gray-400">0.2 - 0.8 middle zone</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Keltner Channels</td>
                <td className="py-2 pr-4 text-green-400">Close above upper = momentum</td>
                <td className="py-2 pr-4 text-red-400">Close below lower = momentum</td>
                <td className="py-2 text-gray-400">Inside BB = TTM squeeze</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">ADX (14)</td>
                <td className="py-2 pr-4 text-green-400">Above 25 · +DI &gt; −DI</td>
                <td className="py-2 pr-4 text-red-400">Above 25 · −DI &gt; +DI</td>
                <td className="py-2 text-gray-400">Below 20 = no trend</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Ichimoku Cloud</td>
                <td className="py-2 pr-4 text-green-400">Price above green cloud</td>
                <td className="py-2 pr-4 text-red-400">Price below red cloud</td>
                <td className="py-2 text-gray-400">Inside cloud = no trade</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Parabolic SAR</td>
                <td className="py-2 pr-4 text-green-400">Dots below price</td>
                <td className="py-2 pr-4 text-red-400">Dots above price</td>
                <td className="py-2 text-gray-400">Choppy markets whipsaw</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">ATR (14)</td>
                <td className="py-2 pr-4 text-green-400">Rising with trend = healthy</td>
                <td className="py-2 pr-4 text-red-400">Spike + gap = climax</td>
                <td className="py-2 text-gray-400">Use for stop-loss sizing</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">SuperTrend</td>
                <td className="py-2 pr-4 text-green-400">Line flips green, below price</td>
                <td className="py-2 pr-4 text-red-400">Line flips red, above price</td>
                <td className="py-2 text-gray-400">Flip = trailing-stop exit</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Donchian Channel</td>
                <td className="py-2 pr-4 text-green-400">Break of 20-day high</td>
                <td className="py-2 pr-4 text-red-400">Break of 20-day low</td>
                <td className="py-2 text-gray-400">Classic Turtle strategy</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">VIX (Fear Index)</td>
                <td className="py-2 pr-4 text-green-400">Below 15 = risk-on</td>
                <td className="py-2 pr-4 text-red-400">Above 30 = panic</td>
                <td className="py-2 text-gray-400">15-25 = normal</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Candlestick Pattern Reference ────────────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Candy className="w-4 h-4 text-accent-blue" />
          Candlestick Pattern Reference
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Single- and multi-candle reversal and continuation patterns, with reliability notes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Pattern</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Description</th>
                <th className="pb-2 font-medium text-yellow-400">Reliability</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Hammer</td>
                <td className="py-2 pr-4 text-green-400">Bullish reversal</td>
                <td className="py-2 pr-4 text-xs">Small body, long lower wick, at support</td>
                <td className="py-2 text-yellow-400">★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Shooting Star</td>
                <td className="py-2 pr-4 text-red-400">Bearish reversal</td>
                <td className="py-2 pr-4 text-xs">Small body, long upper wick, at resistance</td>
                <td className="py-2 text-yellow-400">★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Bullish Engulfing</td>
                <td className="py-2 pr-4 text-green-400">Bullish reversal</td>
                <td className="py-2 pr-4 text-xs">Green candle fully engulfs prior red</td>
                <td className="py-2 text-yellow-400">★★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Bearish Engulfing</td>
                <td className="py-2 pr-4 text-red-400">Bearish reversal</td>
                <td className="py-2 pr-4 text-xs">Red candle fully engulfs prior green</td>
                <td className="py-2 text-yellow-400">★★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Doji</td>
                <td className="py-2 pr-4 text-gray-400">Indecision</td>
                <td className="py-2 pr-4 text-xs">Open ≈ close, long wicks</td>
                <td className="py-2 text-yellow-400">★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Morning Star</td>
                <td className="py-2 pr-4 text-green-400">Bullish reversal</td>
                <td className="py-2 pr-4 text-xs">Red → small body → green, 3-candle</td>
                <td className="py-2 text-yellow-400">★★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Evening Star</td>
                <td className="py-2 pr-4 text-red-400">Bearish reversal</td>
                <td className="py-2 pr-4 text-xs">Green → small body → red, 3-candle</td>
                <td className="py-2 text-yellow-400">★★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Three White Soldiers</td>
                <td className="py-2 pr-4 text-green-400">Continuation up</td>
                <td className="py-2 pr-4 text-xs">Three consecutive strong green candles</td>
                <td className="py-2 text-yellow-400">★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Three Black Crows</td>
                <td className="py-2 pr-4 text-red-400">Continuation down</td>
                <td className="py-2 pr-4 text-xs">Three consecutive strong red candles</td>
                <td className="py-2 text-yellow-400">★★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Piercing Line</td>
                <td className="py-2 pr-4 text-green-400">Bullish reversal</td>
                <td className="py-2 pr-4 text-xs">Green opens below prior low, closes &gt; 50% into red body</td>
                <td className="py-2 text-yellow-400">★★★</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Dark Cloud Cover</td>
                <td className="py-2 pr-4 text-red-400">Bearish reversal</td>
                <td className="py-2 pr-4 text-xs">Red opens above prior high, closes &gt; 50% into green body</td>
                <td className="py-2 text-yellow-400">★★★</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">Marubozu</td>
                <td className="py-2 pr-4 text-gray-400">Strong trend</td>
                <td className="py-2 pr-4 text-xs">Full-body candle with no wicks — conviction</td>
                <td className="py-2 text-yellow-400">★★★★</td>
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
