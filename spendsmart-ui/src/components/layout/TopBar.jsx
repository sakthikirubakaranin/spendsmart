import { useState, useEffect, useRef } from 'react'
import { Bell, Plus, Search, X, ChevronDown, AlertTriangle, TrendingUp, ExternalLink, Receipt, Command, ScanLine, Calendar, CalendarRange } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { incomeApi } from '../../api/income'
import { expensesApi } from '../../api/expenses'
import { analyticsApi } from '../../api/analytics'
import { formatINR } from '../../utils/currency'
import ScanReceiptModal from '../ScanReceiptModal'

const PRESET_FILTERS = ['This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'Last Year']

// Generate last N months as { year, month, label } objects
function buildMonthOptions(count = 24) {
  const today = new Date()
  const months = []
  for (let i = 0; i < count; i++) {
    let m = today.getMonth() + 1 - i
    let y = today.getFullYear()
    while (m <= 0) { m += 12; y-- }
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    months.push({ year: y, month: m, label, isCurrent: i === 0 })
  }
  return months
}

const MONTH_OPTIONS = buildMonthOptions(24)

// Short display label for active month
function monthShortLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

// Short display label for custom range
function customShortLabel(from, to) {
  if (!from || !to) return 'Custom'
  const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${fmt(from)} – ${fmt(to)}`
}

const INCOME_TYPES = [
  { value: 'salary',     label: '💼 Salary' },
  { value: 'freelance',  label: '🧑‍💻 Freelance' },
  { value: 'refund',     label: '↩️ Refund' },
  { value: 'government', label: '🏛️ Government' },
  { value: 'transfer',   label: '↔️ Transfer' },
  { value: 'other',      label: '📥 Other' },
]

const PAYMENT_METHODS = ['UPI', 'NET_BANKING', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH']

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ title, accent, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#0f0f1e', border: `1px solid ${accent}` }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }

// ── Add Income Modal ──────────────────────────────────────────────────────────
function AddIncomeModal({ onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ date: today, amount: '', description: '', income_type: 'salary' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount || !form.description) return
    setLoading(true); setError('')
    try {
      await incomeApi.create({ ...form, amount: parseFloat(form.amount) })
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save income')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add Income" accent="rgba(16,185,129,0.4)" onClose={onClose}>
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-rose-400 text-xs"
          style={{ background: 'rgba(244,63,94,0.1)' }}>{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input required type="date" className={inputClass} style={inputStyle}
              value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Amount (₹)">
            <input required type="number" min="0.01" step="0.01" className={inputClass} style={inputStyle}
              placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <input required className={inputClass} style={inputStyle}
            placeholder="e.g. Monthly salary from employer"
            value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>

        <Field label="Income Type">
          <select className={inputClass} style={inputStyle}
            value={form.income_type} onChange={e => set('income_type', e.target.value)}>
            {INCOME_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <div className="pt-1 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
            {loading ? 'Saving…' : 'Save Income'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today, amount: '', description: '',
    payment_method: 'UPI', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount || !form.description) return
    setLoading(true); setError('')
    try {
      await expensesApi.create({ ...form, amount: parseFloat(form.amount) })
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add Expense" accent="rgba(139,92,246,0.4)" onClose={onClose}>
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-rose-400 text-xs"
          style={{ background: 'rgba(244,63,94,0.1)' }}>{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input required type="date" className={inputClass} style={inputStyle}
              value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Amount (₹)">
            <input required type="number" min="0.01" step="0.01" className={inputClass} style={inputStyle}
              placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <input required className={inputClass} style={inputStyle}
            placeholder="e.g. Lunch at restaurant"
            value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>

        <Field label="Payment Method">
          <select className={inputClass} style={inputStyle}
            value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>

        <Field label="Notes (optional)">
          <input className={inputClass} style={inputStyle}
            placeholder="Any extra notes…"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>

        <div className="pt-1 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
            {loading ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Search Modal ──────────────────────────────────────────────────────────────
function SearchModal({ onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(timerRef.current)
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const data = await expensesApi.list({ search: query.trim(), per_page: 8 })
        setResults(data.items || [])
        setSelected(0)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && results[selected]) {
        navigate(`/expenses?search=${encodeURIComponent(query)}`)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [results, selected, query, navigate, onClose])

  function goToExpenses() {
    if (query.trim()) {
      navigate(`/expenses?search=${encodeURIComponent(query.trim())}`)
      onClose()
    }
  }

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0f0f1e', border: '1px solid rgba(139,92,246,0.3)' }}>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search expenses by merchant, amount, description…"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 text-sm outline-none"
          />
          {loading && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          <button onClick={onClose} className="text-slate-600 hover:text-slate-400 flex-shrink-0"><X size={16} /></button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {results.map((exp, i) => (
              <div key={exp.id}
                onClick={() => { navigate(`/expenses?search=${encodeURIComponent(query)}`); onClose() }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${i === selected ? 'bg-white/5' : 'hover:bg-white/3'}`}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  {exp.category?.icon || '💸'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{exp.description}</p>
                  <p className="text-xs text-slate-500">{exp.category?.name || 'Uncategorized'} · {fmt(exp.date)}</p>
                </div>
                <span className="text-sm font-semibold text-white flex-shrink-0">{formatINR(exp.amount)}</span>
              </div>
            ))}
            <button onClick={goToExpenses}
              className="w-full px-4 py-3 text-xs text-violet-400 hover:text-violet-300 text-center transition-colors"
              style={{ background: 'rgba(139,92,246,0.05)' }}>
              See all results for "{query}" →
            </button>
          </div>
        ) : query && !loading ? (
          <div className="px-4 py-10 text-center">
            <Receipt size={28} className="text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No expenses found for "{query}"</p>
          </div>
        ) : !query ? (
          <div className="px-4 py-6 text-center text-slate-600 text-xs">
            Type to search across all your expenses
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Alert Bell ────────────────────────────────────────────────────────────────
function AlertBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)   // null = loading, loaded = { alerts, alert_count }
  const ref = useRef(null)

  // Fetch on mount and every 5 minutes
  useEffect(() => {
    let cancelled = false
    const fetch = () => {
      analyticsApi.alerts()
        .then(d => { if (!cancelled) setData(d) })
        .catch(() => { if (!cancelled) setData({ alert_count: 0, alerts: [] }) })
    }
    fetch()
    const timer = setInterval(fetch, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const count = data?.alert_count ?? 0
  const alerts = data?.alerts ?? []
  const overCount = alerts.filter(a => a.status === 'over').length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
        style={{
          background: open ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
          border: open ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.07)',
          color: count > 0 ? (overCount > 0 ? '#fb7185' : '#fbbf24') : '#64748b',
        }}
      >
        <Bell size={15} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-0.5"
            style={{ background: overCount > 0 ? '#ef4444' : '#f59e0b' }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50 shadow-2xl"
          style={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Budget Alerts</span>
            </div>
            {count > 0 && (
              <span className="text-xs text-slate-500">{data?.month}</span>
            )}
          </div>

          {/* Body */}
          {!data ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm font-medium text-slate-300">All budgets on track</p>
              <p className="text-xs text-slate-500 mt-1">No categories have reached 80% this month</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {alerts.map(alert => (
                <div key={alert.category_id}
                  className="px-4 py-3 hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{alert.category_icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200 truncate">{alert.category_name}</span>
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={alert.status === 'over'
                            ? { background: 'rgba(244,63,94,0.15)', color: '#fb7185' }
                            : { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}
                        >
                          {alert.status === 'over' ? `${alert.pct}% OVER` : `${alert.pct}%`}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 rounded-full mb-1.5"
                        style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(alert.pct, 100)}%`,
                            background: alert.status === 'over'
                              ? 'linear-gradient(90deg, #ef4444, #fb7185)'
                              : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>₹{alert.spent.toLocaleString('en-IN')} spent</span>
                        <span>of ₹{alert.budget.toLocaleString('en-IN')}</span>
                      </div>
                      {alert.status === 'over' && (
                        <p className="text-xs mt-1" style={{ color: '#fb7185' }}>
                          Over by ₹{(alert.spent - alert.budget).toLocaleString('en-IN')}
                        </p>
                      )}
                      {alert.status === 'warning' && (
                        <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>
                          ₹{alert.remaining.toLocaleString('en-IN')} remaining
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { setOpen(false); navigate('/budgets') }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
              style={{ background: 'rgba(139,92,246,0.08)' }}
            >
              <TrendingUp size={12} /> Manage Budgets <ExternalLink size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── DateFilterBar ─────────────────────────────────────────────────────────────
function DateFilterBar({ filterMode, onFilterModeChange }) {
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const monthRef = useRef(null)
  const customRef = useRef(null)

  // Pre-fill custom inputs when custom mode is already active
  useEffect(() => {
    if (filterMode?.type === 'custom') {
      setCustomFrom(filterMode.from)
      setCustomTo(filterMode.to)
    }
  }, [filterMode])

  // Close pickers on outside click
  useEffect(() => {
    function handle(e) {
      if (monthRef.current && !monthRef.current.contains(e.target)) setShowMonthPicker(false)
      if (customRef.current && !customRef.current.contains(e.target)) setShowCustomPicker(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const isPreset  = (label) => filterMode?.type === 'preset' && filterMode.label === label
  const isMonth   = filterMode?.type === 'month'
  const isCustom  = filterMode?.type === 'custom'

  const activePill = { background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }
  const activeGreen = { background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
  const activeOrange = { background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onFilterModeChange({ type: 'custom', from: customFrom, to: customTo })
      setShowCustomPicker(false)
    }
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Preset pills */}
      {PRESET_FILTERS.map(f => (
        <button key={f}
          onClick={() => { onFilterModeChange({ type: 'preset', label: f }); setShowMonthPicker(false); setShowCustomPicker(false) }}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap"
          style={isPreset(f) ? activePill : { color: '#64748b' }}>
          {f}
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-4 mx-0.5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

      {/* Month picker */}
      <div className="relative" ref={monthRef}>
        <button
          onClick={() => { setShowMonthPicker(m => !m); setShowCustomPicker(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap"
          style={isMonth ? activeGreen : { color: '#64748b' }}>
          <Calendar size={11} />
          {isMonth ? monthShortLabel(filterMode.year, filterMode.month) : 'Month'}
          <ChevronDown size={10} className={`transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} />
        </button>

        {showMonthPicker && (
          <div className="absolute top-full left-0 mt-1.5 w-52 rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>Select Month</p>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {MONTH_OPTIONS.map(m => {
                const active = filterMode?.type === 'month' && filterMode.year === m.year && filterMode.month === m.month
                return (
                  <button key={`${m.year}-${m.month}`}
                    onClick={() => { onFilterModeChange({ type: 'month', year: m.year, month: m.month }); setShowMonthPicker(false) }}
                    className="w-full text-left px-3 py-2.5 text-xs transition-colors hover:bg-white/5 flex items-center justify-between"
                    style={{ color: active ? '#34d399' : '#94a3b8', background: active ? 'rgba(16,185,129,0.07)' : '' }}>
                    <span>{m.label}</span>
                    {m.isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Current</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom range */}
      <div className="relative" ref={customRef}>
        <button
          onClick={() => { setShowCustomPicker(c => !c); setShowMonthPicker(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap"
          style={isCustom ? activeOrange : { color: '#64748b' }}>
          <CalendarRange size={11} />
          {isCustom ? customShortLabel(filterMode.from, filterMode.to) : 'Custom'}
          <ChevronDown size={10} className={`transition-transform ${showCustomPicker ? 'rotate-180' : ''}`} />
        </button>

        {showCustomPicker && (
          <div className="absolute top-full right-0 mt-1.5 w-60 rounded-xl p-3 z-50 shadow-2xl"
            style={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: '#475569' }}>Custom Range</p>
            <div className="space-y-2.5">
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#64748b' }}>From</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#64748b' }}>To</label>
                <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0' }} />
              </div>
              <button onClick={applyCustom}
                disabled={!customFrom || !customTo || customFrom > customTo}
                className="w-full py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                Apply Range
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
export default function TopBar({ title = 'Dashboard', filterMode, onFilterModeChange, onDataChanged }) {
  const showFilter = !!onFilterModeChange
  const [dropdown, setDropdown] = useState(false)
  const [modal, setModal] = useState(null)   // null | 'income' | 'expense'
  const [showSearch, setShowSearch] = useState(false)
  const [showScan, setShowScan] = useState(false)

  // Cmd+K / Ctrl+K opens search
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSaved() {
    onDataChanged?.()
  }

  return (
    <>
      <header className="flex items-center justify-between px-8 py-4 sticky top-0 z-30"
        style={{ background: 'var(--bg-topbar)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>

        {/* Left */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-100 flex-shrink-0">{title}</h1>
          {showFilter && (
            <DateFilterBar filterMode={filterMode} onFilterModeChange={onFilterModeChange} />
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Search size={14} />
            <span className="text-xs hidden lg:block">Search...</span>
            <kbd className="hidden xl:flex items-center gap-0.5 text-[10px] text-slate-600 border border-slate-700 rounded px-1 py-0.5">
              <Command size={9} />K
            </kbd>
          </button>

          {/* Scan Receipt */}
          <button onClick={() => setShowScan(true)}
            title="Scan receipt"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <ScanLine size={14} />
            <span className="text-xs hidden lg:block">Scan</span>
          </button>

          <AlertBell />

          {/* Split button: Add Expense (primary) + dropdown for Add Income */}
          <div className="relative flex">
            <button
              onClick={() => setModal('expense')}
              className="flex items-center gap-2 pl-4 pr-3 py-2 rounded-l-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
              <Plus size={15} />
              Add Expense
            </button>
            <button
              onClick={() => setDropdown(d => !d)}
              className="flex items-center px-2 py-2 rounded-r-lg text-white border-l transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', borderColor: 'rgba(255,255,255,0.2)' }}>
              <ChevronDown size={14} />
            </button>

            {dropdown && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50 shadow-xl"
                style={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  onClick={() => { setModal('expense'); setDropdown(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-white/5 flex items-center gap-2 transition-colors">
                  <Plus size={14} className="text-violet-400" /> Add Expense
                </button>
                <button
                  onClick={() => { setModal('income'); setDropdown(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-white/5 flex items-center gap-2 transition-colors border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Plus size={14} className="text-emerald-400" /> Add Income
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {modal === 'income'  && <AddIncomeModal  onClose={() => setModal(null)} onSaved={handleSaved} />}
      {modal === 'expense' && <AddExpenseModal onClose={() => setModal(null)} onSaved={handleSaved} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showScan   && <ScanReceiptModal onClose={() => setShowScan(false)} onSaved={handleSaved} />}
    </>
  )
}
