import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Bell, Shield, Database, Save, CheckCircle,
  Eye, EyeOff, Trash2, AlertTriangle, X, Loader2, Palette,
  Moon, Sun, Tag, Plus, Pencil,
} from 'lucide-react'
import Layout from '../components/layout/Layout'
import { usersApi } from '../api/users'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'
import { categoriesApi } from '../api/expenses'

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
      style={{ background: checked ? 'rgba(139,92,246,0.7)' : 'var(--bg-button-ghost)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="glass rounded-2xl overflow-hidden mb-4">
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Row({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function InlineAlert({ type, msg, onClose }) {
  if (!msg) return null
  const isErr = type === 'error'
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm mb-4"
      style={{
        background: isErr ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
        border: `1px solid ${isErr ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
        color: isErr ? '#fb7185' : '#34d399',
      }}>
      <span className="flex-1">{msg}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
          <X size={13} />
        </button>
      )}
    </div>
  )
}

const TABS = [
  { id: 'profile',       label: 'Profile',        icon: User     },
  { id: 'appearance',    label: 'Appearance',      icon: Palette  },
  { id: 'categories',    label: 'Categories',      icon: Tag      },
  { id: 'security',      label: 'Security',        icon: Shield   },
  { id: 'notifications', label: 'Notifications',   icon: Bell     },
  { id: 'data',          label: 'Data & Privacy',  icon: Database },
]

const CAT_COLORS = [
  '#8b5cf6','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#ec4899','#3b82f6','#84cc16',
  '#f97316','#a855f7','#14b8a6','#eab308',
]
const CAT_ICONS = ['📂','🏷️','⭐','🎯','🛒','🎮','🎨','🏠','🚀','💡','🎵','📚','🏋️','🌿','🐾','✈️','🍕','💊']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { logout, updateUser } = useAuth()
  const { theme, setDark, setLight } = useTheme()
  const [tab, setTab] = useState('profile')

  // Profile
  const [profile, setProfile] = useState(null)
  const [profileForm, setProfileForm] = useState({ full_name: '', monthly_income: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })
  const [profileDirty, setProfileDirty] = useState(false)

  // Categories
  const [allCats, setAllCats] = useState([])
  const [catModal, setCatModal] = useState(null)  // null | 'add' | { edit: cat }
  const [catForm, setCatForm] = useState({ name: '', icon: '📂', color: '#8b5cf6' })
  const [catSaving, setCatSaving] = useState(false)
  const [catDeleting, setCatDeleting] = useState(null)

  async function loadCats() {
    categoriesApi.list().then(setAllCats).catch(() => {})
  }

  useEffect(() => {
    if (tab === 'categories') loadCats()
  }, [tab])

  async function saveCat(e) {
    e.preventDefault()
    setCatSaving(true)
    try {
      if (catModal?.edit) {
        await categoriesApi.update(catModal.edit.id, catForm)
      } else {
        await categoriesApi.create(catForm)
      }
      setCatModal(null)
      loadCats()
    } catch { /* ignore */ }
    finally { setCatSaving(false) }
  }

  async function deleteCat(id) {
    setCatDeleting(id)
    try { await categoriesApi.delete(id); loadCats() }
    catch { /* ignore */ }
    finally { setCatDeleting(null) }
  }

  // Security
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current_password: false, new_password: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  // Notifications
  const [notifs, setNotifs] = useState({
    budgetAlert: true, weeklySummary: true, monthlyTips: true,
    largeTxAlert: true, largeTxThreshold: '5000',
  })

  // Delete account
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    usersApi.profile()
      .then(data => {
        setProfile(data)
        setProfileForm({
          full_name: data.full_name,
          monthly_income: data.monthly_income != null ? String(data.monthly_income) : '',
        })
      })
      .catch(() => setProfileMsg({ type: 'error', text: 'Failed to load profile' }))
  }, [])

  const inputClass = "px-3 py-2 rounded-xl text-sm text-slate-200 outline-none transition-all w-52"
  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }
  const focusStyle = e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')
  const blurStyle  = e => (e.target.style.borderColor = 'var(--border-input)')

  const initials = name =>
    name ? name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) : '?'

  async function handleProfileSave() {
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      const body = {}
      if (profileForm.full_name.trim()) body.full_name = profileForm.full_name.trim()
      if (profileForm.monthly_income !== '') body.monthly_income = Number(profileForm.monthly_income)
      const updated = await usersApi.updateProfile(body)
      setProfile(updated)
      updateUser({ full_name: updated.full_name })
      setProfileDirty(false)
      setProfileMsg({ type: 'success', text: 'Profile saved!' })
      setTimeout(() => setProfileMsg({ type: '', text: '' }), 3000)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setProfileMsg({ type: 'error', text: detail || 'Failed to save profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' }); return
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' }); return
    }
    setPwSaving(true)
    try {
      await usersApi.changePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      setPwForm({ current_password: '', new_password: '', confirm: '' })
      setPwMsg({ type: 'success', text: 'Password changed successfully!' })
      setTimeout(() => setPwMsg({ type: '', text: '' }), 4000)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setPwMsg({ type: 'error', text: detail || 'Failed to change password' })
    } finally {
      setPwSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await usersApi.deleteAccount()
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setDeleting(false)
      setDeleteModal(false)
    }
  }

  return (
    <Layout title="Settings">
      <div className="flex gap-6 max-w-4xl">

        {/* Tab sidebar */}
        <div className="w-44 flex-shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                ${tab === id ? 'text-violet-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
              style={tab === id ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' } : {}}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">

          {/* ── Profile ──────────────────────────────────────────────────── */}
          {tab === 'profile' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-200">Profile Information</h2>
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving || !profileDirty}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: profileMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
                >
                  {profileSaving
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : profileMsg.type === 'success'
                    ? <><CheckCircle size={14} /> Saved!</>
                    : <><Save size={14} /> Save Changes</>}
                </button>
              </div>

              <InlineAlert
                type={profileMsg.type}
                msg={profileMsg.type === 'error' ? profileMsg.text : ''}
                onClose={() => setProfileMsg({ type: '', text: '' })}
              />

              {/* Avatar card */}
              {profile ? (
                <div className="glass rounded-2xl p-5 mb-4 flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                    {initials(profile.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200">{profile.full_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      <span className="text-xs text-slate-400">
                        <span className="text-slate-200 font-semibold">{profile.expense_count.toLocaleString('en-IN')}</span> expenses
                      </span>
                      <span className="text-xs text-slate-400">
                        <span className="text-slate-200 font-semibold">{profile.income_count.toLocaleString('en-IN')}</span> income records
                      </span>
                      <span className="text-xs text-slate-400">
                        Member since <span className="text-slate-200 font-medium">
                          {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass rounded-2xl p-5 mb-4 h-24 animate-pulse"
                  style={{ background: 'var(--bg-button-ghost)' }} />
              )}

              <Section title="Personal Info">
                <Row label="Full Name" sub="Your display name in the app">
                  <input
                    className={inputClass}
                    style={inputStyle}
                    onFocus={focusStyle} onBlur={blurStyle}
                    value={profileForm.full_name}
                    onChange={e => { setProfileForm(f => ({ ...f, full_name: e.target.value })); setProfileDirty(true) }}
                    placeholder="Your name"
                  />
                </Row>
                <Row label="Email Address" sub="Used for login — contact support to change">
                  <input
                    className={inputClass}
                    style={{ ...inputStyle, cursor: 'not-allowed', opacity: 0.5 }}
                    value={profile?.email || ''}
                    readOnly
                  />
                </Row>
              </Section>

              <Section title="Financial Preferences">
                <Row label="Monthly Income" sub="Used to calculate savings rate and personalise tips">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                    <input
                      type="number" min="0"
                      className={`${inputClass} pl-7`}
                      style={inputStyle}
                      onFocus={focusStyle} onBlur={blurStyle}
                      value={profileForm.monthly_income}
                      onChange={e => { setProfileForm(f => ({ ...f, monthly_income: e.target.value })); setProfileDirty(true) }}
                      placeholder="e.g. 80000"
                    />
                  </div>
                </Row>
                <Row label="Currency" sub="Display currency for all amounts">
                  <select
                    className={inputClass}
                    style={{ ...inputStyle, cursor: 'pointer', width: '9rem' }}
                    onFocus={focusStyle} onBlur={blurStyle}
                  >
                    <option>₹ INR</option>
                    <option disabled>$ USD (soon)</option>
                    <option disabled>€ EUR (soon)</option>
                  </select>
                </Row>
              </Section>
            </div>
          )}

          {/* ── Appearance ───────────────────────────────────────────────── */}
          {tab === 'appearance' && (
            <div>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Appearance</h2>

              <Section title="Theme">
                <div className="px-5 py-5">
                  <p className="text-xs text-slate-500 mb-4">Choose how SpendSmart looks on this device.</p>
                  <div className="grid grid-cols-2 gap-3">

                    {/* Dark */}
                    <button
                      onClick={setDark}
                      className="relative flex flex-col items-start gap-3 p-4 rounded-xl border transition-all text-left"
                      style={{
                        background: theme === 'dark' ? 'rgba(139,92,246,0.1)' : 'var(--bg-button-ghost)',
                        borderColor: theme === 'dark' ? 'rgba(139,92,246,0.5)' : 'var(--border-input)',
                      }}
                    >
                      {/* Preview swatch */}
                      <div className="w-full h-16 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex h-full">
                          <div className="w-1/4 h-full" style={{ background: 'var(--bg-sidebar)' }} />
                          <div className="flex-1 p-2 flex flex-col gap-1">
                            <div className="h-2 w-3/4 rounded" style={{ background: 'var(--bg-input-hover)' }} />
                            <div className="h-2 w-1/2 rounded" style={{ background: 'rgba(139,92,246,0.4)' }} />
                            <div className="h-2 w-2/3 rounded" style={{ background: 'var(--bg-input)' }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Moon size={14} className="text-violet-400" />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Dark</span>
                      </div>
                      {theme === 'dark' && (
                        <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(139,92,246,0.9)' }}>
                          <CheckCircle size={10} className="text-white" />
                        </span>
                      )}
                    </button>

                    {/* Light */}
                    <button
                      onClick={setLight}
                      className="relative flex flex-col items-start gap-3 p-4 rounded-xl border transition-all text-left"
                      style={{
                        background: theme === 'light' ? 'rgba(139,92,246,0.1)' : 'var(--bg-button-ghost)',
                        borderColor: theme === 'light' ? 'rgba(139,92,246,0.5)' : 'var(--border-input)',
                      }}
                    >
                      {/* Preview swatch */}
                      <div className="w-full h-16 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ background: '#f4f6fb', border: '1px solid rgba(0,0,0,0.08)' }}>
                        <div className="flex h-full">
                          <div className="w-1/4 h-full" style={{ background: '#ffffff' }} />
                          <div className="flex-1 p-2 flex flex-col gap-1">
                            <div className="h-2 w-3/4 rounded" style={{ background: 'rgba(0,0,0,0.1)' }} />
                            <div className="h-2 w-1/2 rounded" style={{ background: 'rgba(139,92,246,0.5)' }} />
                            <div className="h-2 w-2/3 rounded" style={{ background: 'rgba(0,0,0,0.06)' }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sun size={14} className="text-amber-400" />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Light</span>
                      </div>
                      {theme === 'light' && (
                        <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(139,92,246,0.9)' }}>
                          <CheckCircle size={10} className="text-white" />
                        </span>
                      )}
                    </button>

                  </div>
                </div>
              </Section>

              <Section title="Accent">
                <Row label="Accent Colour" sub="Purple → Cyan gradient — more themes coming soon">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }} />
                    <span className="text-xs text-slate-500">Purple / Cyan</span>
                  </div>
                </Row>
              </Section>
            </div>
          )}

          {/* ── Categories ───────────────────────────────────────────────── */}
          {tab === 'categories' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Categories</h2>
                <button
                  onClick={() => { setCatForm({ name: '', icon: '📂', color: '#8b5cf6' }); setCatModal('add') }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                  <Plus size={14} /> New Category
                </button>
              </div>

              {/* System categories */}
              <Section title="System Categories (read-only)">
                <div className="flex flex-wrap gap-2 px-5 py-4">
                  {allCats.filter(c => c.is_system).map(c => (
                    <span key={c.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      {c.icon} {c.name}
                    </span>
                  ))}
                </div>
              </Section>

              {/* Custom categories */}
              <Section title="Your Custom Categories">
                {allCats.filter(c => !c.is_system).length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Tag size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No custom categories yet</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create one to track expenses that don't fit system categories</p>
                  </div>
                ) : (
                  allCats.filter(c => !c.is_system).map(c => (
                    <Row key={c.id}
                      label={
                        <span className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
                            style={{ background: `${c.color || '#8b5cf6'}20` }}>
                            {c.icon}
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                        </span>
                      }>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color || '#8b5cf6' }} />
                        <button onClick={() => { setCatForm({ name: c.name, icon: c.icon || '📂', color: c.color || '#8b5cf6' }); setCatModal({ edit: c }) }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteCat(c.id)} disabled={catDeleting === c.id}
                          className="p-1.5 rounded-lg transition-colors" style={{ color: '#fb7185' }}>
                          {catDeleting === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </Row>
                  ))
                )}
              </Section>
            </div>
          )}

          {/* ── Category modal ─────────────────────────────────────────────── */}
          {catModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
              onClick={e => e.target === e.currentTarget && setCatModal(null)}>
              <div className="w-full max-w-sm rounded-2xl p-6"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {catModal?.edit ? 'Edit Category' : 'New Category'}
                  </h3>
                  <button onClick={() => setCatModal(null)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
                </div>
                <form onSubmit={saveCat} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Name</label>
                    <input required className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                      value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Side hustle expenses" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Icon</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CAT_ICONS.map(em => (
                        <button key={em} type="button" onClick={() => setCatForm(f => ({ ...f, icon: em }))}
                          className="w-8 h-8 rounded-lg text-sm transition-all"
                          style={{
                            background: catForm.icon === em ? `${catForm.color}30` : 'var(--bg-surface-hover)',
                            border: catForm.icon === em ? `1.5px solid ${catForm.color}` : '1px solid var(--border-subtle)',
                          }}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Colour</label>
                    <div className="flex gap-2 flex-wrap">
                      {CAT_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setCatForm(f => ({ ...f, color: c }))}
                          className="w-6 h-6 rounded-full transition-all flex items-center justify-center"
                          style={{ background: c, outline: catForm.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}>
                          {catForm.color === c && <CheckCircle size={11} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setCatModal(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                      style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={catSaving}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                      {catSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : catModal?.edit ? 'Save' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────────────────── */}
          {tab === 'security' && (
            <div>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Security</h2>

              <InlineAlert type={pwMsg.type} msg={pwMsg.text} onClose={() => setPwMsg({ type: '', text: '' })} />

              <Section title="Change Password">
                <form onSubmit={handlePasswordChange}>
                  {[
                    { key: 'current_password', label: 'Current Password',     placeholder: '••••••••' },
                    { key: 'new_password',      label: 'New Password',         placeholder: 'Min 8 characters' },
                    { key: 'confirm',           label: 'Confirm New Password', placeholder: 'Repeat new password' },
                  ].map(({ key, label, placeholder }) => (
                    <Row key={key} label={label}>
                      <div className="relative">
                        <input
                          type={showPw[key] ? 'text' : 'password'}
                          required
                          value={pwForm[key]}
                          onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className={`${inputClass} pr-9`}
                          style={inputStyle}
                          onFocus={focusStyle} onBlur={blurStyle}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPw[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </Row>
                  ))}
                  <div className="px-5 py-4">
                    <button
                      type="submit"
                      disabled={pwSaving || !pwForm.current_password || !pwForm.new_password || !pwForm.confirm}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
                    >
                      {pwSaving
                        ? <><Loader2 size={14} className="animate-spin" /> Changing…</>
                        : <><Shield size={14} /> Change Password</>}
                    </button>
                  </div>
                </form>
              </Section>

              <Section title="Account Status">
                <Row label="Email Verified" sub={profile?.is_verified ? 'Your email is verified' : 'Please verify your email'}>
                  <span className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={profile?.is_verified
                      ? { background: 'rgba(16,185,129,0.1)', color: '#34d399' }
                      : { background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
                    {profile?.is_verified ? '✓ Verified' : '⚠ Unverified'}
                  </span>
                </Row>
                <Row label="Member Since">
                  <span className="text-xs text-slate-400">
                    {profile
                      ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                      : '—'}
                  </span>
                </Row>
              </Section>
            </div>
          )}

          {/* ── Notifications ─────────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <div>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Notification Preferences</h2>
              <div className="glass rounded-2xl px-5 py-4 mb-4 text-xs text-slate-500"
                style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
                ℹ️ Email notifications require SMTP configuration. Toggles are saved for when email delivery is enabled.
              </div>
              <Section title="Email Alerts">
                <Row label="Budget Alert" sub="Email when a category reaches 80% of its budget">
                  <Toggle checked={notifs.budgetAlert} onChange={v => setNotifs(n => ({ ...n, budgetAlert: v }))} />
                </Row>
                <Row label="Weekly Summary" sub="Spending summary every Sunday evening">
                  <Toggle checked={notifs.weeklySummary} onChange={v => setNotifs(n => ({ ...n, weeklySummary: v }))} />
                </Row>
                <Row label="Month-End Tips" sub="Personalised tips on the 25th of each month">
                  <Toggle checked={notifs.monthlyTips} onChange={v => setNotifs(n => ({ ...n, monthlyTips: v }))} />
                </Row>
                <Row label="Large Transaction Alert"
                  sub={`Alert for transactions above ₹${Number(notifs.largeTxThreshold || 0).toLocaleString('en-IN')}`}>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
                      <input
                        type="number"
                        value={notifs.largeTxThreshold}
                        onChange={e => setNotifs(n => ({ ...n, largeTxThreshold: e.target.value }))}
                        className="pl-6 pr-2 py-1.5 rounded-lg text-xs text-slate-200 w-24 outline-none"
                        style={inputStyle}
                        onFocus={focusStyle} onBlur={blurStyle}
                      />
                    </div>
                    <Toggle checked={notifs.largeTxAlert} onChange={v => setNotifs(n => ({ ...n, largeTxAlert: v }))} />
                  </div>
                </Row>
              </Section>
            </div>
          )}

          {/* ── Data & Privacy ────────────────────────────────────────────── */}
          {tab === 'data' && (
            <div>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Data & Privacy</h2>

              <Section title="Your Data">
                <Row label="Total Expenses" sub="Expense records stored in your account">
                  <span className="text-sm font-semibold text-slate-200">
                    {profile?.expense_count.toLocaleString('en-IN') ?? '—'}
                  </span>
                </Row>
                <Row label="Income Records" sub="Income entries tracked in your account">
                  <span className="text-sm font-semibold text-slate-200">
                    {profile?.income_count.toLocaleString('en-IN') ?? '—'}
                  </span>
                </Row>
                <Row label="Statement Files" sub="Uploaded statements are deleted from servers immediately after processing">
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                    Auto-deleted
                  </span>
                </Row>
              </Section>

              <Section title="Danger Zone">
                <Row label="Delete Account" sub="Permanently deletes your account, all expenses, budgets, and data. Cannot be undone.">
                  <button
                    onClick={() => setDeleteModal(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-rose-500/10"
                    style={{ border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}
                  >
                    <Trash2 size={12} /> Delete Account
                  </button>
                </Row>
              </Section>
            </div>
          )}

        </div>
      </div>

      {/* ── Delete account modal ──────────────────────────────────────────── */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--overlay-bg)' }}
          onClick={e => { if (e.target === e.currentTarget) { setDeleteModal(false); setDeleteConfirm('') } }}
        >
          <div className="glass rounded-2xl p-6 w-full max-w-md" style={{ border: '1px solid rgba(244,63,94,0.3)' }}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(244,63,94,0.15)' }}>
                <AlertTriangle size={20} style={{ color: '#fb7185' }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Account</h3>
                <p className="text-xs text-slate-400 mt-1">
                  This will permanently delete your account, all expenses, income records,
                  budgets, and imported statements.{' '}
                  <strong className="text-rose-400">This cannot be undone.</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-2">
              Type <span className="font-mono text-white font-semibold">DELETE</span> to confirm:
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 outline-none mb-4 font-mono"
              style={{ background: 'var(--bg-input)', border: '1px solid rgba(244,63,94,0.3)' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(244,63,94,0.6)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(244,63,94,0.3)')}
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteModal(false); setDeleteConfirm('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                style={{ background: 'var(--bg-input)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'rgba(244,63,94,0.7)' }}
              >
                {deleting
                  ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={14} /> Delete Forever</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
