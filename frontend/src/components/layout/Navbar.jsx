import { useState, useEffect } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Menu, Radio, Clock } from 'lucide-react'
import { marketApi } from '../../services/api'

function PriceTicker({ asset, label, quote }) {
  const realtimeEnabled = asset === 'BTC' || asset === 'GOLD'
  const { data, connected } = useWebSocket(realtimeEnabled ? asset : null)

  const price     = data?.price          ?? quote?.price          ?? null
  const changePct = data?.change_24h_pct ?? quote?.change_24h_pct ?? null
  const isUp      = changePct >= 0

  return (
    <div className="group flex items-center gap-2.5 pr-5 border-r border-surface-border last:border-r-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-parchment-faint">
        {label}
      </div>
      {price !== null ? (
        <>
          <span className="font-mono text-[13px] tabular-nums text-parchment">
            {price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
          {changePct !== null && (
            <span className={`font-mono text-[11px] tabular-nums hidden md:inline ${
              isUp ? 'text-bull' : 'text-bear'
            }`}>
              {isUp ? '▲' : '▼'}{Math.abs(changePct).toFixed(2)}%
            </span>
          )}
          {realtimeEnabled && (
            <span className={`h-1 w-1 rounded-full hidden lg:block ${
              connected ? 'bg-bull animate-pulse' : 'bg-parchment-faint'
            }`} />
          )}
        </>
      ) : (
        <span className="font-mono text-[11px] text-parchment-faint animate-shimmer">
          ──
        </span>
      )}
    </div>
  )
}

export default function Navbar({ onMenuToggle }) {
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [quotes, setQuotes] = useState({})

  useEffect(() => {
    const id = setInterval(() => setLastRefresh(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    marketApi.getQuotes(['BTC', 'GOLD', 'TSLA', 'ETH'])
      .then(r => setQuotes(Object.fromEntries((r.data ?? []).map(q => [q.asset, q]))))
      .catch(() => {})
  }, [])

  const issueDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase()

  return (
    <header className="relative flex-shrink-0 border-b border-surface-border bg-surface-card/70 backdrop-blur-md">
      {/* Top meta strip — masthead date line */}
      <div className="hidden lg:flex items-center justify-between px-8 py-1.5 border-b border-surface-border/60 font-mono text-[9px] uppercase tracking-[0.22em] text-parchment-faint">
        <span>Vol. I · Issue {Math.floor((Date.now() - new Date('2026-01-01').getTime()) / 86400000)}</span>
        <span>{issueDate}</span>
        <span className="flex items-center gap-2">
          <Radio className="w-2.5 h-2.5 text-bull animate-pulse" />
          Live Feed · NYSE · NASDAQ · CME · BINANCE
        </span>
      </div>

      {/* Main nav row */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
        <div className="flex items-center gap-5 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 text-parchment-muted hover:text-parchment transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-5 min-w-0 overflow-hidden">
            <PriceTicker asset="BTC"  label="BTC"  quote={quotes.BTC} />
            <div className="hidden sm:flex">
              <PriceTicker asset="GOLD" label="Au"  quote={quotes.GOLD} />
            </div>
            <div className="hidden md:flex">
              <PriceTicker asset="ETH"  label="ETH" quote={quotes.ETH} />
            </div>
            <div className="hidden xl:flex">
              <PriceTicker asset="TSLA" label="TSLA" quote={quotes.TSLA} />
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-parchment-muted">
          <Clock className="w-3 h-3" />
          <span className="hidden md:inline">Updated</span>
          <span className="text-parchment">
            {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="h-1 w-1 rounded-full bg-bull animate-pulse" />
        </div>
      </div>
    </header>
  )
}
