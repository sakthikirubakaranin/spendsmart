import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatINR } from '../../utils/currency'

export default function MetricCard({ icon, label, value, sub, trend, trendValue, accentColor = '#8b5cf6', isLarge = false }) {
  const isPositiveTrend = trend === 'up'

  return (
    <div className="glass glass-hover rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{ minHeight: isLarge ? '140px' : '120px' }}>

      {/* Background glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ background: accentColor }} />

      {/* Icon + label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: `${accentColor}22`, border: `1px solid ${accentColor}44` }}>
            {icon}
          </div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        </div>

        {trendValue !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold
            ${isPositiveTrend ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
            {isPositiveTrend ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trendValue)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div>
        <p className={`font-bold tracking-tight ${isLarge ? 'text-3xl' : 'text-2xl'}`}
          style={{ color: accentColor === '#8b5cf6' ? undefined : accentColor }}
          className={`font-bold tracking-tight ${isLarge ? 'text-3xl' : 'text-2xl'} ${accentColor === '#8b5cf6' ? 'gradient-text' : ''}`}>
          {typeof value === 'number' ? formatINR(value) : value}
        </p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
