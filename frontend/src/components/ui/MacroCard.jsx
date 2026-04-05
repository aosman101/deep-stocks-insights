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
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{meta.label}</p>
          <p className="text-xs text-gray-600">{meta.desc}</p>
        </div>
        {impact && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            impact === 'bullish'  ? 'bg-green-500/20 text-green-400' :
            impact === 'bearish'  ? 'bg-red-500/20 text-red-400' :
            'bg-gray-700 text-gray-400'
          }`}>
            {impact}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className="text-xl font-bold text-white">
          {value != null ? `${value.toFixed(2)}${meta.unit}` : '—'}
        </span>
        {change != null && (
          <span className={`flex items-center gap-0.5 text-sm font-medium mb-0.5 ${
            isUp ? 'text-red-400' : isDown ? 'text-green-400' : 'text-gray-400'
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
