/**
 * PriceChart — Candlestick-style OHLC + Volume bars using Recharts
 * Recharts doesn't have a native CandlestickChart, so we use ComposedChart
 * with a custom candlestick renderer via the Bar shape prop.
 */
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

// Custom candlestick bar shape
function CandleShape(props) {
  const { x, y, width, payload } = props
  if (!payload) return null

  const { open, close, high, low } = payload
  const isUp    = close >= open
  const color   = isUp ? '#22c55e' : '#ef4444'
  const bodyTop = isUp ? close : open
  const bodyBot = isUp ? open  : close
  const barW    = Math.max(width * 0.6, 2)
  const cx      = x + width / 2

  // Map price → pixel (y is already the pixel for 'close' from Recharts)
  // We need to compute y positions from the chart's yAxis domain
  // Props include `yAxis` with domain; use the scale function if available
  const scale = props.yAxis?.scale
  if (!scale) return null

  const yHigh   = scale(high)
  const yLow    = scale(low)
  const yBodyT  = scale(bodyTop)
  const yBodyB  = scale(bodyBot)

  return (
    <g>
      {/* High-Low wick */}
      <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect
        x={cx - barW / 2}
        y={yBodyT}
        width={barW}
        height={Math.max(yBodyB - yBodyT, 1)}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  )
}

// Custom tooltip
function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const isUp = d.close >= d.open
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-white">O: <span className="font-mono">{d.open?.toFixed(2)}</span></p>
      <p className="text-white">H: <span className="font-mono">{d.high?.toFixed(2)}</span></p>
      <p className="text-white">L: <span className="font-mono">{d.low?.toFixed(2)}</span></p>
      <p className={`font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
        C: <span className="font-mono">{d.close?.toFixed(2)}</span>
      </p>
      {d.volume != null && (
        <p className="text-gray-400 mt-1">Vol: {d.volume?.toLocaleString()}</p>
      )}
    </div>
  )
}

export default function PriceChart({ data = [], height = 320, showSMA = true, showEMA = false, showBB = false }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height }}>
        No data available
      </div>
    )
  }

  // Format x-axis timestamps
  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.timestamp ?? d.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
  }))

  const allPrices = formatted.flatMap(d => [d.high, d.low]).filter(Boolean)
  const priceMin  = Math.floor(Math.min(...allPrices) * 0.995)
  const priceMax  = Math.ceil(Math.max(...allPrices) * 1.005)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={formatted} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="price"
          domain={[priceMin, priceMax]}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          width={60}
        />
        <YAxis
          yAxisId="volume"
          orientation="right"
          tick={{ fill: '#6b7280', fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : `${v}`}
          width={48}
        />
        <Tooltip content={<PriceTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
          iconType="line"
        />

        {/* Volume bars (behind candles) */}
        <Bar
          yAxisId="volume"
          dataKey="volume"
          name="Volume"
          fill="#3b82f640"
          stroke="#3b82f620"
          maxBarSize={6}
        />

        {/* Candlesticks rendered as a Bar with custom shape */}
        <Bar
          yAxisId="price"
          dataKey="close"
          name="Price"
          shape={<CandleShape />}
          legendType="none"
          maxBarSize={12}
        />

        {/* Optional overlays */}
        {showSMA && (
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sma_20"
            name="SMA 20"
            stroke="#60a5fa"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        )}
        {showSMA && (
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sma_50"
            name="SMA 50"
            stroke="#a78bfa"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        )}
        {showEMA && (
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="ema_20"
            name="EMA 20"
            stroke="#34d399"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        )}
        {showBB && (
          <>
            <Line yAxisId="price" type="monotone" dataKey="bb_upper" name="BB Upper" stroke="#f59e0b80" strokeWidth={1} dot={false} connectNulls strokeDasharray="4 2" />
            <Line yAxisId="price" type="monotone" dataKey="bb_lower" name="BB Lower" stroke="#f59e0b80" strokeWidth={1} dot={false} connectNulls strokeDasharray="4 2" />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
