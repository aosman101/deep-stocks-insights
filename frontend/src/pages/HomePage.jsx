import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { marketApi, macroApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import FearGreedGauge from '../components/ui/FearGreedGauge'
import MacroCard from '../components/ui/MacroCard'
import SignalBadge from '../components/ui/SignalBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import NewsFeed from '../components/ui/NewsFeed'
import {
  TrendingUp, TrendingDown, Activity, BarChart2,
  Zap, Globe, ArrowUpRight, Bot, LineChart,
} from 'lucide-react'

const TOP_ASSETS = ['BTC', 'ETH', 'GOLD', 'TSLA', 'AAPL', 'MSFT', 'NVDA', 'AMZN']

/* ── Editorial quote row ── */
function QuoteRow({ symbol, quote, loading, index }) {
  const navigate = useNavigate()

  if (!quote && loading) {
    return (
      <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-5 py-3 border-b border-surface-border animate-pulse">
        <div className="font-mono text-[10px] text-parchment-faint">{String(index + 1).padStart(2, '0')}</div>
        <div className="h-3 w-20 bg-surface-hover" />
        <div className="h-3 w-16 bg-surface-hover" />
        <div className="h-3 w-12 bg-surface-hover" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-5 py-3 border-b border-surface-border text-parchment-faint">
        <div className="font-mono text-[10px]">{String(index + 1).padStart(2, '0')}</div>
        <div className="font-mono text-[13px] text-parchment">{symbol}</div>
        <div className="col-span-2 text-right font-mono text-[11px]">— unavailable</div>
      </div>
    )
  }

  const isUp = quote.change_24h_pct >= 0
  return (
    <button
      onClick={() => navigate('/graph-analysis?asset=' + symbol)}
      className="group w-full grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-5 py-3.5 border-b border-surface-border hover:bg-surface-hover/50 transition-all text-left"
    >
      <div className="font-mono text-[10px] text-parchment-faint group-hover:text-ember-500 transition-colors">
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-1.5 w-1.5 rounded-full ${isUp ? 'bg-bull' : 'bg-bear'} animate-pulse`} />
        <span className="font-mono text-[13px] tracking-wide text-parchment group-hover:text-ember-500 transition-colors">
          {symbol}
        </span>
      </div>

      <div className="text-right font-mono text-[13px] tabular-nums text-parchment">
        ${quote.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </div>

      <div className={`flex items-center gap-1.5 font-mono text-[11px] tabular-nums w-20 justify-end ${
        isUp ? 'text-bull' : 'text-bear'
      }`}>
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isUp ? '+' : ''}{quote.change_24h_pct?.toFixed(2)}%
      </div>
    </button>
  )
}

/* ── Editorial nav tile ── */
function DeskTile({ label, desc, icon: Icon, onClick, delay }) {
  return (
    <button
      onClick={onClick}
      className="group relative text-left p-6 border border-surface-border bg-surface-card/40 hover:bg-surface-card/70 hover:border-ember-500/40 transition-all duration-300 corners animate-rise overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Hover ember glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(245,165,36,0.08), transparent 60%)' }} />

      <div className="relative">
        <div className="flex items-start justify-end mb-5">
          <ArrowUpRight className="w-3.5 h-3.5 text-parchment-faint group-hover:text-ember-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>

        <Icon className="w-5 h-5 text-ember-500 mb-3" strokeWidth={1.5} />

        <div
          className="font-display text-xl text-parchment tracking-tight leading-tight mb-1.5"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 40' }}
        >
          {label}
        </div>
        <div className="text-[11px] text-parchment-muted leading-relaxed">{desc}</div>
      </div>
    </button>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [quotes, setQuotes] = useState({})
  const [macro,  setMacro]  = useState(null)
  const [fng,    setFng]    = useState(null)
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [macroLoading,  setMacroLoading]  = useState(true)
  const [fngLoading,    setFngLoading]    = useState(true)

  useEffect(() => {
    let active = true

    setQuotesLoading(true)
    marketApi.getQuotes(TOP_ASSETS)
      .then((response) => {
        if (!active) return
        setQuotes(Object.fromEntries((response.data ?? []).map(q => [q.asset, q])))
      })
      .catch(() => { if (active) setQuotes({}) })
      .finally(() => { if (active) setQuotesLoading(false) })

    setMacroLoading(true)
    macroApi.getSummary()
      .then((response) => { if (active) setMacro(response?.data ?? null) })
      .catch(() => { if (active) setMacro(null) })
      .finally(() => { if (active) setMacroLoading(false) })

    setFngLoading(true)
    macroApi.getFearGreed()
      .then((response) => { if (active) setFng(response?.data ?? null) })
      .catch(() => { if (active) setFng(null) })
      .finally(() => { if (active) setFngLoading(false) })

    return () => { active = false }
  }, [])

  const macroIndicators = macro ? Object.fromEntries(
    Object.entries(macro)
      .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
      .map(([k, v]) => [k, v.value])
  ) : {}
  const macroInsights = macro?.insights ?? []

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Masthead / Editorial Hero ── */}
      <section className="relative pt-6 pb-10 border-b border-surface-border">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-parchment-faint mb-6">
          <span>Today's Desk</span>
          <span className="hidden sm:inline">{today}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-end">
          <div>
            <div className="eyebrow mb-3 animate-fade-in">
              Welcome back · <span className="text-ember-500">{user?.full_name || user?.username}</span>
            </div>

            <h1
              className="font-display font-light text-parchment tracking-tightest animate-rise"
              style={{
                fontSize: 'clamp(2.5rem, 6vw, 5.5rem)',
                lineHeight: 0.9,
                animationDelay: '100ms',
                fontVariationSettings: '"opsz" 144, "SOFT" 30',
              }}
            >
              The market
              <br />
              <span className="italic text-ember-500" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>
                reads you back.
              </span>
            </h1>

            <p
              className="mt-6 max-w-xl text-[15px] text-parchment-dim leading-relaxed animate-rise"
              style={{ animationDelay: '250ms' }}
            >
              Today's desk: N-HiTS ensemble live on 48 assets, LightGBM classifier armed,
              and the Temporal Fusion Transformer idling at the ready. Where shall we look?
            </p>
          </div>

          <div className="flex flex-wrap gap-2 animate-rise" style={{ animationDelay: '350ms' }}>
            <button onClick={() => navigate('/agent')} className="btn-ghost">
              <Bot className="w-3.5 h-3.5" /> Agent Desk
            </button>
            <button onClick={() => navigate('/graph-analysis')} className="btn-ghost">
              <LineChart className="w-3.5 h-3.5" /> Charts
            </button>
            <button onClick={() => navigate('/ai-insights')} className="btn-primary">
              <Zap className="w-3.5 h-3.5" /> AI Insights
            </button>
          </div>
        </div>
      </section>

      {/* ── Desk tiles ── */}
      <section className="py-10 border-b border-surface-border">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">Dispatches</div>
            <h2 className="section-title mb-0">Choose your desk</h2>
          </div>
          <div className="hidden md:block font-mono text-[10px] uppercase tracking-[0.22em] text-parchment-faint">
            5 departments
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <DeskTile label="Predict"     desc="Unified N-HiTS + LightGBM forecasts on any asset, any horizon."  icon={TrendingUp} onClick={() => navigate('/predict')}       delay={100} />
          <DeskTile label="Charts"      desc="Full indicator suite: RSI, MACD, Bollinger, correlation heatmaps." icon={Activity}  onClick={() => navigate('/graph-analysis')} delay={180} />
          <DeskTile label="Comparison"  desc="Back-test the ensemble. Rank models by MAPE, Sharpe, and hit-rate." icon={BarChart2}  onClick={() => navigate('/comparison')}     delay={260} />
          <DeskTile label="AI Insights" desc="Scanner across the entire universe. Signal scoring & ranking."     icon={Zap}        onClick={() => navigate('/ai-insights')}    delay={340} />
          <DeskTile label="Agent Desk"  desc="Paper-trading agents with equity curves and session telemetry."    icon={Bot}        onClick={() => navigate('/agent')}          delay={420} />
        </div>
      </section>

      {/* ── Main grid: Movers + Sentiment ── */}
      <section className="py-10 border-b border-surface-border">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">

          {/* Live movers — editorial leaderboard */}
          <div className="card p-0 corners">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
              <div>
                <div className="eyebrow mb-1">Live Feed</div>
                <h3 className="font-display text-xl text-parchment tracking-tight" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}>
                  Today's movers
                </h3>
              </div>
              <button
                onClick={() => navigate('/graph-analysis')}
                className="group flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-parchment-muted hover:text-ember-500 transition-colors"
              >
                See all charts
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-5 py-2 border-b border-surface-border/60 bg-surface/40">
              <div className="eyebrow">№</div>
              <div className="eyebrow">Symbol</div>
              <div className="eyebrow text-right">Last</div>
              <div className="eyebrow w-20 text-right">24h Δ</div>
            </div>

            <div>
              {TOP_ASSETS.map((sym, i) => (
                <QuoteRow key={sym} symbol={sym} quote={quotes[sym]} loading={quotesLoading} index={i} />
              ))}
            </div>
          </div>

          {/* Sentiment column */}
          <div className="space-y-5">
            {/* Fear & Greed */}
            {fngLoading ? (
              <div className="card flex items-center justify-center h-52 corners">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="corners">
                <FearGreedGauge
                  value={fng?.value}
                  classification={fng?.classification ?? fng?.value_classification}
                  updated={fng?.updated_at}
                />
              </div>
            )}

            {/* Macro headline */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="eyebrow mb-1">Macro</div>
                  <h4 className="font-display text-base text-parchment tracking-tight">
                    Global pulse
                  </h4>
                </div>
                <Globe className="w-3.5 h-3.5 text-ember-500" />
              </div>
              {macroLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="grid grid-cols-2 gap-px bg-surface-border">
                  {Object.entries(macroIndicators).slice(0, 6).map(([key, val]) => (
                    <div key={key} className="bg-surface-card px-3 py-2.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-parchment-faint capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="font-mono text-[15px] tabular-nums text-parchment mt-0.5">
                        {typeof val === 'number' ? val.toFixed(2) : val ?? '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Macro indicator cards ── */}
      {!macroLoading && macroIndicators && Object.keys(macroIndicators).length > 0 && (
        <section className="py-10 border-b border-surface-border">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <div className="eyebrow mb-1">Fixtures</div>
              <h2 className="section-title mb-0">Macro indicators</h2>
            </div>
            <div className="hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-parchment-faint">
              <Globe className="w-3 h-3" />
              Source · FRED
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'fed_rate',     key: 'fed_funds_rate' },
              { id: 'cpi_yoy',      key: 'cpi_yoy' },
              { id: 'treasury_10y', key: 'treasury_10y' },
              { id: 'dxy',          key: 'usd_index' },
              { id: 'unemployment', key: 'unemployment' },
              { id: 'vix',          key: 'vix' },
            ].map(({ id, key }) => {
              const raw = macroIndicators[key] ?? macroIndicators[id]
              const val = typeof raw === 'object' && raw !== null ? raw.value : raw
              return (
                <MacroCard
                  key={id}
                  seriesId={id}
                  value={val != null ? Number(val) : null}
                  impact={null}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* ── AI macro insights ── */}
      {!macroLoading && macroInsights.length > 0 && (
        <section className="py-10 border-b border-surface-border">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <div className="eyebrow mb-1">Editorial</div>
              <h2 className="section-title mb-0">Macro AI insights</h2>
            </div>
          </div>
          <div className="card">
            <div className="space-y-4">
              {macroInsights.map((insight, i) => (
                <div key={i} className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-b-0 border-surface-border">
                  <div className="flex-shrink-0 pt-0.5">
                    <SignalBadge signal={insight.sentiment ?? insight.signal} size="sm" />
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-display text-base text-parchment tracking-tight mb-1">
                      {insight.title ?? insight.asset}
                    </div>
                    <div className="text-parchment-muted leading-relaxed">
                      {insight.body ?? insight.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── News feed ── */}
      <section className="py-10 border-b border-surface-border">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <div className="eyebrow mb-1">Wires</div>
            <h2 className="section-title mb-0">From the market desk</h2>
          </div>
        </div>
        <NewsFeed category="general" maxItems={6} />
      </section>

      {/* ── Colophon ── */}
      <footer className="py-8 text-center">
        <div className="eyebrow mb-3">Disclaimer</div>
        <p className="max-w-xl mx-auto text-[11px] text-parchment-faint leading-relaxed">
          All forecasts are generated by machine learning models and should be treated as
          one tool among many in your research. Past performance is not indicative of future returns.
        </p>
        <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.22em] text-parchment-faint">
          Deep Stock Insights · A Birkbeck Research Project
        </div>
      </footer>
    </div>
  )
}
