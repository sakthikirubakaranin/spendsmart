import { useState, useEffect } from 'react'
import {
  CreditCard, Plus, Pencil, Trash2, Star, X, Loader2,
  CheckCircle, AlertTriangle, Building2,
} from 'lucide-react'
import Layout from '../components/layout/Layout'
import { bankAccountsApi } from '../api/bankAccounts'
import { formatINR } from '../utils/currency'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'savings',     label: 'Savings Account',   emoji: '🏦' },
  { value: 'current',     label: 'Current Account',   emoji: '🏢' },
  { value: 'credit_card', label: 'Credit Card',        emoji: '💳' },
  { value: 'wallet',      label: 'Digital Wallet',     emoji: '📱' },
]

const PRESET_COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#84cc16',
]

const BANK_ICONS = ['🏦', '🏢', '💳', '📱', '💰', '🪙', '🏛️', '💼']

const TYPE_LABEL = {
  savings: 'Savings',
  current: 'Current',
  credit_card: 'Credit Card',
  wallet: 'Wallet',
}

// ── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({ account, onEdit, onDelete, onSetDefault }) {
  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col gap-3 transition-all"
      style={{
        background: `linear-gradient(135deg, ${account.color}18, ${account.color}08)`,
        border: account.is_default
          ? `1.5px solid ${account.color}80`
          : '1px solid var(--border-subtle)',
      }}
    >
      {/* Default badge */}
      {account.is_default && (
        <span
          className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${account.color}25`, color: account.color }}
        >
          <Star size={9} fill="currentColor" /> DEFAULT
        </span>
      )}

      {/* Top row */}
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${account.color}20` }}
        >
          {account.icon}
        </div>
        <div className="flex-1 min-w-0 mt-0.5">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {account.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {account.bank_name}
            {account.last_4_digits && ` •••• ${account.last_4_digits}`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-lg uppercase tracking-wide"
          style={{ background: `${account.color}18`, color: account.color }}
        >
          {TYPE_LABEL[account.account_type] || account.account_type}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {account.expense_count.toLocaleString('en-IN')} expenses
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        {!account.is_default && (
          <button
            onClick={() => onSetDefault(account.id)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-surface-hover)' }}
          >
            <Star size={11} /> Set default
          </button>
        )}
        <button
          onClick={() => onEdit(account)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
          style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface-hover)' }}
        >
          <Pencil size={11} /> Edit
        </button>
        <button
          onClick={() => onDelete(account)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: '#fb7185', background: 'rgba(244,63,94,0.08)' }}
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  )
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function AccountModal({ account, onClose, onSaved }) {
  const isEdit = !!account
  const [form, setForm] = useState({
    name: account?.name || '',
    bank_name: account?.bank_name || '',
    account_type: account?.account_type || 'savings',
    last_4_digits: account?.last_4_digits || '',
    color: account?.color || '#8b5cf6',
    icon: account?.icon || '🏦',
    is_default: account?.is_default || false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.bank_name.trim()) return
    setLoading(true); setError('')
    try {
      const body = {
        ...form,
        last_4_digits: form.last_4_digits?.trim() || null,
      }
      if (isEdit) {
        await bankAccountsApi.update(account.id, body)
      } else {
        await bankAccountsApi.create(body)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save account')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
  const inputStyle = { background: 'var(--bg-surface-hover)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Account' : 'Add Bank Account'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-rose-400 text-xs"
            style={{ background: 'rgba(244,63,94,0.1)' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Bank */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Account Nickname
              </label>
              <input required className={inputClass} style={inputStyle}
                placeholder="e.g. HDFC Salary"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Bank Name
              </label>
              <input required className={inputClass} style={inputStyle}
                placeholder="e.g. HDFC Bank"
                value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
            </div>
          </div>

          {/* Type + Last 4 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Account Type
              </label>
              <select className={inputClass} style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.account_type} onChange={e => set('account_type', e.target.value)}>
                {ACCOUNT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Last 4 Digits (optional)
              </label>
              <input className={inputClass} style={inputStyle}
                placeholder="e.g. 4242"
                maxLength={4} pattern="\d{4}"
                value={form.last_4_digits} onChange={e => set('last_4_digits', e.target.value)} />
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {BANK_ICONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => set('icon', emoji)}
                  className="w-9 h-9 rounded-lg text-lg transition-all"
                  style={{
                    background: form.icon === emoji ? `${form.color}30` : 'var(--bg-surface-hover)',
                    border: form.icon === emoji ? `1.5px solid ${form.color}` : '1px solid var(--border-subtle)',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
              Card Color
            </label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className="w-7 h-7 rounded-full transition-all flex items-center justify-center"
                  style={{
                    background: c,
                    outline: form.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                >
                  {form.color === c && <CheckCircle size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Default toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={e => set('is_default', e.target.checked)}
              className="w-4 h-4 accent-violet-500"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Set as default account
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : isEdit ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteModal({ account, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await bankAccountsApi.delete(account.id)
      onDeleted()
      onClose()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(244,63,94,0.3)' }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(244,63,94,0.15)' }}>
            <AlertTriangle size={20} style={{ color: '#fb7185' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Delete Account</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Remove <strong>{account.name}</strong>? Existing expenses linked to this account will be unlinked but not deleted.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'rgba(244,63,94,0.7)' }}>
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // null | 'add' | { edit: account } | { delete: account }

  async function loadAccounts() {
    setLoading(true)
    try {
      const data = await bankAccountsApi.list()
      setAccounts(data)
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  async function handleSetDefault(id) {
    await bankAccountsApi.setDefault(id)
    loadAccounts()
  }

  const totalExpenses = accounts.reduce((s, a) => s + a.expense_count, 0)

  return (
    <Layout title="Bank Accounts">
      <div className="max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} · {totalExpenses.toLocaleString('en-IN')} total expenses
            </p>
          </div>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
          >
            <Plus size={15} /> Add Account
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-40 rounded-2xl animate-pulse"
                style={{ background: 'var(--bg-surface)' }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && accounts.length === 0 && (
          <div className="glass rounded-2xl p-12 flex flex-col items-center text-center">
            <Building2 size={40} className="mb-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              No accounts yet
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Add your bank accounts to track which account each expense comes from.
            </p>
            <button
              onClick={() => setModal('add')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
            >
              <Plus size={15} /> Add First Account
            </button>
          </div>
        )}

        {/* Account grid */}
        {!loading && accounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map(acc => (
              <AccountCard
                key={acc.id}
                account={acc}
                onEdit={acc => setModal({ edit: acc })}
                onDelete={acc => setModal({ delete: acc })}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        )}

        {/* Info box */}
        {!loading && accounts.length > 0 && (
          <div className="mt-6 glass rounded-xl px-4 py-3 flex items-start gap-3">
            <CreditCard size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              When importing a bank statement, you can select which account it belongs to.
              Expenses can be filtered by account on the Expenses page.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <AccountModal onClose={() => setModal(null)} onSaved={loadAccounts} />
      )}
      {modal?.edit && (
        <AccountModal account={modal.edit} onClose={() => setModal(null)} onSaved={loadAccounts} />
      )}
      {modal?.delete && (
        <DeleteModal account={modal.delete} onClose={() => setModal(null)} onDeleted={loadAccounts} />
      )}
    </Layout>
  )
}
