import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatINRCompact, formatINR } from '../../utils/currency'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl border border-white/10">
      <p className="text-sm font-semibold text-white/80 mb-1">{label}</p>
      <p className="text-base font-bold text-accent-purple">{formatINR(payload[0]?.value)}</p>
    </div>
  )
}

/**
 * data: array of { year, month, total } from /analytics/monthly-trend
 */
export default function MonthlyTrend({ data = [] }) {
  const chartData = data.map(d => ({
    name: `${MONTH_NAMES[d.month - 1]} ${String(d.year).slice(2)}`,
    total: d.total,
  }))

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/80 mb-4">Monthly Trend</h3>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatINRCompact} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
