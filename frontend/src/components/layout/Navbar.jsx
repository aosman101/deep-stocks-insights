import { useState, useEffect } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import { Menu, Wifi, RefreshCw } from 'lucide-react'
import { marketApi } from '../../services/api'

function PriceTicker({ asset, label, color, quote }) {
  const realtimeEnabled = asset === 'BTC' || asset === 'GOLD'
  const { data, connected } = useWebSocket(realtimeEnabled ? asset : null)

  const price    = data?.price     ?? quote?.price     ?? null
  const changePct = data?.change_24h_pct ?? quote?.change_24h_pct ?? null
  const isUp     = changePct >= 0

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover rounded-lg">
      <span className={`text-xs font-bold ${color}`}>{label}</span>
      {price !== null ? (
        <>
          <span className="text-sm font-mono text-white">
            ${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
          {changePct !== null && (
            <span className={`text-xs font-medium hidden sm:inline ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-gray-500 animate-pulse">Loading…</span>
      )}
      <Wifi className={`w-3 h-3 hidden sm:block ${realtimeEnabled && connected ? 'text-green-500' : 'text-gray-600'}`} />
    </div>
  )
}

export default function Navbar({ onMenuToggle }) {
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [quotes, setQuotes] = useState({})

  // Update timestamp every 30 seconds to match WS push interval
  useEffect(() => {
    const id = setInterval(() => setLastRefresh(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    marketApi.getQuotes(['BTC', 'GOLD', 'TSLA'])
      .then(r => setQuotes(Object.fromEntries((r.data ?? []).map(quote => [quote.asset, quote]))))
      .catch(() => {})
  }, [])

  return (
    <header className="flex-shrink-0 h-14 bg-surface-card border-b border-surface-border flex items-center justify-between px-4 sm:px-6">
      {/* Left side: hamburger + tickers */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Live price tickers — hide some on small screens */}
        <div className="flex items-center gap-2">
          <PriceTicker asset="BTC"  label="BTC"  color="text-btc" quote={quotes.BTC} />
          <div className="hidden md:block">
            <PriceTicker asset="GOLD" label="GOLD" color="text-gold" quote={quotes.GOLD} />
          </div>
          <div className="hidden lg:block">
            <PriceTicker asset="TSLA" label="TSLA" color="text-accent-blue" quote={quotes.TSLA} />
          </div>
        </div>
      </div>

      {/* Right side: last refresh */}
      <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
        <RefreshCw className="w-3 h-3" />
        <span>
          Live data · updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </header>
  )
}
