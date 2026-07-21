import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { expensesApi, categoriesApi } from '../api/expenses'
import { bankAccountsApi } from '../api/bankAccounts'
import { formatINR } from '../utils/currency'
import {
  Search, Plus, Edit2, Trash2, X, RotateCcw,
  ChevronLeft, ChevronRight, SlidersHorizontal, Tag, CreditCard, Calendar,
} from 'lucide-react'

const PAYMENT_METHODS = ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking']

const QUICK_EMOJIS = [
  '📂','🛒','🏠','🚗','🍔','💊','✈️','🎮',
  '💡','👕','📚','💰','🎵','🏋️','🐕','💻',
  '🌿','☕','🧴','🎓','🧾','🎁','🏥','🛵',
]

const MONTH_OPTIONS = (() => {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    opts.push({ value, label })
  }
  return opts
})()

function monthToRange(ym) {
  if (!ym) return {}
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from_date: `${ym}-01`, to_date: `${ym}-${String(last).padStart(2, '0')}` }
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
}

const inputCls = 'w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all'
const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }

// ── Inline category creation form ─────────────────────────────────────────────
function CreateCategoryForm({ onCreated, onCancel }) {
  const [name, setName]       = useState('')
  const [icon, setIcon]       = useState('📂')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); e.stopPropagation()
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      const cat = await categoriesApi.create({ name: name.trim(), icon })
      onCreated(cat)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
      className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>New category</p>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 mb-2">
        {QUICK_EMOJIS.map(e => (
          <button key={e} type="button" onClick={() => setIcon(e)}
            className="h-7 rounded text-sm text-center transition-all"
            style={{ background: icon === e ? 'rgba(139,92,246,0.2)' : 'transparent',
                     border: icon === e ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent' }}>
            {e}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mb-2 text-base rounded-lg px-2 py-1"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}>
        <span className="flex-shrink-0">{icon}</span>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Category name…"
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      {error && <p className="text-rose-400 text-xs mb-1">{error}</p>}

      <div className="flex gap-1.5">
        <button type="submit" disabled={!name.trim() || saving}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
          {saving ? '…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Expense modal ─────────────────────────────────────────────────────────────
function ExpenseModal({ open, onClose, onSave, editData, categories, onCategoryCreated }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ date: today, description: '', amount: '', category_id: '', payment_method: 'UPI', notes: '' })
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [showAddCat, setShowAddCat]   = useState(false)

  useEffect(() => {
    if (editData) {
      setForm({
        date: editData.date, description: editData.description,
        amount: String(editData.amount), category_id: editData.category?.id ?? '',
        payment_method: editData.payment_method ?? 'UPI', notes: editData.notes ?? '',
      })
    } else {
      setForm({ date: today, description: '', amount: '', category_id: '', payment_method: 'UPI', notes: '' })
    }
    setError(''); setShowAddCat(false)
  }, [editData, open])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = {
        date: form.date, description: form.description,
        amount: parseFloat(form.amount),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        payment_method: form.payment_method, notes: form.notes,
      }
      if (editData) await expensesApi.update(editData.id, payload)
      else await expensesApi.create(payload)
      onSave(); onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}>
      <div className="glass rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {editData ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-rose-400 text-sm"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputCls} style={inputStyle} required />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount (₹)</label>
              <input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className={inputCls} style={inputStyle} placeholder="0.00" required />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Description</label>
            <input type="text" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={inputCls} style={inputStyle} placeholder="e.g. Swiggy order" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Category</label>
                <button type="button" onClick={() => setShowAddCat(s => !s)}
                  className="text-[10px] flex items-center gap-0.5"
                  style={{ color: '#8b5cf6' }}>
                  <Plus size={10} /> Add
                </button>
              </div>
              <select value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="">Uncategorised</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Payment</label>
              <select value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className={inputCls} style={inputStyle}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Inline category creation inside modal */}
          {showAddCat && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
              <CreateCategoryForm
                onCreated={cat => {
                  onCategoryCreated(cat)
                  setForm(f => ({ ...f, category_id: String(cat.id) }))
                  setShowAddCat(false)
                }}
                onCancel={() => setShowAddCat(false)}
              />
            </div>
          )}

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={inputCls} style={inputStyle} placeholder="Optional…" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm transition-all"
              style={{ border: '1px solid var(--border-input)', color: 'var(--text-secondary)', background: 'var(--bg-button-ghost)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
              {saving ? <Spinner /> : (editData ? 'Save changes' : 'Add expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Extract a short merchant keyword from a bank narration ────────────────────
function descriptionKeyword(description) {
  let d = description || ''
  d = d.replace(/^(UPI[-/]|NACH\s+DR[-/]?|ACH\s+D[-/]?|NEFT[-/]|IMPS[-/]|RTG[-/]?)/i, '')
  d = d.split('@')[0].trim()
  const parts = d.split('-')
  d = parts[0].trim()
  return d.slice(0, 30).trim()
}

// ── Inline category picker (table row) ───────────────────────────────────────
// When you pick a category, it auto-applies to ALL expenses with a matching
// description keyword (all_matching=true). A toast shows how many were updated.
// The fix-similar prompt is intentionally removed — it lived inside the table's
// overflow-x-auto container and was clipped invisible.
function InlineCategoryPicker({ expense, categories, onSaved, onCategoryCreated, onAutoFixed }) {
  const [open, setOpen]             = useState(false)
  const [saving, setSaving]         = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function pick(catId) {
    const prevCatId = expense.category?.id
    // No-op: same category selected
    if (catId === prevCatId || (!catId && !prevCatId)) { setOpen(false); return }

    setSaving(true); setOpen(false); setShowCreate(false)
    try {
      // 1. Update this expense
      await expensesApi.update(expense.id, { category_id: catId || null })
      onSaved()

      // 2. Auto-apply to ALL expenses with a similar description keyword
      if (catId) {
        const keyword = descriptionKeyword(expense.description)
        if (keyword.length >= 4) {
          const res = await expensesApi.bulkCategorize({
            category_id: catId,
            description_contains: keyword,
            all_matching: true,   // includes already-categorised rows (e.g. "Others")
          })
          const cat = categories.find(c => c.id === catId)
          // res.updated includes the current expense; notify parent so it can reload + toast
          if (onAutoFixed) onAutoFixed({
            total: res.updated,
            categoryName: `${cat?.icon ?? ''} ${cat?.name}`.trim(),
            keyword,
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
        title="Change category">
        {saving ? <Spinner /> : (
          expense.category
            ? <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{expense.category.icon ?? ''} {expense.category.name}</span>
            : <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}><Tag size={12} /> Uncategorised</span>
        )}
      </button>

      {/* Dropdown — rendered with high z-index; parent table has overflow-x-auto
          so we use fixed positioning to escape the clipping context */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-medium)', zIndex: 9999 }}>
          <div className="max-h-56 overflow-y-auto py-1">
            <button onClick={() => pick(null)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              — Uncategorised
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => pick(c.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                style={{ color: expense.category?.id === c.id ? '#a78bfa' : 'var(--text-secondary)' }}>
                <span>{c.icon}</span>
                <span className="flex-1 truncate">{c.name}</span>
                {expense.category?.id === c.id && <span className="text-violet-400 text-xs">✓</span>}
              </button>
            ))}
          </div>

          {/* Inline create */}
          {showCreate ? (
            <CreateCategoryForm
              onCreated={cat => { onCategoryCreated(cat); pick(cat.id) }}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <button onClick={e => { e.stopPropagation(); setShowCreate(true) }}
              className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-1.5 transition-colors hover:bg-white/5"
              style={{ color: '#8b5cf6', borderTop: '1px solid var(--border-subtle)' }}>
              <Plus size={12} /> Add category
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const location = useLocation()
  const initialSearch = new URLSearchParams(location.search).get('search') || ''

  const [expenses, setExpenses]         = useState([])
  const [categories, setCategories]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(1)
  const [pages, setPages]               = useState(1)
  const [total, setTotal]               = useState(0)
  const [totalAmount, setTotalAmount]   = useState(0)
  const [search, setSearch]             = useState(initialSearch)
  const [searchInput, setSearchInput]   = useState(initialSearch)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateMode, setDateMode]         = useState('month')   // 'month' | 'custom'
  const [monthFilter, setMonthFilter]   = useState('')
  const [fromDate, setFromDate]         = useState('')
  const [toDate, setToDate]             = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [bankAccounts, setBankAccounts] = useState([])
  const [showFilters, setShowFilters]   = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [undoQueue, setUndoQueue]       = useState({})
  const [deletedIds, setDeletedIds]     = useState(new Set())
  const [autoFixToast, setAutoFixToast] = useState(null)   // { total, categoryName, keyword }
  const searchTimer = useRef(null)

  function buildParams(
    p = 1, q = search,
    cat = categoryFilter, month = monthFilter,
    from = fromDate, to = toDate,
    acc = accountFilter, mode = dateMode,
  ) {
    const params = { page: p, per_page: 25, sort: 'date_desc' }
    if (q) params.search = q
    if (cat === 'uncategorized') params.uncategorized = true
    else if (cat) params.category_id = cat

    if (mode === 'month') {
      const range = monthToRange(month)
      if (range.from_date) { params.from_date = range.from_date; params.to_date = range.to_date }
    } else if (mode === 'custom') {
      if (from) params.from_date = from
      if (to)   params.to_date   = to
    }

    if (acc) params.bank_account_id = acc
    return params
  }

  const load = useCallback(async (
    p = 1, q = search, cat = categoryFilter,
    month = monthFilter, from = fromDate, to = toDate,
    acc = accountFilter, mode = dateMode,
  ) => {
    setLoading(true)
    try {
      const res = await expensesApi.list(buildParams(p, q, cat, month, from, to, acc, mode))
      setExpenses(res.items)
      setPages(res.pages)
      setTotal(res.total)
      setTotalAmount(res.total_amount ?? 0)
    } finally { setLoading(false) }
  }, [search, categoryFilter, monthFilter, fromDate, toDate, accountFilter, dateMode])

  useEffect(() => { categoriesApi.list().then(setCategories) }, [])
  useEffect(() => { bankAccountsApi.list().then(setBankAccounts).catch(() => {}) }, [])
  useEffect(() => { load(1) }, [categoryFilter, monthFilter, fromDate, toDate, accountFilter, dateMode])

  function handleSearchChange(val) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); load(1, val) }, 400)
  }

  function clearFilters() {
    setCategoryFilter(''); setMonthFilter(''); setFromDate(''); setToDate('')
    setAccountFilter(''); setSearch(''); setSearchInput(''); setPage(1); setDateMode('month')
  }

  function handleCategoryCreated(cat) {
    setCategories(prev => [...prev, cat])
  }

  const hasDateFilter = dateMode === 'month' ? !!monthFilter : (!!fromDate || !!toDate)
  const activeFilterCount = [categoryFilter, hasDateFilter ? '1' : '', search, accountFilter].filter(Boolean).length
  const displayed = expenses.filter(e => !deletedIds.has(e.id))

  async function handleDelete(id) {
    setDeletedIds(s => new Set([...s, id]))
    const t = setTimeout(async () => {
      await expensesApi.delete(id)
      setDeletedIds(s => { const n = new Set(s); n.delete(id); return n })
      load(page)
    }, 5000)
    setUndoQueue(q => ({ ...q, [id]: t }))
  }

  function handleUndo(id) {
    clearTimeout(undoQueue[id])
    setUndoQueue(q => { const n = { ...q }; delete n[id]; return n })
    setDeletedIds(s => { const n = new Set(s); n.delete(id); return n })
  }

  // Build a human-readable date range label for the summary bar
  function dateRangeLabel() {
    if (dateMode === 'month' && monthFilter) {
      return MONTH_OPTIONS.find(o => o.value === monthFilter)?.label || monthFilter
    }
    if (dateMode === 'custom') {
      if (fromDate && toDate) return `${fromDate} → ${toDate}`
      if (fromDate) return `From ${fromDate}`
      if (toDate) return `Until ${toDate}`
    }
    return 'All time'
  }

  const anyFilter = activeFilterCount > 0 || hasDateFilter

  return (
    <Layout title="Expenses">
      {/* Auto-fix toast */}
      {autoFixToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.95),rgba(6,182,212,0.95))', backdropFilter: 'blur(12px)' }}>
          <span>
            ✅ Applied <b>{autoFixToast.categoryName}</b> to {autoFixToast.total} expense{autoFixToast.total !== 1 ? 's' : ''} matching "{autoFixToast.keyword}"
          </span>
          <button onClick={() => setAutoFixToast(null)} style={{ color: 'rgba(255,255,255,0.6)' }}><X size={14} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search expenses…"
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
        </div>

        <button onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all relative"
          style={showFilters || activeFilterCount > 0
            ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }
            : { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: '#8b5cf6' }}>{activeFilterCount}</span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button onClick={clearFilters}
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <X size={12} /> Clear all
          </button>
        )}

        <button onClick={() => { setEditTarget(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all ml-auto"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="glass rounded-xl p-4 mb-4 flex flex-wrap gap-4">

          {/* Date range section */}
          <div className="flex flex-col gap-1.5 min-w-[260px]">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wide flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}>
                <Calendar size={11} /> Date Range
              </label>
              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                {['month', 'custom'].map(m => (
                  <button key={m} onClick={() => { setDateMode(m); setPage(1) }}
                    className="px-2.5 py-0.5 rounded-md text-xs font-medium capitalize transition-all"
                    style={dateMode === m
                      ? { background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }
                      : { color: 'var(--text-muted)' }}>
                    {m === 'custom' ? 'Custom' : 'Month'}
                  </button>
                ))}
              </div>
            </div>

            {dateMode === 'month' ? (
              <select value={monthFilter}
                onChange={e => { setMonthFilter(e.target.value); setPage(1) }}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                <option value="">All months</option>
                {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={fromDate}
                  onChange={e => { setFromDate(e.target.value); setPage(1) }}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input type="date" value={toDate}
                  onChange={e => { setToDate(e.target.value); setPage(1) }}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
              </div>
            )}
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Category</label>
            <select value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
              <option value="">All categories</option>
              <option value="uncategorized">⚠️ Uncategorised only</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          {/* Bank Account */}
          {bankAccounts.length > 0 && (
            <div className="flex flex-col gap-1.5 min-w-[180px]">
              <label className="text-xs uppercase tracking-wide flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}>
                <CreditCard size={11} /> Account
              </label>
              <select value={accountFilter}
                onChange={e => { setAccountFilter(e.target.value); setPage(1) }}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                <option value="">All accounts</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
          )}

          {/* Quick links */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Quick</label>
            <div className="flex gap-2">
              <button onClick={() => { setCategoryFilter('uncategorized'); setPage(1) }}
                className="px-3 py-2 rounded-lg text-xs transition-all"
                style={categoryFilter === 'uncategorized'
                  ? { background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }
                  : { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                ⚠️ Uncategorised
              </button>
              <button onClick={() => {
                setDateMode('month')
                setMonthFilter(MONTH_OPTIONS[1]?.value)
                setPage(1)
              }}
                className="px-3 py-2 rounded-lg text-xs transition-all"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                Last month
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtered totals bar */}
      {!loading && total > 0 && (
        <div className="glass rounded-xl px-5 py-3 mb-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
              {anyFilter ? 'Filtered' : 'Total'} Expenses
            </p>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</p>
          </div>
          <div className="w-px h-8 self-center" style={{ background: 'var(--border-subtle)' }} />
          <div>
            <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
            <p className="text-xl font-bold text-rose-500">{formatINR(totalAmount)}</p>
          </div>
          {anyFilter && (
            <>
              <div className="w-px h-8 self-center" style={{ background: 'var(--border-subtle)' }} />
              <div>
                <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Period</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{dateRangeLabel()}</p>
              </div>
              {categoryFilter && categoryFilter !== 'uncategorized' && (
                <>
                  <div className="w-px h-8 self-center" style={{ background: 'var(--border-subtle)' }} />
                  <div>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Category</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {categories.find(c => String(c.id) === String(categoryFilter))?.icon}{' '}
                      {categories.find(c => String(c.id) === String(categoryFilter))?.name}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
          {categoryFilter === 'uncategorized' && (
            <span className="flex items-center gap-1 text-xs text-amber-500 ml-auto">
              <Tag size={12} /> Click any Category cell to fix categorisation
            </span>
          )}
        </div>
      )}

      {/* Undo toasts */}
      {[...deletedIds].map(id => (
        <div key={id} className="mb-2 flex items-center justify-between px-4 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <span>Expense deleted</span>
          <button onClick={() => handleUndo(id)} className="flex items-center gap-1 text-cyan-500 hover:text-cyan-400 transition-colors">
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      ))}

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Payment</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <div className="flex justify-center"><Spinner /></div>
                </td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
                    <span className="text-4xl mb-3">🧾</span>
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No expenses found</p>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                        Clear filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                displayed.map(exp => (
                  <tr key={exp.id} className="border-b hover:bg-white/[0.02] transition-colors group"
                    style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{exp.date}</td>
                    <td className="px-5 py-3 font-medium max-w-[240px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {exp.description}
                    </td>
                    <td className="px-3 py-2">
                      <InlineCategoryPicker
                        expense={exp}
                        categories={categories}
                        onSaved={() => load(page)}
                        onCategoryCreated={handleCategoryCreated}
                        onAutoFixed={info => {
                          setAutoFixToast(info)
                          load(page)
                          setTimeout(() => setAutoFixToast(null), 6000)
                        }}
                      />
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex flex-col gap-0.5">
                        <span>{exp.payment_method ?? '—'}</span>
                        {exp.bank_account && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: exp.bank_account.color }}>
                            {exp.bank_account.icon} {exp.bank_account.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                      {formatINR(exp.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => { setEditTarget(exp); setModalOpen(true) }}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
                          style={{ color: 'var(--text-muted)' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(exp.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-all"
                          style={{ color: 'var(--text-muted)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 text-sm"
            style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>{total} total</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
                <ChevronLeft size={16} />
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>{page} / {pages}</span>
              <button disabled={page === pages} onClick={() => { const p = page + 1; setPage(p); load(p) }}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={() => load(page)}
        editData={editTarget}
        categories={categories}
        onCategoryCreated={handleCategoryCreated}
      />
    </Layout>
  )
}
