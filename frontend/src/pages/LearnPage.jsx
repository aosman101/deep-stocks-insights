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
  {
    id: 'market-microstructure',
    title: 'Market Microstructure',
    icon: Network,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    summary: 'How orders actually get matched, and the hidden mechanics of price formation.',
    content: [
      {
        heading: 'Order Book & Bid-Ask Spread',
        text: 'The order book is a real-time list of buy (bid) and sell (ask) orders. The BID is the highest price a buyer will pay; the ASK is the lowest price a seller will accept. The difference is the SPREAD — your immediate transaction cost. Liquid assets (SPY, BTC) have spreads of ~0.01%; illiquid small-caps can have 1%+ spreads.',
      },
      {
        heading: 'Order Types',
        text: 'Market Order — execute immediately at best available price (risks slippage). Limit Order — execute only at your specified price or better (may not fill). Stop Order — becomes a market order when triggered. Stop-Limit — becomes a limit order when triggered (safer but may not fill). Iceberg — large order hidden in smaller visible chunks.',
      },
      {
        heading: 'Slippage & Market Impact',
        text: 'Slippage is the difference between expected fill and actual fill. Small orders in liquid markets have negligible slippage. Large orders (>1% of average daily volume) push price against you. Professionals use VWAP (volume-weighted average price) algorithms to slice big orders across the day to minimise impact.',
      },
      {
        heading: 'Dark Pools & Payment for Order Flow',
        text: 'Dark pools are private exchanges where large block trades happen without public order book visibility — to avoid moving price. Retail brokers (Robinhood, Webull) route orders to market makers like Citadel who pay the broker for flow. You get "price improvement" but the market maker profits from the bid-ask spread on millions of orders.',
      },
      {
        heading: 'Market Makers & Liquidity',
        text: 'Market makers continuously post both bids and asks, earning the spread as compensation for providing liquidity. They use inventory models and hedge exposure via futures/options. In crypto, automated market makers (AMMs like Uniswap) replace order books with liquidity pools — price is determined by a constant-product formula (x × y = k).',
      },
    ],
  },
  {
    id: 'crypto-deep-dive',
    title: 'Crypto Deep-Dive',
    icon: Coins,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    summary: 'On-chain fundamentals, DeFi mechanics, and crypto-specific signals.',
    content: [
      {
        heading: 'Proof of Work vs Proof of Stake',
        text: 'PoW (Bitcoin) secures the network via energy-intensive mining — computers race to solve cryptographic puzzles. PoS (Ethereum, Solana) requires validators to stake native tokens as collateral; misbehave and you lose your stake. PoS is ~99% more energy-efficient but critics argue it concentrates power with large stakers.',
      },
      {
        heading: 'On-Chain Metrics',
        text: 'Active Addresses — daily unique addresses transacting; a proxy for network usage. NVT Ratio (Network Value to Transactions) — crypto\'s P/E equivalent; NVT > 100 suggests overvaluation. MVRV Z-Score — compares market value to realised value; peaks above 7 historically marked BTC tops. Exchange Reserves — falling reserves = accumulation (bullish); rising = distribution (bearish).',
      },
      {
        heading: 'Bitcoin Halving Cycle',
        text: 'Every 210,000 blocks (~4 years), Bitcoin mining rewards halve. This supply shock has historically preceded major bull runs: halving dates were Nov 2012, Jul 2016, May 2020, Apr 2024. Price peaks tend to follow 12-18 months after each halving. Whether the pattern holds is one of the most debated questions in crypto.',
      },
      {
        heading: 'DeFi Primitives',
        text: 'Lending (Aave, Compound) — deposit crypto to earn yield, borrow against collateral. DEXs (Uniswap, Curve) — swap tokens without a central intermediary. Liquid Staking (Lido) — stake ETH, receive stETH you can still use in DeFi. Yield Farming — move capital between protocols chasing highest APY. TVL (Total Value Locked) is the key metric for protocol traction.',
      },
      {
        heading: 'Stablecoins & Peg Risk',
        text: 'USDT (Tether) and USDC (Circle) are centralised, backed by reserves audited to varying degrees. DAI is crypto-collateralised. Algorithmic stablecoins like UST collapsed in 2022, wiping $40B. Depegs (stablecoin trading below $1) are major market stress signals — USDC briefly depegged to $0.87 during the March 2023 Silicon Valley Bank crisis.',
      },
    ],
  },
  {
    id: 'behavioral-pitfalls',
    title: 'Behavioural Pitfalls',
    icon: AlertTriangle,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    summary: 'The psychological traps that destroy more portfolios than bad analysis.',
    content: [
      {
        heading: 'Loss Aversion',
        text: 'Kahneman & Tversky proved we feel losses about 2x as intensely as equivalent gains. This causes traders to hold losing positions too long ("hoping it comes back") and sell winners too early ("locking in gains"). The antidote: pre-commit to stop-losses before entering, and evaluate positions as if you were opening them fresh today.',
      },
      {
        heading: 'Confirmation Bias',
        text: 'We actively seek information confirming our existing views and dismiss contradicting evidence. A trader bullish on Tesla will read bull theses, ignore bear cases. Combat this by writing down your thesis AND the conditions that would prove you wrong — then honestly monitor for those falsifying conditions.',
      },
      {
        heading: 'Anchoring',
        text: 'We fixate on irrelevant reference points — "I bought at $100, so I\'ll wait until it gets back there." The price you paid is a sunk cost. The only question: given today\'s information, would you buy this position at today\'s price? If not, sell, regardless of your entry.',
      },
      {
        heading: 'FOMO & Revenge Trading',
        text: 'Fear of Missing Out drives buying near tops after a rally. Revenge trading — increasing position size after a loss to "win back" the money — is how accounts blow up. Both emotions bypass your analytical process. A trading journal helps: log your emotional state alongside each trade and identify patterns.',
      },
      {
        heading: 'Recency Bias',
        text: 'We overweight recent events. After three winning trades, we feel invincible. After three losses, we feel the system is broken. Neither is usually true — any sample of 3 is just noise. Judge strategies on 50+ trade samples, not your last week.',
      },
      {
        heading: 'The Disposition Effect',
        text: 'Selling winners too early and holding losers too long — the exact opposite of what\'s optimal. Studies show retail traders do this consistently. Research by Odean (1998) found individual investors sell winners 50% more often than losers. Professional traders deliberately track and fight this tendency.',
      },
    ],
  },
]

// ─── Glossary — quick-lookup terms ──────────────────────────
const GLOSSARY = [
  { term: 'Alpha', def: 'Excess return above a benchmark, adjusted for risk. A strategy with 2% alpha beats the S&P 500 by 2% annually after accounting for market exposure.' },
  { term: 'Backtesting', def: 'Running a trading strategy on historical data to estimate how it would have performed. Prone to overfitting if not done carefully.' },
  { term: 'Basis Point (bp)', def: '1/100th of 1%. A 25bp rate hike = 0.25%. Common in rates, spreads, and fees.' },
  { term: 'Beta', def: 'Sensitivity to the broader market. Beta 1.0 = moves with the market; 2.0 = twice as volatile; 0.5 = half as volatile.' },
  { term: 'Black Swan', def: 'An unpredictable, high-impact event (Nassim Taleb). Examples: 2008 crash, COVID-19, FTX collapse.' },
  { term: 'Candlestick', def: 'Price chart showing open, high, low, close (OHLC) for a period. Green = close above open; red = close below open.' },
  { term: 'Circuit Breaker', def: 'Automatic trading halts triggered by severe price drops. NYSE halts at −7%, −13%, −20% moves from prior close.' },
  { term: 'Dead Cat Bounce', def: 'A temporary recovery during a sustained downtrend that fails to reverse the trend.' },
  { term: 'Hash Rate', def: 'Total computational power securing a Proof of Work blockchain. Rising hash = rising miner confidence.' },
  { term: 'Leverage', def: 'Borrowed capital to amplify position size. 10x leverage means a 10% adverse move liquidates you.' },
  { term: 'Liquidity', def: 'How easily an asset can be bought/sold without moving price. High volume + tight spreads = high liquidity.' },
  { term: 'Long / Short', def: 'Long = bet price rises. Short = bet price falls by borrowing and selling, then rebuying lower.' },
  { term: 'Margin Call', def: 'Broker demand for more collateral when leveraged position loses value. Ignore it = forced liquidation.' },
  { term: 'Market Cap', def: 'Total value of outstanding shares/tokens. Price × circulating supply.' },
  { term: 'Moat', def: 'Competitive advantage that protects long-term profitability (brand, network effects, patents, switching costs).' },
  { term: 'Quant', def: 'Quantitative trader/researcher who uses mathematical models and code (not intuition) to make decisions.' },
  { term: 'Short Squeeze', def: 'Rapid price rise that forces short sellers to buy back shares at higher prices, accelerating the rally (GME 2021).' },
  { term: 'Whale', def: 'Holder large enough to move markets. BTC addresses with 1,000+ BTC are tracked closely by analysts.' },
  { term: 'Yield Curve', def: 'Plot of bond yields across maturities. Inversion (short rates > long rates) has preceded every US recession since 1955.' },
  { term: 'Z-Score', def: 'How many standard deviations a value is from the mean. ±2 = unusual; ±3 = extreme. Used in mean-reversion signals.' },
]

// ─── Market session hours ──────────────────────────────────
const MARKET_SESSIONS = [
  { market: 'New York (NYSE/NASDAQ)',  hours: '09:30 – 16:00 ET',    local: '14:30 – 21:00 UTC', notes: 'Highest US equity volume. Opening 30 min and closing hour dominate daily volume.' },
  { market: 'London (LSE)',            hours: '08:00 – 16:30 GMT',   local: '08:00 – 16:30 UTC', notes: 'Overlaps with NY 13:30–16:30 — highest global FX liquidity.' },
  { market: 'Tokyo (TSE)',             hours: '09:00 – 15:00 JST',   local: '00:00 – 06:00 UTC', notes: 'Asian session leader. JPY, Nikkei most active.' },
  { market: 'Hong Kong (HKEX)',        hours: '09:30 – 16:00 HKT',   local: '01:30 – 08:00 UTC', notes: 'China-exposure proxy. Overlaps late Tokyo session.' },
  { market: 'Crypto (24/7)',           hours: 'Always open',         local: '—',                 notes: 'Weekend moves often amplified by low liquidity. Funding rates reset every 8h.' },
  { market: 'CME Futures',             hours: '18:00 Sun – 17:00 Fri ET', local: '~23:00 – 22:00 UTC', notes: 'Overnight index futures (ES, NQ) lead US cash open. Gaps signal overnight risk.' },
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
  const [glossaryQuery, setGlossaryQuery] = useState('')

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

  const filteredGlossary = glossaryQuery.trim()
    ? GLOSSARY.filter(g =>
        g.term.toLowerCase().includes(glossaryQuery.toLowerCase()) ||
        g.def.toLowerCase().includes(glossaryQuery.toLowerCase())
      )
    : GLOSSARY

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

      {/* ── Market Session Hours ────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-blue" />
          Global Market Sessions
        </h2>
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-surface-border bg-surface-hover/40">
                  <th className="px-4 py-2.5 font-medium">Market</th>
                  <th className="px-4 py-2.5 font-medium">Local Hours</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">UTC</th>
                  <th className="px-4 py-2.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {MARKET_SESSIONS.map((s, i) => (
                  <tr key={i} className="border-b border-surface-border/40 last:border-0 hover:bg-surface-hover/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-white">{s.market}</td>
                    <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{s.hours}</td>
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs hidden md:table-cell">{s.local}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Volume</td>
                <td className="py-2 pr-4 text-green-400">Rising price + rising volume</td>
                <td className="py-2 pr-4 text-red-400">Rising price + falling volume</td>
                <td className="py-2 text-gray-400">Average volume</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Moving Avg (50/200)</td>
                <td className="py-2 pr-4 text-green-400">Golden Cross (50 &gt; 200)</td>
                <td className="py-2 pr-4 text-red-400">Death Cross (50 &lt; 200)</td>
                <td className="py-2 text-gray-400">MAs flat / intertwined</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">OBV (On-Balance Volume)</td>
                <td className="py-2 pr-4 text-green-400">Rising with price (confirm)</td>
                <td className="py-2 pr-4 text-red-400">Falling while price rises (divergence)</td>
                <td className="py-2 text-gray-400">Flat / mixed</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">ATR (Volatility)</td>
                <td className="py-2 pr-4 text-green-400">Falling ATR + rising price</td>
                <td className="py-2 pr-4 text-red-400">Rising ATR + falling price</td>
                <td className="py-2 text-gray-400">Stable ATR</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Yield Curve (10Y − 2Y)</td>
                <td className="py-2 pr-4 text-green-400">Steepening (&gt; 0)</td>
                <td className="py-2 pr-4 text-red-400">Inverted (&lt; 0) — recession risk</td>
                <td className="py-2 text-gray-400">Flat (~0)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">VIX (Fear Index)</td>
                <td className="py-2 pr-4 text-green-400">Below 15 (calm / risk-on)</td>
                <td className="py-2 pr-4 text-red-400">Above 30 (panic)</td>
                <td className="py-2 text-gray-400">15-25 (normal)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Glossary ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-accent-blue" />
            Glossary
            <span className="font-mono text-[10px] text-gray-500 ml-1">
              · {GLOSSARY.length} terms
            </span>
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={glossaryQuery}
              onChange={e => setGlossaryQuery(e.target.value)}
              placeholder="Search terms…"
              className="input pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {filteredGlossary.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-sm text-gray-400">No terms match "{glossaryQuery}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredGlossary.map(g => (
              <div
                key={g.term}
                className="card hover:border-ember-500/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <h3 className="font-display text-base text-white tracking-tight">
                    {g.term}
                  </h3>
                  <div className="h-px flex-1 bg-surface-border/60" />
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {g.def}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Further Reading ─────────────────────────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-blue" />
          Further Reading
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="eyebrow mb-2">Foundational</p>
            <ul className="space-y-1.5 text-gray-300">
              <li>• <span className="text-white">A Random Walk Down Wall Street</span> — Burton Malkiel</li>
              <li>• <span className="text-white">The Intelligent Investor</span> — Benjamin Graham</li>
              <li>• <span className="text-white">Market Wizards</span> — Jack Schwager</li>
              <li>• <span className="text-white">Reminiscences of a Stock Operator</span> — Edwin Lefèvre</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2">Quantitative & Advanced</p>
            <ul className="space-y-1.5 text-gray-300">
              <li>• <span className="text-white">Advances in Financial Machine Learning</span> — Marcos López de Prado</li>
              <li>• <span className="text-white">Option Volatility & Pricing</span> — Sheldon Natenberg</li>
              <li>• <span className="text-white">Trading and Exchanges</span> — Larry Harris</li>
              <li>• <span className="text-white">Active Portfolio Management</span> — Grinold & Kahn</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2">Psychology & Risk</p>
            <ul className="space-y-1.5 text-gray-300">
              <li>• <span className="text-white">Thinking, Fast and Slow</span> — Daniel Kahneman</li>
              <li>• <span className="text-white">The Black Swan</span> — Nassim Taleb</li>
              <li>• <span className="text-white">Trading in the Zone</span> — Mark Douglas</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2">Crypto & DeFi</p>
            <ul className="space-y-1.5 text-gray-300">
              <li>• <span className="text-white">The Bitcoin Standard</span> — Saifedean Ammous</li>
              <li>• <span className="text-white">Mastering Bitcoin</span> — Andreas Antonopoulos</li>
              <li>• <span className="text-white">How to DeFi</span> — CoinGecko</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-600 pb-6">
        Always do your own research and consult a qualified financial advisor before making investment decisions.
      </p>
    </div>
  )
}
