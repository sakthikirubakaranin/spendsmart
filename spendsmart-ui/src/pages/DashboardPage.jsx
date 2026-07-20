import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle, Zap, AlertTriangle, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import SpendingDonut from '../components/dashboard/SpendingDonut'
import MonthlyTrend from '../components/dashboard/MonthlyTrend'
import TopCategories from '../components/dashboard/TopCategories'
import BudgetBars from '../components/dashboard/BudgetBars'
import RecentTransactions from '../components/dashboard/RecentTransactions'
import { analyticsApi } from '../api/analytics'
import { expensesApi } from '../api/expenses'
import { formatINR } from '../utils/currency'

// ── Date range helpers ────────────────────────────────────────────────────────
const _pad = n => String(n).padStart(2, '0')
const _fmt = d => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`

function getParams(filterMode) {
  const today = new Date()
  if (!filterMode) return {}

  if (filterMode.type === 'preset') {
    switch (filterMode.label) {
      case 'This Month': {
        const from = new Date(today.getFullYear(), today.getMonth(), 1)
        return { from_date: _fmt(from), to_date: _fmt(today) }
      }
      case 'Last Month': {
        const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const to   = new Date(today.getFullYear(), today.getMonth(), 0)
        return { from_date: _fmt(from), to_date: _fmt(to) }
      }
      case 'Last 3 Months': {
        const from = new Date(today.getFullYear(), today.getMonth() - 2, 1)
        return { from_date: _fmt(from), to_date: _fmt(today) }
      }
      case 'Last 6 Months': {
        const from = new Date(today.getFullYear(), today.getMonth() - 5, 1)
        return { from_date: _fmt(from), to_date: _fmt(today) }
      }
      case 'Last Year': {
        const from = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        return { from_date: _fmt(from), to_date: _fmt(today) }
      }
      default: return {}
    }
  }

  if (filterMode.type === 'month') {
    const { year, month } = filterMode
    const lastDay = new Date(year, month, 0).getDate()
    return {
      from_date: `${year}-${_pad(month)}-01`,
      to_date:   `${year}-${_pad(month)}-${lastDay}`,
    }
  }

  if (filterMode.type === 'custom') {
    return { from_date: filterMode.from, to_date: filterMode.to }
  }

  return {}
}

// ── Components ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, trend, icon: Icon, accent }) {
  const colors = {
    purple: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.25)', icon: '#a78bfa' },
    cyan:   { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.25)',  icon: '#22d3ee' },
    green:  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: '#34d399' },
    rose:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.25)',  icon: '#fb7185' },
    amber:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: '#fbbf24' },
  }
  const c = colors[accent] || colors.purple
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-sm">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          <Icon size={16} style={{ color: c.icon }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && (
        <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-rose-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-500'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
          {sub}
        </div>
      )}
    </div>
  )
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-white/5 rounded-2xl ${className}`} />
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const [filterMode, setFilterMode]        = useState({ type: 'preset', label: 'Last Month' })
  const [summary, setSummary]             = useState(null)
  const [categoryData, setCategoryData]   = useState([])
  const [trendData, setTrendData]         = useState([])
  const [budgetStatus, setBudgetStatus]   = useState([])
  const [budgetAlerts, setBudgetAlerts]   = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  async function fetchAll(params) {
    const [s, cat, trend, budget, alerts, expenses] = await Promise.all([
      analyticsApi.summary(params),
      analyticsApi.byCategory(params),
      analyticsApi.monthlyTrend(6),
      analyticsApi.budgetStatus(),
      analyticsApi.alerts().catch(() => ({ alerts: [] })),
      expensesApi.list({ per_page: 10, sort: 'date_desc' }),
    ])
    setSummary(s)
    setCategoryData(cat.categories || [])
    setTrendData(trend)
    setBudgetStatus(budget)
    setBudgetAlerts(alerts.alerts || [])
    setRecentExpenses(expenses.items || [])
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = getParams(filterMode)
    fetchAll(params)
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }, [filterMode])

  const netPositive = (summary?.net_balance ?? 0) >= 0

  function refreshAll() {
    const params = getParams(filterMode)
    fetchAll(params).catch(() => {})
  }

  return (
    <Layout title="Dashboard" filterMode={filterMode} onFilterModeChange={setFilterMode} onDataChanged={refreshAll}>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-rose-400 text-sm"
          style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
          {error}
        </div>
      )}

      {/* ── Budget alerts banner ── */}
      {!loading && budgetAlerts.length > 0 && (
        <div className="mb-5 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
          onClick={() => navigate('/budgets')}>
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-amber-300 text-sm font-medium">
              {budgetAlerts.filter(a => a.status === 'over').length > 0
                ? `${budgetAlerts.filter(a => a.status === 'over').length} budget${budgetAlerts.filter(a => a.status === 'over').length > 1 ? 's' : ''} exceeded this month`
                : `${budgetAlerts.length} budget${budgetAlerts.length > 1 ? 's' : ''} nearing limit`}
            </span>
            <span className="text-amber-500 text-xs ml-2">
              {budgetAlerts.slice(0,2).map(a => `${a.category_icon} ${a.category_name} (${a.pct}%)`).join(' · ')}
            </span>
          </div>
          <ChevronRight size={14} className="text-amber-500 flex-shrink-0" />
        </div>
      )}

      {/* ── Top metric cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)
        ) : (
          <>
            <MetricCard
              label="Total Income"
              value={formatINR(summary?.total_income ?? 0)}
              sub={summary?.total_income > 0 ? 'credited this period' : 'no income yet'}
              trend={null}
              icon={ArrowDownCircle}
              accent="green"
            />
            <MetricCard
              label="Total Spent"
              value={formatINR(summary?.total_spent ?? 0)}
              sub={`${summary?.vs_last_period?.change_pct ?? 0}% vs prev period`}
              trend={summary?.vs_last_period?.direction}
              icon={ArrowUpCircle}
              accent="rose"
            />
            <MetricCard
              label="Net Balance"
              value={formatINR(Math.abs(summary?.net_balance ?? 0))}
              sub={netPositive ? 'surplus this period' : 'deficit this period'}
              trend={netPositive ? 'down' : 'up'}
              icon={Wallet}
              accent={netPositive ? 'cyan' : 'amber'}
            />
            <MetricCard
              label="Projected Month"
              value={formatINR(summary?.projected_month_total ?? 0)}
              sub={summary?.days_remaining > 0 ? `${summary.days_remaining} days remaining` : 'month complete'}
              trend={null}
              icon={Zap}
              accent="purple"
            />
          </>
        )}
      </div>

      {/* ── Monthly trend + Top Categories ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-2">
          {loading ? <Skeleton className="h-64" /> : <MonthlyTrend data={trendData} />}
        </div>
        <div>
          {loading ? <Skeleton className="h-64" /> : <TopCategories data={categoryData} />}
        </div>
      </div>

      {/* ── Donut + Budget + Transactions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div>
          {loading ? <Skeleton className="h-64" /> : <SpendingDonut data={categoryData} />}
        </div>
        <div>
          {loading ? <Skeleton className="h-64" /> : <BudgetBars data={budgetStatus} />}
        </div>
        <div>
          {loading ? <Skeleton className="h-64" /> : <RecentTransactions data={recentExpenses} />}
        </div>
      </div>

    </Layout>
  )
}
