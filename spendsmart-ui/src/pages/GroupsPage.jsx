import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Trash2, X, ChevronRight, IndianRupee } from 'lucide-react'
import Layout from '../components/layout/Layout'
import { groupsApi } from '../api/groups'
import { useAuth } from '../hooks/useAuth'

function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const g = await groupsApi.create({ name: name.trim(), description: desc.trim() || null })
      onCreate(g)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">New Group</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Group Name *</label>
            <input
              required autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Goa Trip 2024"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Description (optional)</label>
            <input
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Weekend trip to Goa"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-colors" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GroupsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    groupsApi.list().then(setGroups).finally(() => setLoading(false))
  }, [])

  function handleCreated(g) {
    setShowCreate(false)
    navigate(`/groups/${g.id}`)
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this group? This cannot be undone.')) return
    await groupsApi.remove(id)
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Split Expenses</h1>
            <p className="text-slate-500 text-sm mt-0.5">Create groups, add expenses, settle up</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
            <Plus size={16} /> New Group
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Users size={28} className="text-violet-400" />
            </div>
            <p className="text-slate-300 font-medium mb-1">No groups yet</p>
            <p className="text-slate-600 text-sm mb-5">Create a group for your next trip or outing</p>
            <button onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
              Create your first group
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} onClick={() => navigate(`/groups/${g.id}`)}
                className="glass rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <Users size={20} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{g.name}</p>
                  <p className="text-slate-500 text-sm">{g.member_count} member{g.member_count !== 1 ? 's' : ''} · ₹{g.total_expenses.toLocaleString('en-IN')} total</p>
                </div>
                <div className="flex items-center gap-2">
                  {g.created_by === user?.id && (
                    <button onClick={e => handleDelete(e, g.id)}
                      className="p-2 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={15} />
                    </button>
                  )}
                  <ChevronRight size={16} className="text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
    </Layout>
  )
}
