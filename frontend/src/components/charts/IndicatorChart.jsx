/**
 * IndicatorChart — Renders RSI, MACD, Stochastic, Williams%R, CCI, ADX, ATR
 * as separate sub-chart panels stacked below the price chart.
 */
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function SmallTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#fff' }}>
          {p.name}: <span className="font-mono">{Number(p.value).toFixed(2)}</span>
        </p>
      ))}
    </div>
  )
}

function SubChart({ title, children, height = 100 }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 font-medium ml-2 mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export default function IndicatorChart({
  data = [],
  indicators = ['RSI', 'MACD'],
}) {
  if (!data.length) return null

  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.timestamp ?? d.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
  }))

  const tickProps = {
    tick: { fill: '#6b7280', fontSize: 9 },
    tickLine: false,
    axisLine: false,
    interval: 'preserveStartEnd',
  }

  return (
    <div>
      {indicators.includes('RSI') && (
        <SubChart title="RSI (14)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} hide />
            <YAxis domain={[0, 100]} ticks={[30, 50, 70]} {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="rsi_14" name="RSI" stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}

      {indicators.includes('MACD') && (
        <SubChart title="MACD (12,26,9)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} hide />
            <YAxis {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <ReferenceLine y={0} stroke="#4b5563" />
            <Bar dataKey="macd_histogram" name="Histogram" fill="#6b7280"
              shape={(props) => {
                const fill = props.value >= 0 ? '#22c55e' : '#ef4444'
                return <rect {...props} fill={fill} fillOpacity={0.7} />
              }}
              maxBarSize={6}
            />
            <Line type="monotone" dataKey="macd" name="MACD" stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="macd_signal" name="Signal" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}

      {indicators.includes('Stochastic') && (
        <SubChart title="Stochastic (14,3,3)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} hide />
            <YAxis domain={[0, 100]} ticks={[20, 50, 80]} {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="stoch_k" name="%K" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="stoch_d" name="%D" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}

      {indicators.includes('ADX') && (
        <SubChart title="ADX (14)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} hide />
            <YAxis domain={[0, 100]} ticks={[25, 50, 75]} {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="adx_14" name="ADX" stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="plus_di" name="+DI" stroke="#22c55e" strokeWidth={1} dot={false} connectNulls />
            <Line type="monotone" dataKey="minus_di" name="-DI" stroke="#ef4444" strokeWidth={1} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}

      {indicators.includes('ATR') && (
        <SubChart title="ATR (14)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} />
            <YAxis {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <Line type="monotone" dataKey="atr_14" name="ATR" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}

      {indicators.includes('Williams') && (
        <SubChart title="Williams %R (14)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} hide />
            <YAxis domain={[-100, 0]} ticks={[-80, -50, -20]} {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <ReferenceLine y={-20} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={-80} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="williams_r" name="%R" stroke="#e879f9" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}

      {indicators.includes('CCI') && (
        <SubChart title="CCI (20)">
          <ComposedChart data={formatted} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="date" {...tickProps} hide />
            <YAxis {...tickProps} width={28} />
            <Tooltip content={<SmallTooltip />} />
            <ReferenceLine y={100}  stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={-100} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={0} stroke="#4b5563" />
            <Line type="monotone" dataKey="cci_20" name="CCI" stroke="#fb923c" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </SubChart>
      )}
    </div>
  )
}
