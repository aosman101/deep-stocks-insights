import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { scannerApi } from '../../services/api'

const FEATURED = [
  { symbol: 'BTC',  name: 'Bitcoin',    type: 'crypto' },
  { symbol: 'ETH',  name: 'Ethereum',   type: 'crypto' },
  { symbol: 'GOLD', name: 'Gold',       type: 'commodity' },
  { symbol: 'GAS',  name: 'Gasoline',   type: 'commodity' },
  { symbol: 'OIL',  name: 'Crude Oil',  type: 'commodity' },
  { symbol: 'DIESEL', name: 'Diesel',   type: 'commodity' },
  { symbol: 'TSLA', name: 'Tesla',      type: 'stock' },
  { symbol: 'AAPL', name: 'Apple',      type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft',  type: 'stock' },
]

export default function AssetSelector({ value, onChange, assetType = 'all', allowedSymbols = null }) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [assets, setAssets]   = useState(FEATURED)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const allowedSet = allowedSymbols ? new Set(allowedSymbols.map(s => s.toUpperCase())) : null

  // Load full asset list from API
  useEffect(() => {
    setLoading(true)
    scannerApi.getAssets()
      .then(r => {
        const crypto = r.data.crypto ?? []
        const stocks = r.data.stocks ?? []
        const all    = [...crypto, ...stocks]
        setAssets(all.length ? all : FEATURED)
      })
      .catch(() => setAssets(FEATURED))
      .finally(() => setLoading(false))
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = assets.filter(a => {
    const matchAllowed = !allowedSet || allowedSet.has(a.symbol.toUpperCase())
    const matchType = assetType === 'all' || a.type === assetType
    const matchQuery = !query || a.symbol.toLowerCase().includes(query.toLowerCase()) ||
      a.name?.toLowerCase().includes(query.toLowerCase())
    return matchAllowed && matchType && matchQuery
  }).slice(0, 30)

  const selected = assets.find(a => a.symbol === value) ?? (value ? { symbol: value, name: value } : null)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-white hover:border-accent-blue/50 transition-colors min-w-[160px]"
      >
        {selected ? (
          <span className="flex-1 text-left font-medium">
            {selected.symbol}
            <span className="ml-2 text-gray-400 font-normal text-xs">{selected.name}</span>
          </span>
        ) : (
          <span className="flex-1 text-left text-gray-400">Select asset…</span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-surface-card border border-surface-border rounded-xl shadow-xl z-50">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search symbol or name…"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <p className="px-4 py-3 text-xs text-gray-500">Loading assets…</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-500">No assets found</p>
            )}
            {filtered.map(a => (
              <button
                key={a.symbol}
                onClick={() => { onChange(a.symbol); setOpen(false); setQuery('') }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-hover transition-colors ${
                  a.symbol === value ? 'text-accent-blue bg-accent-blue/10' : 'text-white'
                }`}
              >
                <span className="font-mono font-semibold w-14 text-left">{a.symbol}</span>
                <span className="text-gray-400 text-xs truncate flex-1 text-left">{a.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  a.type === 'crypto' ? 'bg-accent-blue/20 text-accent-blue' :
                  a.type === 'commodity' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {a.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
