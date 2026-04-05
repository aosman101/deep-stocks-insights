export default function SignalBadge({ signal, size = 'md' }) {
  const map = {
    BUY:  'badge-buy',
    SELL: 'badge-sell',
    HOLD: 'badge-hold',
  }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  const cls = map[signal?.toUpperCase()] ?? 'badge-hold'
  return (
    <span className={`${cls} ${sizeClass} rounded-full font-semibold inline-block`}>
      {signal ?? 'HOLD'}
    </span>
  )
}
