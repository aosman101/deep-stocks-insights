/**
 * MonteCarloCone
 * Renders the Monte Carlo simulation fan chart:
 *   - solid line for historical close prices
 *   - shaded bands for percentile cones (p5-p95, p25-p75)
 *   - dashed line for median projection
 */
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

function MCTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-mono">${Number(p.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </p>
      ))}
    </div>
  )
}

export default function MonteCarloCone({ historicalData = [], projectionData = [], height = 260 }) {
  // historicalData: [{date, close}, ...]
  // projectionData: [{date, p5, p25, median, p75, p95}, ...]

  const histFormatted = historicalData.slice(-60).map(d => ({
    date: new Date(d.timestamp ?? d.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    close: d.close,
  }))

  const projFormatted = projectionData.map((d, i) => ({
    date: `+${i + 1}d`,
    p5_p95: [d.p5, d.p95],
    p25_p75: [d.p25, d.p75],
    median: d.median,
  }))

  const combined = [
    ...histFormatted,
    // connector: last historical price as start of projection
    ...(projFormatted.length && histFormatted.length
      ? [{ date: histFormatted[histFormatted.length - 1].date, connector: histFormatted[histFormatted.length - 1].close }]
      : []),
    ...projFormatted,
  ]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={combined} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <defs>
          <linearGradient id="coneWide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="coneNarrow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          width={60}
        />
        <Tooltip content={<MCTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />

        {/* Wide band p5–p95 */}
        <Area
          type="monotone"
          dataKey="p5_p95"
          name="90% range"
          fill="url(#coneWide)"
          stroke="none"
          connectNulls
        />

        {/* Narrow band p25–p75 */}
        <Area
          type="monotone"
          dataKey="p25_p75"
          name="50% range"
          fill="url(#coneNarrow)"
          stroke="#3b82f640"
          strokeWidth={1}
          connectNulls
        />

        {/* Historical line */}
        <Line
          type="monotone"
          dataKey="close"
          name="Actual"
          stroke="#60a5fa"
          strokeWidth={2}
          dot={false}
          connectNulls
        />

        {/* Median projection */}
        <Line
          type="monotone"
          dataKey="median"
          name="Median forecast"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
