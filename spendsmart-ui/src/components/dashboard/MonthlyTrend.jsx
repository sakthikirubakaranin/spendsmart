import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatINRCompact, formatINR } from '../../utils/currency'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl border border-white/10 space-y-1.5">
      <p className="text-xs font-semibold text-white/60 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="text-white font-bold">{formatINR(p.value)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="pt-1.5 border-t border-white/10 flex justify-between text-xs text-slate-500">
          <span>Net</span>
          <span className={payload[0].value - payload[1].value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {formatINR(Math.abs(payload[0].value - payload[1].value))}
            {' '}{payload[0].value - payload[1].value >= 0 ? 'surplus' : 'deficit'}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * data: array of { year, month, total, income } from /analytics/monthly-trend
 */
export default function MonthlyTrend({ data = [] }) {
  const hasIncome = data.some(d => (d.income || 0) > 0)

  const chartData = data.map(d => ({
    name: `${MONTH_NAMES[d.month - 1]} '${String(d.year).slice(2)}`,
    Income:   d.income || 0,
    Expenses: d.total  || 0,
  }))

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/80 mb-4">
        {hasIncome ? 'Income vs Expenses' : 'Monthly Spending'}
      </h3>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={hasIncome ? 12 : 22} barGap={3} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={formatINRCompact}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
              axisLine={false} tickLine={false} width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            {hasIncome && (
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                formatter={(val) => <span style={{ color: 'rgba(255,255,255,0.5)' }}>{val}</span>}
              />
            )}
            {hasIncome && (
              <Bar dataKey="Income" fill="#34d399" radius={[4, 4, 0, 0]} />
            )}
            <Bar dataKey="Expenses" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
