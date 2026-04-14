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
      {
        heading: 'Overconfidence & the Dunning-Kruger Curve',
        text: 'After 3-6 months of paper trading profits, most new traders believe they\'ve "figured it out." This is peak overconfidence — and peak danger when real money is deployed. Barber & Odean (2001) found that active male traders underperform by 2.65% annually vs buy-and-hold, largely due to overtrading. Staying humble and documenting every trade with expected vs actual outcome protects against this.',
      },
      {
        heading: 'Herding & Social Proof',
        text: 'Humans are wired to copy the crowd — useful when avoiding lions, deadly in markets. When "everyone" is bullish on a stock (retail forums, CNBC talking heads, cab drivers), the upside is usually already priced in. Contrarians like Buffett ("be fearful when others are greedy") make their biggest profits when consensus is most extreme. The AAII Sentiment Survey and put/call ratio quantify herd positioning.',
      },
    ],
  },
  {
    id: 'quantitative-strategies',
    title: 'Quantitative Strategies',
    icon: Sigma,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
    summary: 'Systematic strategies used by hedge funds and prop desks.',
    content: [
      {
        heading: 'Momentum Factor',
        text: 'One of the most robust anomalies in finance: past winners tend to keep winning over 3-12 month horizons. Jegadeesh & Titman (1993) showed a long-short strategy buying top decile / shorting bottom decile of past 12-month returns generated ~1% monthly alpha. Caveat: momentum crashes violently during trend reversals (e.g., March 2009, March 2020). Modern implementations combine momentum with volatility scaling to reduce these crashes.',
      },
      {
        heading: 'Value Factor',
        text: 'Fama-French\'s HML (High Minus Low book-to-market): buying cheap stocks and shorting expensive ones. Historical excess return ~4% annualised. The 2010s were brutal for value (growth dominated), but 2021-2024 saw a partial mean reversion. Modern "quality value" approaches combine low valuation with high profitability (ROIC, gross margins) to avoid "value traps" — stocks cheap for good reasons.',
      },
      {
        heading: 'Statistical Arbitrage',
        text: 'Stat arb finds temporary price dislocations between related securities. Classic example: cointegration between two stocks in the same industry. Fit a linear combination that is mean-reverting, enter when the spread widens 2 std devs, exit at mean. Profits are small per trade but can be done thousands of times. Renaissance Technologies\' Medallion Fund (66% annual gross returns 1988-2018) runs an industrial-scale version.',
      },
      {
        heading: 'Low Volatility Anomaly',
        text: 'Empirically, low-volatility stocks outperform high-volatility stocks on a risk-adjusted basis — contradicting CAPM. Possible explanations: leverage constraints force institutions into high-vol stocks (pushing their prices up, returns down), lottery preference (retail pays up for lottery-ticket stocks). The iShares Min Vol ETF (USMV) captures this factor; it has beaten SPY by ~1% annually with 30% less volatility.',
      },
      {
        heading: 'Carry Trade',
        text: 'Borrow in a low-yielding currency/asset, invest in a high-yielding one, pocket the spread. Classic FX version: borrow JPY at 0%, buy AUD at 4%, earn 4% annually plus any currency appreciation. Risk: sudden reversals can wipe out years of carry in days (Swiss Franc shock 2015 destroyed years of EUR/CHF carry in 20 minutes). Crypto version: earn funding rate by shorting perpetuals when funding is positive.',
      },
      {
        heading: 'Pairs Trading (Cointegration)',
        text: 'Instead of betting on direction, bet on RELATIVE performance. Coca-Cola and Pepsi have moved together for decades. When KO / PEP ratio deviates 2 std devs from its 60-day mean, go long the laggard and short the leader, expecting reversion. Engle-Granger or Johansen tests statistically confirm cointegration. Market-neutral: you don\'t care if stocks rally or crash, only whether the spread reverts.',
      },
      {
        heading: 'Volatility Targeting',
        text: 'Fixed-notional strategies blow up when volatility spikes. Volatility-targeted strategies scale position size inversely to recent volatility — when vol is high, positions shrink; when low, positions grow. This dramatically smooths equity curves. Implementation: scale daily by (target_vol / realised_vol), clipped at some max leverage. Managed Futures CTAs and risk-parity funds all use variants of this approach.',
      },
      {
        heading: 'Execution Alpha',
        text: 'Even a 5% annual edge is wiped out by poor execution. TWAP (time-weighted) and VWAP algorithms slice large orders into small pieces to minimise market impact. Iceberg orders hide size. Smart Order Routing splits across venues. For retail: always use limit orders, avoid the first and last 15 minutes of the session (chaotic), and pay attention to bid-ask spreads on illiquid names.',
      },
    ],
  },
  {
    id: 'trading-plan',
    title: 'Building a Trading Plan',
    icon: Target,
    color: 'text-lime-400',
    bg: 'bg-lime-500/10 border-lime-500/20',
    summary: 'A written plan is what separates a strategy from guessing.',
    content: [
      {
        heading: 'Define Your Edge',
        text: 'Before risking capital, write down WHY your strategy should work. "Momentum stocks tend to continue 3-6 months" is an edge. "I have a good feeling about Tesla" is not. Your edge must be defensible, measurable, and ideally backed by academic research or long-term backtest data (20+ years if possible).',
      },
      {
        heading: 'Entry Criteria',
        text: 'Specify exact, unambiguous entry rules. "Buy AAPL when it\'s cheap" is not a rule. "Buy AAPL when RSI(14) < 30 AND price > 200-day SMA AND VIX < 25" is a rule. If a rule can\'t be automated, it\'s too vague. Force yourself to precision — ambiguity is where emotion and bias creep in.',
      },
      {
        heading: 'Exit Criteria (Both Directions)',
        text: 'Before entering, define BOTH your stop-loss and your take-profit levels. Common frameworks: fixed % stop (-2%), ATR-based stop (1.5x ATR), time-based exit (close after 10 days regardless). Profit targets: fixed R:R (2:1 or 3:1), trailing stop that tightens as price rises, or scale-out (sell 1/3 at 1R, 1/3 at 2R, 1/3 at 3R).',
      },
      {
        heading: 'Position Sizing Formula',
        text: 'Position size = (Account × Risk per trade) / (Entry − Stop). If your $10k account risks 1% per trade ($100) and your stop is $5 below your $100 entry, position size = $100 / $5 = 20 shares = $2,000 position. This keeps every trade standardised regardless of volatility. Higher-volatility names automatically get smaller positions.',
      },
      {
        heading: 'Trading Journal',
        text: 'Every trade must be logged: date, ticker, direction, entry, stop, target, size, reasoning, emotional state, and outcome. Review monthly to find patterns: "I overtrade on Fridays," "I size up after wins," "My tech sector trades underperform." Without a journal, you can\'t improve — you\'ll repeat the same mistakes for years.',
      },
      {
        heading: 'Pre-Trade Checklist',
        text: 'Before every entry, run a checklist: (1) Does this setup match my rules exactly? (2) Is position size within limits? (3) Is stop-loss placed BEFORE entering? (4) Am I emotional (revenge, FOMO, overconfidence)? (5) What is the catalyst — earnings, Fed meeting, news — that could invalidate this in the next 48h? If any answer is uncertain, skip the trade.',
      },
      {
        heading: 'Review & Iterate',
        text: 'Monthly review: calculate win rate, average win, average loss, expectancy (win_rate × avg_win − loss_rate × avg_loss), max drawdown, Sharpe ratio. Compare to your strategy\'s backtest. If live performance significantly lags backtest after 30+ trades, something is wrong — execution, slippage, or the edge has decayed. Quarterly: honestly ask whether the strategy still works in current market conditions.',
      },
      {
        heading: 'Trading Psychology Rules',
        text: 'Write 5-10 rules on a card next to your monitor. Examples: "I never add to losers." "I never remove a stop-loss." "I never trade without a plan." "I never revenge-trade after a loss." "I walk away after 3 consecutive losses." Rules prevent in-the-moment rationalisation. Professional poker players, athletes, and traders all use explicit rules as cognitive guardrails.',
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

      {/* ── Volume & Market-Breadth Indicators ───────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-accent-blue" />
          Volume & Market-Breadth Indicators
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Confirm moves with participation; detect hidden accumulation or distribution.
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
                <td className="py-2 pr-4 font-medium text-white">Volume</td>
                <td className="py-2 pr-4 text-green-400">Rising price + rising volume</td>
                <td className="py-2 pr-4 text-red-400">Rising price + falling volume</td>
                <td className="py-2 text-gray-400">Average = no conviction</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">OBV (On-Balance)</td>
                <td className="py-2 pr-4 text-green-400">New highs with price</td>
                <td className="py-2 pr-4 text-red-400">Falling while price rises</td>
                <td className="py-2 text-gray-400">Flat = range-bound</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">VWAP</td>
                <td className="py-2 pr-4 text-green-400">Price above VWAP, VWAP rising</td>
                <td className="py-2 pr-4 text-red-400">Price below VWAP, VWAP falling</td>
                <td className="py-2 text-gray-400">Institutional benchmark</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Accum / Distribution</td>
                <td className="py-2 pr-4 text-green-400">Rising A/D line</td>
                <td className="py-2 pr-4 text-red-400">Falling A/D line</td>
                <td className="py-2 text-gray-400">Divergence with price</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Chaikin Money Flow</td>
                <td className="py-2 pr-4 text-green-400">Above 0 for 3+ weeks</td>
                <td className="py-2 pr-4 text-red-400">Below 0 for 3+ weeks</td>
                <td className="py-2 text-gray-400">Near zero = indecision</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Force Index</td>
                <td className="py-2 pr-4 text-green-400">Rising and positive</td>
                <td className="py-2 pr-4 text-red-400">Falling and negative</td>
                <td className="py-2 text-gray-400">Spikes = climax moves</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Advance/Decline Line</td>
                <td className="py-2 pr-4 text-green-400">New highs with index</td>
                <td className="py-2 pr-4 text-red-400">Falling while index rises</td>
                <td className="py-2 text-gray-400">Weak breadth warning</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">% Stocks Above 200 SMA</td>
                <td className="py-2 pr-4 text-green-400">Rising through 50%</td>
                <td className="py-2 pr-4 text-red-400">Falling through 50%</td>
                <td className="py-2 text-gray-400">Below 20 = oversold market</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Put/Call Ratio</td>
                <td className="py-2 pr-4 text-green-400">Above 1.2 (fear = contrarian buy)</td>
                <td className="py-2 pr-4 text-red-400">Below 0.6 (greed = contrarian sell)</td>
                <td className="py-2 text-gray-400">0.7 - 1.0 typical</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">New Highs − New Lows</td>
                <td className="py-2 pr-4 text-green-400">Expanding positive</td>
                <td className="py-2 pr-4 text-red-400">Expanding negative</td>
                <td className="py-2 text-gray-400">Leading breadth indicator</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Macro & Intermarket Indicators ───────────────────── */}
      <section className="card">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent-blue" />
          Macro & Intermarket Signals
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Cross-asset relationships and macro data that drive all markets.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-surface-border">
                <th className="pb-2 pr-4 font-medium">Indicator</th>
                <th className="pb-2 pr-4 font-medium text-green-400">Risk-On Signal</th>
                <th className="pb-2 pr-4 font-medium text-red-400">Risk-Off Signal</th>
                <th className="pb-2 font-medium text-yellow-400">Typical Range</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Yield Curve (10Y − 2Y)</td>
                <td className="py-2 pr-4 text-green-400">Steepening (&gt; 0)</td>
                <td className="py-2 pr-4 text-red-400">Inverted (&lt; 0) — recession risk</td>
                <td className="py-2 text-gray-400">−1% to +3% cyclical</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">DXY (Dollar Index)</td>
                <td className="py-2 pr-4 text-green-400">Falling = bullish for stocks/crypto/gold</td>
                <td className="py-2 pr-4 text-red-400">Rising = pressure on risk assets</td>
                <td className="py-2 text-gray-400">90 - 110 typical band</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">10Y Treasury Yield</td>
                <td className="py-2 pr-4 text-green-400">Stable or falling — bullish growth</td>
                <td className="py-2 pr-4 text-red-400">Spiking &gt; 4.5% = valuation pressure</td>
                <td className="py-2 text-gray-400">2-5% modern range</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Credit Spreads (HY-IG)</td>
                <td className="py-2 pr-4 text-green-400">Tightening (&lt; 4%)</td>
                <td className="py-2 pr-4 text-red-400">Widening (&gt; 6%) — stress</td>
                <td className="py-2 text-gray-400">3-8% band</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Copper / Gold Ratio</td>
                <td className="py-2 pr-4 text-green-400">Rising — growth accelerating</td>
                <td className="py-2 pr-4 text-red-400">Falling — growth slowing</td>
                <td className="py-2 text-gray-400">"Dr Copper" cycle proxy</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">CPI (YoY)</td>
                <td className="py-2 pr-4 text-green-400">Falling toward 2% target</td>
                <td className="py-2 pr-4 text-red-400">Above 4% = rate-hike pressure</td>
                <td className="py-2 text-gray-400">Fed target: 2%</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Fed Funds Rate</td>
                <td className="py-2 pr-4 text-green-400">Cutting cycle</td>
                <td className="py-2 pr-4 text-red-400">Hiking cycle</td>
                <td className="py-2 text-gray-400">Neutral ~2.5%</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Unemployment Rate</td>
                <td className="py-2 pr-4 text-green-400">Stable 3.5-4.5%</td>
                <td className="py-2 pr-4 text-red-400">Rising &gt; 0.5% from low (Sahm rule)</td>
                <td className="py-2 text-gray-400">Lagging indicator</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">ISM Manufacturing PMI</td>
                <td className="py-2 pr-4 text-green-400">Above 50 rising</td>
                <td className="py-2 pr-4 text-red-400">Below 50 falling</td>
                <td className="py-2 text-gray-400">50 = expansion line</td>
              </tr>
              <tr className="border-b border-surface-border/50">
                <td className="py-2 pr-4 font-medium text-white">Fear & Greed Index</td>
                <td className="py-2 pr-4 text-green-400">Below 25 (extreme fear = contrarian buy)</td>
                <td className="py-2 pr-4 text-red-400">Above 75 (extreme greed = caution)</td>
                <td className="py-2 text-gray-400">0-100 composite</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-white">BTC Dominance</td>
                <td className="py-2 pr-4 text-green-400">Falling = alt-season</td>
                <td className="py-2 pr-4 text-red-400">Rising in bear = flight to BTC</td>
                <td className="py-2 text-gray-400">40-60% typical</td>
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
