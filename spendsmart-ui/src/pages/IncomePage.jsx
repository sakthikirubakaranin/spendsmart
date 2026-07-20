import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Plus, Pencil, Trash2, X, Loader2,
  ChevronLeft, ChevronRight, RotateCcw,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import Layout from '../components/layout/Layout'
import { incomeApi } from '../api/income'
import { formatINR } from '../utils/currency'

// ── Constants ─────────────────────────────────────────────────────────────────

const INCOME_TYPES = [
  { value: 'salary',     label: 'Salary',          emoji: '💼', color: '#8b5cf6' },
  { value: 'freelance',  label: 'Freelance',        emoji: '🧑‍💻', color: '#06b6d4' },
  { value: 'refund',     label: 'Refund',           emoji: '↩️',  color: '#10b981' },
  { value: 'government', label: 'Government',       emoji: '🏛️', color: '#f59e0b' },
  { value: 'transfer',   label: 'Transfer',         emoji: '↔️',  color: '#ec4899' },
  { value: 'other',      label: 'Other',            emoji: '📥', color: '#94a3b8' },
]

const TYPE_MAP = Object.fromEntries(INCOME_TYPES.map(t => [t.value, t]))

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent || 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  )
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function IncomeModal({ entry, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: entry?.date || today,
    amount: entry ? String(entry.amount) : '',
    description: entry?.description || '',
    income_type: entry?.income_type || 'salary',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const body = { ...form, amount: parseFloat(form.amount) }
      if (entry) await incomeApi.update(entry.id, body)
      else await incomeApi.create(body)
      onSaved(); onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
  const inputStyle = { background: 'var(--bg-surface-hover)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.3)' }}>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {entry ? 'Edit Income' : 'Add Income'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        {error && <div className="mb-4 px-3 py-2 rounded-lg text-rose-400 text-xs"
          style={{ background: 'rgba(244,63,94,0.1)' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input required type="date" className={inputCls} style={inputStyle}
                value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Amount (₹)</label>
              <input required type="number" min="0.01" step="0.01" className={inputCls} style={inputStyle}
                placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Description</label>
            <input required className={inputCls} style={inputStyle}
              placeholder="e.g. Monthly salary from employer"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Type</label>
            <div className="grid grid-cols-3 gap-2">
              {INCOME_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => set('income_type', t.value)}
                  className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: form.income_type === t.value ? `${t.color}18` : 'var(--bg-surface-hover)',
                    border: form.income_type === t.value ? `1.5px solid ${t.color}60` : '1px solid var(--border-subtle)',
                    color: form.income_type === t.value ? t.color : 'var(--text-secondary)',
                  }}>
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : entry ? 'Save Changes' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Custom tooltip for bar chart ──────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
      <p className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p style={{ color: '#10b981' }}>{formatINR(payload[0]?.value || 0)}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const [summary, setSummary]       = useState(null)
  const [trend, setTrend]           = useState([])
  const [byType, setByType]         = useState([])
  const [entries, setEntries]       = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [pages, setPages]           = useState(1)
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)   // null | 'add' | { edit: entry }
  const [undoQueue, setUndoQueue]   = useState({})
  const [deletedIds, setDeletedIds] = useState(new Set())
  const [typeFilter, setTypeFilter] = useState('')

  async function loadAll(p = 1) {
    setLoading(true)
    try {
      const [sumRes, trendRes, typeRes, listRes] = await Promise.all([
        incomeApi.summary(),
        incomeApi.monthlyTrend(12),
        incomeApi.byType(),
        incomeApi.list({ page: p, per_page: 25, ...(typeFilter ? { income_type: typeFilter } : {}) }),
      ])
      setSummary(sumRes)
      setTrend(trendRes.map(r => ({
        label: `${MONTH_NAMES[r.month - 1]} ${String(r.year).slice(2)}`,
        total: r.total,
      })))
      setByType(typeRes)
      setEntries(listRes.items)
      setTotal(listRes.total)
      setPages(listRes.pages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll(1) }, [typeFilter])

  async function handleDelete(id) {
    setDeletedIds(s => new Set([...s, id]))
    const t = setTimeout(async () => {
      await incomeApi.remove(id)
      setDeletedIds(s => { const n = new Set(s); n.delete(id); return n })
      loadAll(page)
    }, 5000)
    setUndoQueue(q => ({ ...q, [id]: t }))
  }

  function handleUndo(id) {
    clearTimeout(undoQueue[id])
    setUndoQueue(q => { const n = { ...q }; delete n[id]; return n })
    setDeletedIds(s => { const n = new Set(s); n.delete(id); return n })
  }

  const displayed = entries.filter(e => !deletedIds.has(e.id))

  const PIE_COLORS = byType.map(t => TYPE_MAP[t.income_type]?.color || '#94a3b8')

  return (
    <Layout title="Income">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="This Month"
          value={summary ? formatINR(summary.this_month_total) : '—'}
          sub={summary ? `${summary.this_month_count} entries` : ''}
          accent="#10b981"
        />
        <MetricCard
          label="Last Month"
          value={summary ? formatINR(summary.last_month_total) : '—'}
        />
        <MetricCard
          label="Year to Date"
          value={summary ? formatINR(summary.ytd_total) : '—'}
          sub={summary ? `${summary.ytd_count} entries` : ''}
          accent="#06b6d4"
        />
        <MetricCard
          label="Avg Monthly"
          value={summary ? formatINR(summary.avg_monthly) : '—'}
          sub="based on all months"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Monthly trend bar chart */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Income (12 months)</p>
          {trend.length === 0 ? (
            <div className="h-48 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              <Spinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} barSize={18}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Income by type donut */}
        <div className="glass rounded-2xl p-5">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>By Type (this year)</p>
          {byType.length === 0 ? (
            <div className="h-48 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              No income recorded
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={byType} dataKey="total" nameKey="income_type"
                    cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    strokeWidth={0}>
                    {byType.map((entry, i) => (
                      <Cell key={entry.income_type} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {byType.map((t, i) => {
                  const meta = TYPE_MAP[t.income_type]
                  return (
                    <div key={t.income_type} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {meta?.emoji} {meta?.label || t.income_type}
                      </span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t.pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* List toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Income Entries
              {total > 0 && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{total} total</span>}
            </p>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <option value="">All types</option>
              {INCOME_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
          <button onClick={() => setModal('add')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
            <Plus size={14} /> Add Income
          </button>
        </div>

        {/* Undo toasts */}
        {[...deletedIds].map(id => (
          <div key={id} className="flex items-center justify-between px-5 py-2.5 text-sm border-b" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(16,185,129,0.05)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Entry removed</span>
            <button onClick={() => handleUndo(id)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-white transition-colors">
              <RotateCcw size={12} /> Undo
            </button>
          </div>
        ))}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center"><Spinner /></td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
                    <TrendingUp size={36} className="mb-3" />
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No income entries yet</p>
                    <p className="text-xs">Add your salary, freelance earnings, or any other income</p>
                  </div>
                </td></tr>
              ) : (
                displayed.map(entry => {
                  const meta = TYPE_MAP[entry.income_type] || TYPE_MAP.other
                  return (
                    <tr key={entry.id} className="border-b group transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-5 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{entry.date}</td>
                      <td className="px-5 py-3 max-w-[280px] truncate font-medium" style={{ color: 'var(--text-primary)' }}>{entry.description}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium"
                          style={{ background: `${meta.color}15`, color: meta.color }}>
                          {meta.emoji} {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: '#10b981' }}>
                        {formatINR(entry.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ edit: entry })}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-rose-500/10" style={{ color: '#fb7185' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); loadAll(page - 1) }}
                className="p-1.5 rounded-lg disabled:opacity-30 transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= pages} onClick={() => { setPage(p => p + 1); loadAll(page + 1) }}
                className="p-1.5 rounded-lg disabled:opacity-30 transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <IncomeModal
          entry={modal?.edit || null}
          onClose={() => setModal(null)}
          onSaved={() => loadAll(1)}
        />
      )}
    </Layout>
  )
}
