import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AlertCircle, ArrowRight } from 'lucide-react'

const TICKER_TAPE = [
  { sym: 'BTC',  px: '67,421.08', chg: '+2.14' },
  { sym: 'ETH',  px: '3,284.55',  chg: '+1.87' },
  { sym: 'GOLD', px: '2,358.20',  chg: '+0.42' },
  { sym: 'TSLA', px: '248.31',    chg: '-1.02' },
  { sym: 'NVDA', px: '924.67',    chg: '+3.41' },
  { sym: 'AAPL', px: '189.45',    chg: '-0.18' },
  { sym: 'MSFT', px: '428.90',    chg: '+0.76' },
  { sym: 'AMZN', px: '184.12',    chg: '+1.29' },
  { sym: 'DXY',  px: '104.82',    chg: '-0.11' },
  { sym: 'VIX',  px: '13.42',     chg: '+4.60' },
]

function TickerStrip({ reverse = false }) {
  const cls = reverse ? 'animate-marquee-rev' : 'animate-marquee'
  return (
    <div className="marquee border-y border-surface-border py-2.5">
      <div className={`marquee-track ${cls}`}>
        {[...TICKER_TAPE, ...TICKER_TAPE].map((t, i) => {
          const up = !t.chg.startsWith('-')
          return (
            <span key={i} className="inline-flex items-center gap-2 font-mono text-[11px]">
              <span className="text-parchment-muted tracking-[0.15em]">{t.sym}</span>
              <span className="text-parchment">{t.px}</span>
              <span className={up ? 'text-bull' : 'text-bear'}>{up ? '▲' : '▼'} {t.chg}%</span>
              <span className="text-parchment-faint">·</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { login }   = useAuth()
  const navigate    = useNavigate()

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-surface text-parchment overflow-hidden">
      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* Ambient ember gradient */}
      <div
        className="pointer-events-none fixed inset-0 z-0 animate-glow-pulse"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 15% 20%, rgba(245,165,36,0.18), transparent 55%), radial-gradient(ellipse 70% 60% at 85% 90%, rgba(234,88,12,0.10), transparent 60%)',
        }}
      />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] lg:min-h-screen">

        {/* ── LEFT — editorial hero (form appears ABOVE this on mobile) ── */}
        <div className="relative order-2 lg:order-1 flex flex-col border-t lg:border-t-0 lg:border-r border-surface-border/60 p-8 lg:p-12 xl:p-16">

          {/* Wordmark */}
          <div className="flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="relative flex h-8 w-8 items-center justify-center border border-ember-500/60">
                <div className="h-1.5 w-1.5 bg-ember-500 animate-pulse" />
                <div className="absolute -inset-1 border border-ember-500/20" />
              </div>
              <div className="leading-none">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-parchment-muted">
                  MMXXVI · Vol. I
                </div>
                <div className="font-display text-lg text-parchment tracking-tight mt-1">
                  Deep Stock <span className="italic text-ember-500">Insights</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-parchment-muted">
              <div className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
              Markets Online
            </div>
          </div>

          {/* Hero copy */}
          <div className="flex-1 flex flex-col lg:justify-center max-w-2xl py-10 lg:py-20">
            <div className="eyebrow mb-6 animate-rise" style={{ animationDelay: '120ms' }}>
              ── The Editorial Terminal
            </div>

            <h1
              className="font-display font-light text-parchment text-display-sm sm:text-display-md lg:text-display-lg tracking-tightest animate-rise"
              style={{ animationDelay: '200ms', fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
            >
              Forecasts,
              <br />
              <span className="italic text-ember-500" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>
                rigorously
              </span>{' '}
              composed.
            </h1>

            <p
              className="mt-8 max-w-lg text-base lg:text-lg text-parchment-dim leading-relaxed animate-rise"
              style={{ animationDelay: '320ms' }}
            >
              An ensemble of <span className="font-mono text-ember-500">N-HiTS</span>,{' '}
              <span className="font-mono text-ember-500">LightGBM</span>, and{' '}
              <span className="font-mono text-ember-500">Temporal Fusion</span> models —
              wired to macro signals, sentiment feeds, and a paper-trading agent.
              Equal parts research desk and trading terminal.
            </p>

            {/* Stat row */}
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg animate-rise" style={{ animationDelay: '440ms' }}>
              {[
                { k: 'Models',     v: '07', sub: 'in ensemble' },
                { k: 'Assets',     v: '48', sub: 'tracked live' },
                { k: 'Latency',    v: '30s', sub: 'stream push' },
              ].map(s => (
                <div key={s.k} className="border-l border-surface-border pl-4">
                  <div className="eyebrow">{s.k}</div>
                  <div className="font-display text-3xl text-parchment mt-1">{s.v}</div>
                  <div className="font-mono text-[10px] text-parchment-faint uppercase tracking-wider mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticker tape */}
          <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
            <TickerStrip />
          </div>

          {/* Footer line */}
          <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-parchment-faint animate-fade-in" style={{ animationDelay: '700ms' }}>
            <span>§ 01 · Access</span>
            <span className="hidden sm:inline">A Birkbeck Research Project</span>
            <span>Est. 2026</span>
          </div>
        </div>

        {/* ── RIGHT — auth form (shows FIRST on mobile so sign-in is always visible) ── */}
        <div className="relative order-1 lg:order-2 flex items-center justify-center min-h-screen lg:min-h-0 p-8 lg:p-12">
          <div className="w-full max-w-sm animate-rise-slow">

            {/* Tag */}
            <div className="flex items-center gap-3 mb-10">
              <div className="h-px flex-1 bg-surface-border" />
              <span className="eyebrow">Credentials</span>
              <div className="h-px flex-1 bg-surface-border" />
            </div>

            <h2
              className="font-display font-light text-4xl lg:text-5xl text-parchment tracking-tight mb-2"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
            >
              Sign in.
            </h2>
            <p className="text-sm text-parchment-muted mb-10">
              Enter the terminal. <span className="caret" />
            </p>

            {error && (
              <div className="flex items-start gap-2.5 border border-bear/40 bg-bear/5 px-3 py-2.5 mb-6 text-xs text-bear font-mono">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="eyebrow block mb-2">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="input"
                  placeholder="you@terminal.io"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="eyebrow">Password</label>
                  <a href="#" className="font-mono text-[10px] uppercase tracking-[0.18em] text-parchment-muted hover:text-ember-500 transition-colors">
                    Forgot?
                  </a>
                </div>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="input"
                  placeholder="••••••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full group"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-surface animate-pulse" />
                    Authenticating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Enter Terminal
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-10 flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-border" />
              <span className="eyebrow">New here?</span>
              <div className="h-px flex-1 bg-surface-border" />
            </div>

            <Link
              to="/register"
              className="btn-ghost w-full mt-6 group"
            >
              Request Access
              <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Meta line */}
            <div className="mt-12 font-mono text-[9px] uppercase tracking-[0.22em] text-parchment-faint text-center leading-loose">
              Secure channel · TLS 1.3 encrypted
              <br />
              No data leaves the research desk.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
