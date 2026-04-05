export default function StatCard({ title, value, sub, trend, icon: Icon, accent = false }) {
  const isUp = trend === 'up'
  const isDown = trend === 'down'

  return (
    <div className={`card flex flex-col gap-3 ${accent ? 'border-accent-blue/40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{value ?? '—'}</p>
        {sub && (
          <p className={`text-sm mt-1 font-medium ${
            isUp ? 'stat-up' : isDown ? 'stat-down' : 'text-gray-400'
          }`}>
            {isUp ? '▲' : isDown ? '▼' : ''} {sub}
          </p>
        )}
      </div>
    </div>
  )
}
