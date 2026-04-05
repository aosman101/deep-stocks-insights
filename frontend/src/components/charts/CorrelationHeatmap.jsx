/**
 * CorrelationHeatmap
 * Renders an NxN correlation matrix as a colour-coded grid.
 * Takes a `matrix` prop: { labels: string[], values: number[][] }
 */
export default function CorrelationHeatmap({ matrix }) {
  if (!matrix?.labels?.length) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No correlation data available
      </div>
    )
  }

  const { labels, values } = matrix
  const normalizedValues = values.map(row => row.map(value => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
  )))

  const cellColor = (v) => {
    if (v == null) {
      return '#1e2538'
    }
    // v in [-1, 1]
    // -1 → red, 0 → dark, +1 → green
    if (v >= 0) {
      return `rgba(34, 197, 94, ${v * 0.7 + 0.05})`   // green
    } else {
      return `rgba(239, 68, 68, ${Math.abs(v) * 0.7 + 0.05})`  // red
    }
  }

  const textColor = (v) => {
    if (v == null) return '#6b7280'
    return Math.abs(v) > 0.5 ? '#fff' : '#9ca3af'
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="w-16" />
            {labels.map(l => (
              <th key={l} className="px-1 py-1 text-gray-400 font-medium text-center w-14">
                <span className="block truncate max-w-[48px]">{l}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {normalizedValues.map((row, i) => (
            <tr key={labels[i]}>
              <td className="pr-2 py-0.5 text-gray-400 font-medium text-right whitespace-nowrap">
                {labels[i]}
              </td>
              {row.map((v, j) => (
                <td
                  key={j}
                  className="text-center font-mono rounded"
                  style={{
                    backgroundColor: cellColor(v),
                    color: textColor(v),
                    width: 48,
                    height: 36,
                    border: '1px solid #1e2538',
                  }}
                >
                  {v == null ? '—' : v.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <div className="w-4 h-4 rounded" style={{ background: 'rgba(239,68,68,0.75)' }} />
        <span>-1 (negative)</span>
        <div className="w-4 h-4 rounded mx-2" style={{ background: '#1e2538', border: '1px solid #2a3347' }} />
        <span>0 (none)</span>
        <div className="w-4 h-4 rounded mx-2" style={{ background: 'rgba(34,197,94,0.75)' }} />
        <span>+1 (positive)</span>
      </div>
    </div>
  )
}
