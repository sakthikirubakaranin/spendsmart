import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatINRCompact, formatINR } from '../../utils/currency'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl space-y-1.5"
      style={{ border: '1px solid var(--border-medium)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatINR(p.value)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="pt-1.5 border-t flex justify-between text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
          <span>Net</span>
          <span className={payload[0].value - payload[1].value >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
            {formatINR(Math.abs(payload[0].value - payload[1].value))}
            {' '}{payload[0].value - payload[1].value >= 0 ? 'surplus' : 'deficit'}
          </span>
        </div>
      )}
    </div>
  )
}

export default function MonthlyTrend({ data = [] }) {
  const hasIncome = data.some(d => (d.income || 0) > 0)

  const chartData = data.map(d => ({
    name: `${MONTH_NAMES[d.month - 1]} '${String(d.year).slice(2)}`,
    Income:   d.income || 0,
    Expenses: d.total  || 0,
  }))

  // CSS var values resolved at render — safe for recharts SVG props
  const tickColor  = 'var(--text-muted)'
  const gridColor  = 'var(--border-subtle)'
  const cursorFill = 'var(--bg-surface-hover)'

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        {hasIncome ? 'Income vs Expenses' : 'Monthly Spending'}
      </h3>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-muted)' }}>
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={hasIncome ? 12 : 22} barGap={3} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: tickColor, fontSize: 11 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={formatINRCompact}
              tick={{ fill: tickColor, fontSize: 11 }}
              axisLine={false} tickLine={false} width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorFill }} />
            {hasIncome && (
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: 'var(--text-secondary)' }}
                formatter={(val) => <span style={{ color: 'var(--text-secondary)' }}>{val}</span>}
              />
            )}
            {hasIncome && <Bar dataKey="Income"   fill="#34d399" radius={[4,4,0,0]} />}
            <Bar dataKey="Expenses" fill="#8b5cf6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
