import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react'
import { analyticsApi } from '../api/analytics'
import { formatINR, formatINRCompact } from '../utils/currency'

const PALETTE = [
  '#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444',
  '#ec4899','#3b82f6','#84cc16','#f97316','#14b8a6',
  '#a855f7','#0ea5e9','#22c55e','#eab308','#f43f5e',
  '#6366f1','#d946ef','#fb923c','#34d399','#38bdf8',
]

const TT = {
  contentStyle: { background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 12 },
  labelStyle: { color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
}

const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2]

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />
}

// ── Stacked bar tooltip ───────────────────────────────────────────────────────
function StackTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  const items = [...payload].sort((a, b) => b.value - a.value).filter(p => p.value > 0)
  return (
    <div className="rounded-xl p-3 text-xs shadow-xl min-w-[180px]"
      style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-white/50 mb-1 font-medium">{label}</p>
      <p className="text-white font-bold mb-2 text-sm">{formatINR(total)}</p>
      {items.map(p => (
        <div key={p.dataKey} className="flex justify-between items-center gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-white/70 truncate max-w-[110px]">{p.name}</span>
          </div>
          <span className="text-white font-medium">{formatINRCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge({ dir, pct }) {
  if (!pct) return <span className="text-white/30 text-xs flex items-center gap-1"><Minus size={10} /> —</span>
  const color = dir === 'up' ? 'text-rose-400' : 'text-emerald-400'
  const Icon  = dir === 'up' ? TrendingUp : TrendingDown
  return (
    <span className={`text-xs flex items-center gap-1 ${color}`}>
      <Icon size={11} /> {Math.abs(pct)}%
    </span>
  )
}

export default function AnalyticsPage() {
  const [year, setYear]             = useState(THIS_YEAR)
  const [viewMode, setViewMode]     = useState('chart')   // chart | table
  const [tab, setTab]               = useState('breakdown') // breakdown | insights | trends
  const [mbc, setMbc]               = useState({ months: [], categories: [], rows: [] })
  const [insights, setInsights]     = useState({ categories: [], total: 0 })
  const [merchants, setMerchants]   = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsApi.monthlyByCategory({ year }),
      analyticsApi.categoryInsights(year),
      analyticsApi.topMerchants(),
    ]).then(([m, ins, merch]) => {
      setMbc(m)
      setInsights(ins)
      setMerchants(merch)
    }).finally(() => setLoading(false))
  }, [year])

  const catColor = Object.fromEntries(
    mbc.categories.map((c, i) => [c.slug, PALETTE[i % PALETTE.length]])
  )
  const insightColor = Object.fromEntries(
    insights.categories.map((c, i) => [c.slug, PALETTE[i % PALETTE.length]])
  )

  const grandTotal = insights.total || 0

  // Build trend chart data: top 5 categories, month as X axis
  const top5 = insights.categories.slice(0, 5)

  return (
    <Layout title="Analytics">
      <div className="space-y-6">

        {/* ── Header controls ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-white/40" />
            <span className="text-white/40 text-sm">Showing data for</span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {YEAR_OPTIONS.map(y => (
                <button key={y} onClick={() => setYear(y)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={year === y
                    ? { background: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }
                    : { color: 'rgba(255,255,255,0.4)' }}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {['breakdown', 'insights', 'trends'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
                style={tab === t
                  ? { background: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }
                  : { color: 'rgba(255,255,255,0.4)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            TAB: BREAKDOWN — stacked bar + table
        ══════════════════════════════════════════════ */}
        {tab === 'breakdown' && (
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h3 className="text-white font-semibold">Monthly Spend by Category</h3>
                <p className="text-white/40 text-xs mt-0.5">How much you spend on food, fuel, EMIs and more each month</p>
              </div>
              <div className="flex items-center gap-1 p-0.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {['chart', 'table'].map(v => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
                    style={viewMode === v
                      ? { background: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }
                      : { color: 'rgba(255,255,255,0.4)' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <Skeleton className="h-72" /> : mbc.rows.length === 0 ? (
              <p className="text-white/30 text-sm py-12 text-center">No data for {year} — import a bank statement to see your spending breakdown</p>
            ) : viewMode === 'chart' ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mbc.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatINRCompact} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<StackTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Legend wrapperStyle={{ paddingTop: 16 }}
                    formatter={(value, entry) => (
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
                        {mbc.categories.find(c => c.slug === entry.dataKey)?.icon} {value}
                      </span>
                    )} />
                  {mbc.categories.map((c, i) => (
                    <Bar key={c.slug} dataKey={c.slug} name={c.name} stackId="a"
                      fill={PALETTE[i % PALETTE.length]}
                      radius={i === mbc.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-xs uppercase tracking-wide border-b border-white/5">
                      <th className="text-left py-2 pr-4 whitespace-nowrap">Category</th>
                      {mbc.months.map(m => (
                        <th key={m} className="text-right py-2 px-2 whitespace-nowrap">{m.slice(0, 3)}</th>
                      ))}
                      <th className="text-right py-2 pl-4 whitespace-nowrap">Total</th>
                      <th className="text-right py-2 pl-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.categories.map((c, ci) => {
                      const byMonth = mbc.rows.map(r => r[c.slug] || 0)
                      return (
                        <tr key={c.slug} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PALETTE[ci % PALETTE.length] }} />
                              <span className="text-white/80 whitespace-nowrap">{c.icon} {c.name}</span>
                            </div>
                          </td>
                          {byMonth.map((amt, mi) => (
                            <td key={mi} className="py-2.5 px-2 text-right text-white/70 tabular-nums whitespace-nowrap text-xs">
                              {amt > 0 ? formatINRCompact(amt) : <span className="text-white/15">—</span>}
                            </td>
                          ))}
                          <td className="py-2.5 pl-4 text-right font-semibold text-white whitespace-nowrap">{formatINR(c.total)}</td>
                          <td className="py-2.5 pl-2 text-right text-white/40 whitespace-nowrap">{c.pct}%</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-white/10 font-bold text-xs">
                      <td className="py-3 pr-4 text-white/50 uppercase tracking-wide">Total</td>
                      {mbc.rows.map((r, ri) => {
                        const t = Object.entries(r).filter(([k]) => k !== 'month').reduce((s, [, v]) => s + v, 0)
                        return <td key={ri} className="py-3 px-2 text-right text-white tabular-nums">{formatINRCompact(t)}</td>
                      })}
                      <td className="py-3 pl-4 text-right text-white">{formatINR(grandTotal)}</td>
                      <td className="py-3 pl-2 text-right text-white/40">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: INSIGHTS — per-category stat cards
        ══════════════════════════════════════════════ */}
        {tab === 'insights' && (
          <>
            {/* Year summary */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Total Spent', value: formatINR(grandTotal), sub: `in ${year}` },
                { label: 'Avg / Month', value: formatINRCompact(grandTotal / 12), sub: 'monthly average' },
                { label: 'Categories', value: insights.categories.length, sub: 'active categories' },
                { label: 'Biggest Category', value: insights.categories[0]?.icon + ' ' + (insights.categories[0]?.name || '—'), sub: formatINR(insights.categories[0]?.total || 0) },
              ].map(c => (
                <div key={c.label} className="glass rounded-2xl p-5">
                  <p className="text-white/40 text-xs mb-2">{c.label}</p>
                  <p className="text-white font-bold text-xl">{c.value}</p>
                  <p className="text-white/30 text-xs mt-1">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Per-category cards */}
            {loading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : insights.categories.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center text-white/30">No data for {year}</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {insights.categories.map((c, i) => (
                  <div key={c.slug} className="glass rounded-2xl p-4 flex gap-4">
                    {/* Color bar */}
                    <div className="w-1 rounded-full flex-shrink-0 self-stretch"
                      style={{ background: PALETTE[i % PALETTE.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-white font-semibold text-sm">{c.icon} {c.name}</p>
                          <p className="text-white/40 text-xs">{c.pct}% of total spend</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white font-bold">{formatINR(c.total)}</p>
                          <TrendBadge dir={c.trend_dir} pct={c.trend_pct} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="text-white/40 mb-0.5">Avg/month</p>
                          <p className="text-white font-medium">{formatINRCompact(c.avg_per_month)}</p>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="text-white/40 mb-0.5">Peak month</p>
                          <p className="text-white font-medium">{c.peak_month}</p>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="text-white/40 mb-0.5">Active</p>
                          <p className="text-white font-medium">{c.active_months} months</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1 rounded-full bg-white/5">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${c.pct}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: TRENDS — line chart of top categories
        ══════════════════════════════════════════════ */}
        {tab === 'trends' && (
          <div className="glass rounded-2xl p-5">
            <div className="mb-5">
              <h3 className="text-white font-semibold">Category Trends — {year}</h3>
              <p className="text-white/40 text-xs mt-0.5">Monthly spend per category, showing how each fluctuates through the year</p>
            </div>
            {loading ? <Skeleton className="h-72" /> : top5.length === 0 ? (
              <p className="text-white/30 text-sm py-12 text-center">No data for {year}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="month" type="category" allowDuplicatedCategory={false}
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatINRCompact} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                      axisLine={false} tickLine={false} width={52} />
                    <Tooltip {...TT} formatter={(v, name) => [formatINR(v), name]} />
                    <Legend wrapperStyle={{ paddingTop: 16 }}
                      formatter={v => <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{v}</span>} />
                    {top5.map((c, i) => (
                      <Line key={c.slug}
                        data={c.monthly_data}
                        type="monotone"
                        dataKey="amount"
                        name={`${c.icon} ${c.name}`}
                        stroke={PALETTE[i % PALETTE.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-white/30 text-xs mt-3 text-center">Showing top 5 categories by annual spend</p>
              </>
            )}
          </div>
        )}

        {/* ── Top Merchants (always visible) ── */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">Top Merchants</h3>
          <p className="text-white/40 text-xs mb-4">Where your money goes most often</p>
          {loading ? <Skeleton className="h-40" /> : merchants.length === 0 ? (
            <p className="text-white/30 text-sm py-8 text-center">No data yet</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-1">
              {merchants.slice(0, 10).map((m, i) => (
                <div key={m.description} className="flex items-center gap-3 py-1.5">
                  <span className="w-5 text-white/30 text-xs text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-white/80 text-sm truncate">{m.description}</span>
                      <span className="text-white text-sm font-semibold ml-2 shrink-0">{formatINR(m.total)}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full">
                      <div className="h-full rounded-full"
                        style={{ width: `${(m.total / (merchants[0]?.total || 1)) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
