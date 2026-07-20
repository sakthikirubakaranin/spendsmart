import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, UserPlus, Trash2, X, ArrowRight, Users, Receipt, Calculator } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { groupsApi } from '../api/groups'
import { useAuth } from '../hooks/useAuth'

// ── Add Member Modal ──────────────────────────────────────────────────────────
function AddMemberModal({ groupId, onClose, onAdded }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await groupsApi.addMember(groupId, email.trim())
      onAdded(res.message)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add member')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Add Member</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">SpendSmart Email</label>
            <input required type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 text-sm" />
            <p className="text-xs text-slate-600 mt-1.5">They must already have a SpendSmart account</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90" style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
              {loading ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────
function AddExpenseModal({ groupId, members, onClose, onAdded }) {
  const { user } = useAuth()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(user?.id || '')
  const [splitType, setSplitType] = useState('equal')
  const [customSplits, setCustomSplits] = useState(
    members.map(m => ({ user_id: m.user_id, name: m.user.full_name, amount: '' }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateSplit(userId, val) {
    setCustomSplits(prev => prev.map(s => s.user_id === userId ? { ...s, amount: val } : s))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const body = {
        description: desc.trim(),
        amount: parseFloat(amount),
        paid_by: paidBy,
        split_type: splitType,
      }
      if (splitType === 'custom') {
        body.splits = customSplits.map(s => ({ user_id: s.user_id, amount: parseFloat(s.amount || 0) }))
      }
      const res = await groupsApi.addExpense(groupId, body)
      onAdded(res)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add expense')
    } finally { setLoading(false) }
  }

  const totalCustom = customSplits.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
  const amtNum = parseFloat(amount || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Add Expense</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Description *</label>
            <input required value={desc} onChange={e => setDesc(e.target.value)} placeholder="Hotel booking"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Amount (₹) *</label>
            <input required type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Paid by</label>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 text-sm">
              {members.map(m => <option key={m.user_id} value={m.user_id} style={{ background: '#0a0a16' }}>{m.user.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">Split type</label>
            <div className="flex gap-2">
              {['equal', 'custom'].map(t => (
                <button key={t} type="button" onClick={() => setSplitType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${splitType === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  style={splitType === t ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {splitType === 'equal' && amtNum > 0 && (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-slate-500 mb-2">Each person pays:</p>
              {members.map(m => (
                <div key={m.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{m.user.full_name}</span>
                  <span className="text-violet-300 font-medium">₹{(amtNum / members.length).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {splitType === 'custom' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Enter each person's share:</p>
              {customSplits.map(s => (
                <div key={s.user_id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 flex-1 truncate">{s.name}</span>
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                    <input type="number" min="0" step="0.01" value={s.amount} onChange={e => updateSplit(s.user_id, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50" />
                  </div>
                </div>
              ))}
              {amtNum > 0 && (
                <p className={`text-xs mt-1 ${Math.abs(totalCustom - amtNum) < 0.02 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Total: ₹{totalCustom.toFixed(2)} / ₹{amtNum.toFixed(2)}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-400 hover:text-slate-200" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90" style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
              {loading ? 'Adding…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Expenses', 'Members', 'Settlement']

export default function GroupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [settlement, setSettlement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Expenses')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)

  async function reload() {
    const [g, s] = await Promise.all([
      groupsApi.get(id),
      groupsApi.settlement(id),
    ])
    setGroup(g)
    setSettlement(s)
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [id])

  async function handleDeleteExpense(expId) {
    if (!confirm('Remove this expense?')) return
    await groupsApi.deleteExpense(id, expId)
    reload()
  }

  async function handleRemoveMember(userId) {
    if (!confirm('Remove this member?')) return
    await groupsApi.removeMember(id, userId)
    reload()
  }

  const isAdmin = group?.members?.find(m => m.user_id === user?.id)?.role === 'admin'

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  if (!group) return (
    <AppLayout>
      <div className="p-6 text-slate-400">Group not found.</div>
    </AppLayout>
  )

  const totalExpenses = group.expenses.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/groups')} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{group.name}</h1>
            {group.description && <p className="text-slate-500 text-sm">{group.description}</p>}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Spent', value: `₹${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: Receipt },
            { label: 'Members', value: group.members.length, icon: Users },
            { label: 'Settlements', value: settlement?.settlements?.length || 0, icon: Calculator },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className="text-violet-400" />
                <p className="text-xs text-slate-500">{label}</p>
              </div>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
              style={tab === t ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' } : {}}>
              {t}
            </button>
          ))}
        </div>

        {/* Expenses tab */}
        {tab === 'Expenses' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
                <Plus size={15} /> Add Expense
              </button>
            </div>
            {group.expenses.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No expenses yet — add one above</div>
            ) : (
              <div className="space-y-3">
                {[...group.expenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)).map(exp => (
                  <div key={exp.id} className="glass rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{exp.description}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          Paid by <span className="text-violet-300">{exp.payer.full_name}</span> · {new Date(exp.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-white font-bold">₹{parseFloat(exp.amount).toLocaleString('en-IN')}</span>
                        {(exp.paid_by === user?.id || isAdmin) && (
                          <button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Splits */}
                    <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-1.5">
                      {exp.splits.map(s => (
                        <div key={s.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 truncate">{s.user.full_name}</span>
                          <span className={s.user_id === exp.paid_by ? 'text-emerald-400' : 'text-slate-400'}>
                            ₹{parseFloat(s.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members tab */}
        {tab === 'Members' && (
          <div>
            {isAdmin && (
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowAddMember(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
                  <UserPlus size={15} /> Add Member
                </button>
              </div>
            )}
            <div className="space-y-2">
              {group.members.map(m => {
                const initials = m.user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                return (
                  <div key={m.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{m.user.full_name} {m.user_id === user?.id ? '(you)' : ''}</p>
                      <p className="text-slate-500 text-xs truncate">{m.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.role === 'admin' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium text-violet-300" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                          Admin
                        </span>
                      )}
                      {isAdmin && m.user_id !== group.created_by && m.user_id !== user?.id && (
                        <button onClick={() => handleRemoveMember(m.user_id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Settlement tab */}
        {tab === 'Settlement' && (
          <div>
            {settlement?.settlements?.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Calculator size={24} className="text-emerald-400" />
                </div>
                <p className="text-slate-300 font-medium">All settled up!</p>
                <p className="text-slate-600 text-sm mt-1">No payments needed</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-500 text-sm mb-4">Minimum transactions to settle all debts:</p>
                {settlement.settlements.map((s, i) => (
                  <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{s.from_user.full_name}</p>
                      <p className="text-slate-500 text-xs">pays</p>
                    </div>
                    <ArrowRight size={16} className="text-violet-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-white font-medium text-sm truncate">{s.to_user.full_name}</p>
                      <p className="text-emerald-400 font-bold text-sm">₹{parseFloat(s.amount).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddMember && (
        <AddMemberModal groupId={id} onClose={() => setShowAddMember(false)}
          onAdded={() => { setShowAddMember(false); reload() }} />
      )}
      {showAddExpense && (
        <AddExpenseModal groupId={id} members={group.members} onClose={() => setShowAddExpense(false)}
          onAdded={() => { setShowAddExpense(false); reload() }} />
      )}
    </AppLayout>
  )
}
