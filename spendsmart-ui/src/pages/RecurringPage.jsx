import { useState, useEffect } from 'react'
import {
  Plus, Repeat, CheckCircle2, Pencil, Trash2, X,
  Loader2, AlertCircle, Clock, Pause, Play, ChevronDown,
} from 'lucide-react'
import Layout from '../components/layout/Layout'
import { recurringApi } from '../api/recurring'
import { categoriesApi } from '../api/expenses'

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }
const FREQ_COLORS = {
  weekly:    { bg: 'rgba(6,182,212,0.12)',   text: '#22d3ee' },
  monthly:   { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa' },
  quarterly: { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24' },
  yearly:    { bg: 'rgba(16,185,129,0.12)',  text: '#34d399' },
}
const PAYMENT_METHODS = ['UPI', 'NET_BANKING', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH']

function dueSoonStatus(nextDueDateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(nextDueDateStr); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due - today) / 86400000)
  if (diff < 0)  return { label: 'Overdue',  color: '#fb7185', bg: 'rgba(244,63,94,0.12)',  icon: 'overdue' }
  if (diff === 0) return { label: 'Due today', color: '#fb7185', bg: 'rgba(244,63,94,0.12)', icon: 'today'   }
  if (diff <= 3)  return { label: `Due in ${diff}d`, color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', icon: 'soon' }
  if (diff <= 7)  return { label: `Due in ${diff}d`, color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', icon: 'upcoming' }
  return null
}

function fmt(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Shared modal shell ────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-modal)', border: '1px solid rgba(139,92,246,0.25)' }}>
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

const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm text-slate-100 placeholder-slate-400 outline-none transition-all"
const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-input)' }
const focusStyle = e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')
const blurStyle  = e => (e.target.style.borderColor = 'var(--border-input)')

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function RecurringModal({ initial, categories, onClose, onSaved }) {
  const isEdit = !!initial
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    description:    initial?.description   ?? '',
    amount:         initial?.amount        ?? '',
    category_id:    initial?.category?.id  ?? '',
    payment_method: initial?.payment_method ?? 'UPI',
    frequency:      initial?.frequency     ?? 'monthly',
    day_of_month:   initial?.day_of_month  ?? '',
    next_due_date:  initial?.next_due_date  ?? today,
    is_active:      initial?.is_active     ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setVal = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) { setError('Description is required'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Amount must be positive'); return }

    setLoading(true); setError('')
    const body = {
      description:    form.description.trim(),
      amount:         Number(form.amount),
      category_id:    form.category_id ? Number(form.category_id) : null,
      payment_method: form.payment_method || null,
      frequency:      form.frequency,
      day_of_month:   form.day_of_month ? Number(form.day_of_month) : null,
      next_due_date:  form.next_due_date,
      is_active:      form.is_active,
    }
    try {
      if (isEdit) {
        await recurringApi.update(initial.id, body)
      } else {
        await recurringApi.create(body)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Recurring Expense' : 'New Recurring Expense'} onClose={onClose}>
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-rose-400 text-xs"
          style={{ background: 'rgba(244,63,94,0.08)' }}>{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Description">
          <input required className={inputClass} style={inputStyle}
            onFocus={focusStyle} onBlur={blurStyle}
            placeholder="e.g. Netflix, Rent, EMI"
            value={form.description} onChange={set('description')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
              <input required type="number" min="1" step="0.01"
                className={`${inputClass} pl-7`} style={inputStyle}
                onFocus={focusStyle} onBlur={blurStyle}
                placeholder="0.00" value={form.amount} onChange={set('amount')} />
            </div>
          </Field>
          <Field label="Frequency">
            <select className={inputClass} style={inputStyle}
              onFocus={focusStyle} onBlur={blurStyle}
              value={form.frequency} onChange={set('frequency')}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Next Due Date">
            <input required type="date" className={inputClass} style={inputStyle}
              onFocus={focusStyle} onBlur={blurStyle}
              value={form.next_due_date} onChange={set('next_due_date')} />
          </Field>
          {(form.frequency === 'monthly' || form.frequency === 'quarterly' || form.frequency === 'yearly') && (
            <Field label="Day of Month">
              <input type="number" min="1" max="28" className={inputClass} style={inputStyle}
                onFocus={focusStyle} onBlur={blurStyle}
                placeholder="e.g. 5 (locks to day 5)"
                value={form.day_of_month} onChange={set('day_of_month')} />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={inputClass} style={inputStyle}
              onFocus={focusStyle} onBlur={blurStyle}
              value={form.category_id} onChange={set('category_id')}>
              <option value="">No category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment Method">
            <select className={inputClass} style={inputStyle}
              onFocus={focusStyle} onBlur={blurStyle}
              value={form.payment_method} onChange={set('payment_method')}>
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        {isEdit && (
          <Field label="Status">
            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                onClick={() => setVal('is_active', !form.is_active)}
                className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
                style={{ background: form.is_active ? 'rgba(139,92,246,0.7)' : 'var(--bg-button-ghost)' }}
              >
                <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ left: form.is_active ? '22px' : '2px' }} />
              </button>
              <span className="text-sm text-slate-400">{form.is_active ? 'Active' : 'Paused'}</span>
            </div>
          </Field>
        )}

        <div className="pt-2 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Recurring Card ─────────────────────────────────────────────────────────────

function RecurringCard({ rec, onMarkPaid, onEdit, onDelete, onToggle, paying }) {
  const dueStatus = dueSoonStatus(rec.next_due_date)
  const freq = FREQ_COLORS[rec.frequency] || FREQ_COLORS.monthly
  const canPay = rec.is_active && dueStatus !== null  // only show Pay when actionable

  return (
    <div
      className="glass rounded-2xl p-5 flex flex-col gap-4 transition-all"
      style={{
        opacity: rec.is_active ? 1 : 0.55,
        border: dueStatus?.icon === 'overdue' || dueStatus?.icon === 'today'
          ? '1px solid rgba(244,63,94,0.3)'
          : '1px solid var(--border-subtle)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{rec.category?.icon || '🔁'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{rec.description}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {rec.category?.name || 'Uncategorised'} · {rec.payment_method || 'UPI'}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-slate-100">{fmt(rec.amount)}</p>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-lg mt-0.5 inline-block"
            style={{ background: freq.bg, color: freq.text }}
          >
            {FREQ_LABELS[rec.frequency]}
          </span>
        </div>
      </div>

      {/* Next due date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-500" />
          <span className="text-xs text-slate-400">
            Next due: <span className="text-slate-200 font-medium">{fmtDate(rec.next_due_date)}</span>
          </span>
        </div>
        {dueStatus && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1"
            style={{ background: dueStatus.bg, color: dueStatus.color }}
          >
            {dueStatus.icon === 'overdue' && <AlertCircle size={10} />}
            {dueStatus.label}
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {canPay && (
          <button
            onClick={() => onMarkPaid(rec.id)}
            disabled={paying === rec.id}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
          >
            {paying === rec.id
              ? <><Loader2 size={12} className="animate-spin" /> Logging…</>
              : <><CheckCircle2 size={12} /> Mark Paid</>}
          </button>
        )}

        {/* Toggle active */}
        <button
          onClick={() => onToggle(rec)}
          title={rec.is_active ? 'Pause' : 'Resume'}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          style={{ background: 'var(--bg-input)' }}
        >
          {rec.is_active ? <Pause size={13} /> : <Play size={13} />}
        </button>

        <button
          onClick={() => onEdit(rec)}
          title="Edit"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-400 transition-colors"
          style={{ background: 'var(--bg-input)' }}
        >
          <Pencil size={13} />
        </button>

        <button
          onClick={() => onDelete(rec.id)}
          title="Delete"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
          style={{ background: 'var(--bg-input)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(null)       // id of record being paid
  const [modal, setModal] = useState(null)          // null | 'add' | <record>
  const [filter, setFilter] = useState('all')       // all | active | paused | due

  // Load data
  async function reload() {
    setLoading(true)
    try {
      const [recs, cats] = await Promise.all([
        recurringApi.list(),
        categoriesApi.list(),
      ])
      setItems(recs)
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  // Mark paid
  async function handleMarkPaid(id) {
    setPaying(id)
    try {
      await recurringApi.markPaid(id)
      await reload()
    } finally {
      setPaying(null)
    }
  }

  // Toggle active / paused
  async function handleToggle(rec) {
    await recurringApi.update(rec.id, { is_active: !rec.is_active })
    await reload()
  }

  // Delete
  async function handleDelete(id) {
    if (!window.confirm('Delete this recurring expense?')) return
    await recurringApi.remove(id)
    await reload()
  }

  // Filtered list
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const displayed = items.filter(r => {
    if (filter === 'active') return r.is_active
    if (filter === 'paused') return !r.is_active
    if (filter === 'due') {
      const due = new Date(r.next_due_date); due.setHours(0, 0, 0, 0)
      return r.is_active && Math.round((due - today) / 86400000) <= 7
    }
    return true
  })

  // Summary stats
  const activeItems = items.filter(r => r.is_active)
  const monthlyTotal = activeItems.reduce((sum, r) => {
    if (r.frequency === 'weekly')    return sum + r.amount * 4.33
    if (r.frequency === 'quarterly') return sum + r.amount / 3
    if (r.frequency === 'yearly')    return sum + r.amount / 12
    return sum + r.amount
  }, 0)
  const dueCount = activeItems.filter(r => {
    const due = new Date(r.next_due_date); due.setHours(0, 0, 0, 0)
    return Math.round((due - today) / 86400000) <= 7
  }).length

  return (
    <Layout title="Recurring">
      <div className="max-w-5xl">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Monthly Commitment', value: fmt(monthlyTotal), sub: 'across active recurring', icon: '💸' },
            { label: 'Active',             value: activeItems.length, sub: `of ${items.length} total`, icon: '🔁' },
            { label: 'Due This Week',      value: dueCount, sub: 'within 7 days', icon: '⏰',
              highlight: dueCount > 0 },
          ].map(({ label, value, sub, icon, highlight }) => (
            <div key={label} className="glass rounded-2xl p-5"
              style={highlight ? { border: '1px solid rgba(245,158,11,0.3)' } : {}}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
                <span className="text-lg">{icon}</span>
              </div>
              <p className="text-xl font-bold text-slate-100">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5 p-1 rounded-xl"
            style={{ background: 'var(--bg-button-ghost)', border: '1px solid var(--border-subtle)' }}>
            {[
              { id: 'all',    label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'paused', label: 'Paused' },
              { id: 'due',    label: `Due Soon${dueCount > 0 ? ` (${dueCount})` : ''}` },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setFilter(id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={filter === id
                  ? { background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }
                  : { color: 'var(--text-muted)' }}>
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
          >
            <Plus size={15} /> Add Recurring
          </button>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-violet-400" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="glass rounded-2xl py-16 flex flex-col items-center gap-3">
            <Repeat size={36} className="text-slate-600" />
            <p className="text-slate-400 font-medium">
              {items.length === 0 ? 'No recurring expenses yet' : 'No items match this filter'}
            </p>
            {items.length === 0 && (
              <p className="text-sm text-slate-600 max-w-xs text-center">
                Track rent, EMIs, subscriptions, and other fixed expenses so you never miss a payment.
              </p>
            )}
            {items.length === 0 && (
              <button
                onClick={() => setModal('add')}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
              >
                <Plus size={14} /> Add First Recurring
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayed.map(rec => (
              <RecurringCard
                key={rec.id}
                rec={rec}
                paying={paying}
                onMarkPaid={handleMarkPaid}
                onEdit={r => setModal(r)}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal && modal !== 'add' && (
        <RecurringModal
          initial={modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
      {modal === 'add' && (
        <RecurringModal
          initial={null}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
    </Layout>
  )
}
