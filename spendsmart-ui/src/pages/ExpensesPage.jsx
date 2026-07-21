import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { expensesApi, categoriesApi } from '../api/expenses'
import { bankAccountsApi } from '../api/bankAccounts'
import { formatINR } from '../utils/currency'
import { Search, Plus, Edit2, Trash2, X, RotateCcw, ChevronLeft, ChevronRight, SlidersHorizontal, Tag, CreditCard } from 'lucide-react'

const PAYMENT_METHODS = ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking']

const MONTH_OPTIONS = (() => {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
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

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all text-sm'

// ── Expense modal ─────────────────────────────────────────────────────────────
function ExpenseModal({ open, onClose, onSave, editData, categories }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ date: today, description: '', amount: '', category_id: '', payment_method: 'UPI', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editData) {
      setForm({
        date: editData.date,
        description: editData.description,
        amount: String(editData.amount),
        category_id: editData.category?.id ?? '',
        payment_method: editData.payment_method ?? 'UPI',
        notes: editData.notes ?? '',
      })
    } else {
      setForm({ date: today, description: '', amount: '', category_id: '', payment_method: 'UPI', notes: '' })
    }
    setError('')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{editData ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        {error && <div className="mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Amount (₹)</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" required />
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="e.g. Swiggy order" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className={inputCls}>
                <option value="">Uncategorised</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Payment</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inputCls}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Optional…" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
              {saving ? <Spinner /> : (editData ? 'Save changes' : 'Add expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Extract a short merchant keyword from a narration ────────────────────────
function descriptionKeyword(description) {
  let d = description || ''
  // Strip common bank prefixes
  d = d.replace(/^(UPI[-/]|NACH\s+DR[-/]?|ACH\s+D[-/]?|NEFT[-/]|IMPS[-/]|RTG[-/]?)/i, '')
  // Take first segment before @ or second hyphen
  d = d.split('@')[0].trim()
  const parts = d.split('-')
  d = parts[0].trim()
  return d.slice(0, 30).trim()
}

// ── Inline category picker ────────────────────────────────────────────────────
function InlineCategoryPicker({ expense, categories, onSaved, onFixSimilar }) {
  const [open, setOpen]           = useState(false)
  const [saving, setSaving]       = useState(false)
  const [fixPrompt, setFixPrompt] = useState(null)   // { categoryName, categoryId, keyword }
  const [fixing, setFixing]       = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function pick(catId) {
    const wasUncategorized = !expense.category
    setSaving(true)
    await expensesApi.update(expense.id, { category_id: catId || null })
    setSaving(false); setOpen(false)
    onSaved()
    // Offer "Fix similar" only when categorizing a previously-uncategorized expense
    if (wasUncategorized && catId) {
      const cat = categories.find(c => c.id === catId)
      const keyword = descriptionKeyword(expense.description)
      if (cat && keyword.length >= 3) {
        setFixPrompt({ categoryName: `${cat.icon ?? ''} ${cat.name}`, categoryId: catId, keyword })
      }
    }
  }

  async function handleFixAll() {
    if (!fixPrompt) return
    setFixing(true)
    const res = await expensesApi.bulkCategorize({
      category_id: fixPrompt.categoryId,
      description_contains: fixPrompt.keyword,
    })
    setFixing(false); setFixPrompt(null)
    if (onFixSimilar) onFixSimilar(res.updated)
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors group/cat"
        title="Change category">
        {saving ? <Spinner /> : (
          expense.category
            ? <span className="text-white/60 text-sm">{expense.category.icon ?? ''} {expense.category.name}</span>
            : <span className="flex items-center gap-1 text-white/30 text-sm"><Tag size={12} /> Uncategorised</span>
        )}
      </button>

      {/* Category dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 rounded-xl z-30 overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-medium)' }}>
          <div className="max-h-64 overflow-y-auto py-1">
            <button onClick={() => pick(null)}
              className="w-full text-left px-3 py-2 text-sm text-white/40 hover:bg-white/5 transition-colors">
              — Uncategorised
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => pick(c.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors flex items-center gap-2
                  ${expense.category?.id === c.id ? 'text-violet-400' : 'text-white/70'}`}>
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fix-similar prompt */}
      {fixPrompt && (
        <div className="absolute left-0 top-full mt-1 w-72 rounded-xl z-30 p-3 shadow-2xl"
          style={{ background: 'var(--bg-modal)', border: '1px solid rgba(139,92,246,0.35)' }}>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            Apply <b className="text-violet-300">{fixPrompt.categoryName}</b> to all
            uncategorised expenses containing <b className="text-slate-200">"{fixPrompt.keyword}"</b>?
          </p>
          <div className="flex gap-2">
            <button onClick={handleFixAll} disabled={fixing}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
              {fixing ? 'Fixing…' : 'Fix all similar'}
            </button>
            <button onClick={() => setFixPrompt(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
              style={{ background: 'var(--bg-input)' }}>
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const location = useLocation()
  const initialSearch = new URLSearchParams(location.search).get('search') || ''

  const [expenses, setExpenses]       = useState([])
  const [categories, setCategories]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [pages, setPages]             = useState(1)
  const [total, setTotal]             = useState(0)
  const [search, setSearch]           = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [categoryFilter, setCategoryFilter] = useState('')  // '' | 'uncategorized' | category_id
  const [monthFilter, setMonthFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [bankAccounts, setBankAccounts] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [undoQueue, setUndoQueue]     = useState({})
  const [deletedIds, setDeletedIds]   = useState(new Set())
  const [fixSimilarToast, setFixSimilarToast] = useState(null)  // { updated }
  const searchTimer = useRef(null)

  function buildParams(p = 1, q = search, cat = categoryFilter, month = monthFilter, acc = accountFilter) {
    const params = { page: p, per_page: 25, sort: 'date_desc' }
    if (q) params.search = q
    if (cat === 'uncategorized') params.uncategorized = true
    else if (cat) params.category_id = cat
    const range = monthToRange(month)
    if (range.from_date) { params.from_date = range.from_date; params.to_date = range.to_date }
    if (acc) params.bank_account_id = acc
    return params
  }

  const load = useCallback(async (p = 1, q = search, cat = categoryFilter, month = monthFilter, acc = accountFilter) => {
    setLoading(true)
    try {
      const res = await expensesApi.list(buildParams(p, q, cat, month, acc))
      setExpenses(res.items); setPages(res.pages); setTotal(res.total)
    } finally { setLoading(false) }
  }, [search, categoryFilter, monthFilter, accountFilter])

  useEffect(() => { categoriesApi.list().then(setCategories) }, [])
  useEffect(() => { bankAccountsApi.list().then(setBankAccounts).catch(() => {}) }, [])
  useEffect(() => { load(1) }, [categoryFilter, monthFilter, accountFilter])

  function handleSearchChange(val) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); load(1, val) }, 400)
  }

  function clearFilters() {
    setCategoryFilter(''); setMonthFilter(''); setAccountFilter(''); setSearch(''); setSearchInput(''); setPage(1)
  }

  const activeFilterCount = [categoryFilter, monthFilter, search, accountFilter].filter(Boolean).length

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

  return (
    <Layout title="Expenses">
      {/* Fix-similar toast */}
      {fixSimilarToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.95),rgba(6,182,212,0.95))', backdropFilter: 'blur(12px)' }}>
          <span>✅ Fixed {fixSimilarToast.updated} similar expense{fixSimilarToast.updated !== 1 ? 's' : ''}</span>
          <button onClick={() => setFixSimilarToast(null)} className="text-white/60 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search expenses…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-all" />
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
          <button onClick={clearFilters} className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
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
        <div className="glass rounded-xl p-4 mb-4 flex flex-wrap gap-3">
          {/* Month */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-white/40 text-xs uppercase tracking-wide">Month</label>
            <select value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(1) }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50">
              <option value="">All months</option>
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Category */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-white/40 text-xs uppercase tracking-wide">Category</label>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50">
              <option value="">All categories</option>
              <option value="uncategorized">⚠️ Uncategorised only</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          {/* Bank Account */}
          {bankAccounts.length > 0 && (
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-white/40 text-xs uppercase tracking-wide flex items-center gap-1">
                <CreditCard size={11} /> Account
              </label>
              <select value={accountFilter} onChange={e => { setAccountFilter(e.target.value); setPage(1) }}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50">
                <option value="">All accounts</option>
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Quick links */}
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs uppercase tracking-wide">Quick</label>
            <div className="flex gap-2">
              <button onClick={() => { setCategoryFilter('uncategorized'); setPage(1) }}
                className="px-3 py-2 rounded-lg text-xs transition-all"
                style={categoryFilter === 'uncategorized'
                  ? { background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }
                  : { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                ⚠️ Uncategorised
              </button>
              <button onClick={() => { setMonthFilter(MONTH_OPTIONS[1]?.value); setPage(1) }}
                className="px-3 py-2 rounded-lg text-xs transition-all"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                Last month
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toasts */}
      {[...deletedIds].map(id => (
        <div key={id} className="mb-2 flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70">
          <span>Expense deleted</span>
          <button onClick={() => handleUndo(id)} className="flex items-center gap-1 text-cyan-400 hover:text-white transition-colors">
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      ))}

      {/* Stats bar */}
      {!loading && total > 0 && (
        <div className="mb-3 flex items-center gap-4 text-sm text-white/40">
          <span>{total} expenses</span>
          {categoryFilter === 'uncategorized' && (
            <span className="flex items-center gap-1 text-amber-400">
              <Tag size={12} /> Click the category column to fix categorisation
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
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
                <tr><td colSpan={6} className="py-16 text-center"><div className="flex justify-center"><Spinner /></div></td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="flex flex-col items-center py-16 text-white/30">
                    <span className="text-4xl mb-3">🧾</span>
                    <p className="text-white/50 font-medium">No expenses found</p>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">Clear filters</button>
                    )}
                  </div>
                </td></tr>
              ) : (
                displayed.map(exp => (
                  <tr key={exp.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3 text-white/50 whitespace-nowrap">{exp.date}</td>
                    <td className="px-5 py-3 text-white font-medium max-w-[240px] truncate">{exp.description}</td>
                    <td className="px-3 py-2">
                      <InlineCategoryPicker expense={exp} categories={categories} onSaved={() => load(page)}
                        onFixSimilar={count => { setFixSimilarToast({ updated: count }); load(page); setTimeout(() => setFixSimilarToast(null), 4000) }} />
                    </td>
                    <td className="px-5 py-3 text-white/50">
                      <div className="flex flex-col gap-0.5">
                        <span>{exp.payment_method ?? '—'}</span>
                        {exp.bank_account && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: exp.bank_account.color }}>
                            {exp.bank_account.icon} {exp.bank_account.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-white whitespace-nowrap">{formatINR(exp.amount)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => { setEditTarget(exp); setModalOpen(true) }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-cyan-400 transition-all"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(exp.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/40 hover:text-rose-400 transition-all"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 text-sm text-white/40">
            <span>{total} total</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"><ChevronLeft size={16} /></button>
              <span className="text-white/60">{page} / {pages}</span>
              <button disabled={page === pages} onClick={() => { const p = page + 1; setPage(p); load(p) }}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <ExpenseModal open={modalOpen} onClose={() => setModalOpen(false)}
        onSave={() => load(page)} editData={editTarget} categories={categories} />
    </Layout>
  )
}
