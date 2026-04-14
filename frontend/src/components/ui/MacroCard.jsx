import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const SERIES_META = {
  fed_rate:        { label: 'Fed Rate',       unit: '%',  desc: 'Federal Funds Rate' },
  cpi_yoy:         { label: 'CPI (YoY)',      unit: '%',  desc: 'Consumer Price Index' },
  treasury_10y:    { label: '10Y Treasury',   unit: '%',  desc: '10-Year Yield' },
  dxy:             { label: 'DXY',            unit: '',   desc: 'US Dollar Index' },
  gdp_growth:      { label: 'GDP Growth',     unit: '%',  desc: 'Quarterly GDP Growth' },
  unemployment:    { label: 'Unemployment',   unit: '%',  desc: 'Unemployment Rate' },
  vix:             { label: 'VIX',            unit: '',   desc: 'Volatility Index' },
}

export default function MacroCard({ seriesId, value, prev, impact }) {
  const meta = SERIES_META[seriesId] ?? { label: seriesId, unit: '', desc: '' }
  const change = value != null && prev != null ? value - prev : null
  const isUp   = change > 0
  const isDown = change < 0

  return (
    <div className="card flex flex-col gap-2 hover:border-ember-500/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{meta.label}</p>
          <p className="text-[11px] text-parchment-muted truncate">{meta.desc}</p>
        </div>
        {impact && (
          <span className={`text-[10px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 border ${
            impact === 'bullish'  ? 'bg-bull/10 text-bull border-bull/30' :
            impact === 'bearish'  ? 'bg-bear/10 text-bear border-bear/30' :
            'bg-surface-hover text-parchment-muted border-surface-border'
          }`}>
            {impact}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2 mt-1">
        <span className="font-display text-2xl text-parchment tabular-nums leading-none">
          {value != null ? `${value.toFixed(2)}${meta.unit}` : '—'}
        </span>
        {change != null && (
          <span className={`flex items-center gap-0.5 text-xs font-mono tabular-nums mb-0.5 ${
            isUp ? 'text-bear' : isDown ? 'text-bull' : 'text-parchment-muted'
          }`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> :
             isDown ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {Math.abs(change).toFixed(2)}{meta.unit}
          </span>
        )}
      </div>
    </div>
  )
}
