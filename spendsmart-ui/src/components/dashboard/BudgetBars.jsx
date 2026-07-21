import { formatINR } from '../../utils/currency'

export default function BudgetBars({ data = [] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Budget Tracker</h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--text-muted)' }}>
          No budgets set
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((b) => {
            const pct = Math.min(b.pct, 100)
            const isOver = b.spent > b.budget
            const isWarning = pct >= 80 && !isOver

            return (
              <div key={b.category_id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {b.category_name ?? `Category ${b.category_id}`}
                    </span>
                    {isOver    && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500">OVER</span>}
                    {isWarning && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">80%</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatINR(b.spent)}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}> / {formatINR(b.budget)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-hover)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: isOver
                        ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
                        : isWarning
                          ? 'linear-gradient(90deg,#f59e0b,#fcd34d)'
                          : 'linear-gradient(90deg,#10b981,#34d399)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
