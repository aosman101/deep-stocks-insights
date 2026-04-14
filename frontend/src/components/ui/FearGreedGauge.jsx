/**
 * Fear & Greed Gauge
 * Renders a half-circle gauge (0=Extreme Fear → 100=Extreme Greed)
 */
export default function FearGreedGauge({ value, classification, updated }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 50))

  // 0 → -180deg (left), 100 → 0deg (right), needle at centre bottom
  const angle = -180 + (safeValue / 100) * 180

  const getColor = (v) => {
    if (v <= 25)  return '#ef4444'   // extreme fear
    if (v <= 45)  return '#f97316'   // fear
    if (v <= 55)  return '#eab308'   // neutral
    if (v <= 75)  return '#84cc16'   // greed
    return '#22c55e'                  // extreme greed
  }

  const color = getColor(safeValue)

  // Arc segments
  const segments = [
    { label: 'Extreme Fear', color: '#ef4444', from: 0,  to: 25 },
    { label: 'Fear',         color: '#f97316', from: 25, to: 45 },
    { label: 'Neutral',      color: '#eab308', from: 45, to: 55 },
    { label: 'Greed',        color: '#84cc16', from: 55, to: 75 },
    { label: 'Extreme Greed',color: '#22c55e', from: 75, to: 100 },
  ]

  // Convert value (0-100) to SVG arc path
  const toRad = (deg) => (deg * Math.PI) / 180
  const cx = 100, cy = 100, r = 70

  function arcPath(fromVal, toVal) {
    const fromDeg = 180 + (fromVal / 100) * 180
    const toDeg   = 180 + (toVal  / 100) * 180
    const x1 = cx + r * Math.cos(toRad(fromDeg))
    const y1 = cy + r * Math.sin(toRad(fromDeg))
    const x2 = cx + r * Math.cos(toRad(toDeg))
    const y2 = cy + r * Math.sin(toRad(toDeg))
    const large = (toVal - fromVal) > 50 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  // Needle tip
  const needleDeg = 180 + (safeValue / 100) * 180
  const nx = cx + (r - 10) * Math.cos(toRad(needleDeg))
  const ny = cy + (r - 10) * Math.sin(toRad(needleDeg))

  return (
    <div className="card flex flex-col items-center gap-2">
      <div className="flex items-center justify-between w-full">
        <p className="eyebrow">Fear &amp; Greed</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-parchment-faint">
          Sentiment
        </p>
      </div>

      <svg viewBox="0 0 200 110" className="w-52 h-28 mt-2">
        {/* Background arc segments */}
        {segments.map(seg => (
          <path
            key={seg.label}
            d={arcPath(seg.from, seg.to)}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeOpacity="0.3"
          />
        ))}

        {/* Filled arc up to current value */}
        <path
          d={arcPath(0, safeValue)}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={color} />
      </svg>

      {/* Value + label */}
      <div className="text-center -mt-3">
        <p className="font-display text-4xl font-light tabular-nums leading-none" style={{ color }}>
          {safeValue}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] mt-1.5" style={{ color }}>
          {classification ?? 'Neutral'}
        </p>
      </div>

      {updated && (
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-parchment-faint mt-1">
          Updated · {updated}
        </p>
      )}
    </div>
  )
}
