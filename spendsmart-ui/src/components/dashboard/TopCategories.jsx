import { formatINR } from '../../utils/currency'

const GRADIENTS = [
  'linear-gradient(90deg,#8b5cf6,#a78bfa)',
  'linear-gradient(90deg,#06b6d4,#22d3ee)',
  'linear-gradient(90deg,#f59e0b,#fbbf24)',
  'linear-gradient(90deg,#ec4899,#f472b6)',
  'linear-gradient(90deg,#10b981,#34d399)',
  'linear-gradient(90deg,#ef4444,#f87171)',
]

/**
 * data: array of { slug, name, icon, amount, pct } — from /analytics/by-category
 */
export default function TopCategories({ data = [] }) {
  const top = data.filter(c => c.amount > 0).slice(0, 6)
  if (top.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/80 mb-4">Top Categories</h3>
        <div className="flex items-center justify-center h-32 text-white/20 text-sm">No data yet</div>
      </div>
    )
  }

  const max = top[0].amount

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/80 mb-5">Top Categories</h3>
      <div className="space-y-4">
        {top.map((cat, i) => (
          <div key={cat.slug}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none flex-shrink-0">{cat.icon}</span>
                <span className="text-sm text-slate-300 truncate">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-slate-500">{cat.pct}%</span>
                <span className="text-sm font-semibold text-white">{formatINR(cat.amount)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(cat.amount / max) * 100}%`, background: GRADIENTS[i % GRADIENTS.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
