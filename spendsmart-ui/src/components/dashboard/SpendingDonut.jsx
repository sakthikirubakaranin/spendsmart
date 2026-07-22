import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatINR } from '../../utils/currency'

const COLORS = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#f43f5e','#fb923c','#a78bfa','#34d399']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl border border-white/10">
      <p className="text-sm font-semibold text-white">{d.icon} {d.name}</p>
      <p className="text-lg font-bold mt-0.5 text-accent-purple">{formatINR(d.amount)}</p>
      <p className="text-xs text-white/40">{d.pct}% of total</p>
    </div>
  )
}

/**
 * data: array of { category_id, name, icon, amount, pct }
 */
export default function SpendingDonut({ data = [] }) {
  const chartData = data.slice(0, 8).map((c, i) => ({ ...c, color: COLORS[i % COLORS.length] }))

  return (
    <div className="glass rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80">Spend by Category</h3>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-sm">No expenses yet</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="amount" stroke="none" paddingAngle={2}>
                {chartData.map((entry, i) => (
                  <Cell key={entry.category_id} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
            {chartData.map(cat => (
              <div key={cat.category_id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span className="text-xs text-white/50 truncate">{cat.name}</span>
                <span className="text-xs text-white/30 ml-auto">{cat.pct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
