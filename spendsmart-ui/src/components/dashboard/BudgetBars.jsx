import { formatINR } from '../../utils/currency'

/**
 * data: array of { category_id, budget, spent, pct }
 * (from /analytics/budget-status — category name comes separately;
 *  for the dashboard we show category_id as a label fallback until
 *  the categories list is merged in. DashboardPage can pass enriched data.)
 */
export default function BudgetBars({ data = [] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/80 mb-5">Budget Tracker</h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-white/20 text-sm">No budgets set</div>
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
                    <span className="text-xs font-medium text-white/70">
                      {b.category_name ?? `Category ${b.category_id}`}
                    </span>
                    {isOver && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-rose/20 text-accent-rose">OVER</span>}
                    {isWarning && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-amber/20 text-accent-amber">80%</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-white/60">{formatINR(b.spent)}</span>
                    <span className="text-xs text-white/30"> / {formatINR(b.budget)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
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
