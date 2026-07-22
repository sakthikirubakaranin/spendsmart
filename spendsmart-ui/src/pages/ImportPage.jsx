import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, X, Loader, AlertCircle, CreditCard } from 'lucide-react'
import Layout from '../components/layout/Layout'
import { importsApi } from '../api/imports'
import { bankAccountsApi } from '../api/bankAccounts'
import { formatINR } from '../utils/currency'

const ALL_CATEGORIES = [
  { slug: 'food_dining',        label: '🍽️ Food & Dining' },
  { slug: 'grocery',            label: '🛒 Grocery' },
  { slug: 'fuel',               label: '⛽ Petrol & Fuel' },
  { slug: 'transport',          label: '🚌 Transport' },
  { slug: 'ott_subscriptions',  label: '📱 OTT & Subscriptions' },
  { slug: 'cloud_services',     label: '☁️ Cloud Services' },
  { slug: 'housing',            label: '🏠 Housing' },
  { slug: 'loan_emi',           label: '🏦 Loan EMI' },
  { slug: 'insurance',          label: '🛡️ Insurance' },
  { slug: 'tax',                label: '🧾 Tax' },
  { slug: 'credit_card_bill',   label: '💳 Credit Card Bill' },
  { slug: 'online_shopping',    label: '🛍️ Online Shopping' },
  { slug: 'health_medical',     label: '🏥 Health & Medical' },
  { slug: 'personal_care',      label: '💈 Personal Care' },
  { slug: 'education',          label: '📚 Education' },
  { slug: 'utilities',          label: '📡 Utilities' },
  { slug: 'savings',            label: '🪣 Savings (Gullak)' },
  { slug: 'savings_investment', label: '💰 Investments' },
  { slug: 'travel',             label: '✈️ Travel' },
  { slug: 'fitness',            label: '🏋️ Fitness' },
  { slug: 'family_transfer',    label: '👨‍👩‍👧 Family Transfer' },
  { slug: 'others',             label: '📦 Others' },
]

const INCOME_TYPES = [
  { slug: 'salary',     label: '💼 Salary' },
  { slug: 'freelance',  label: '🧑‍💻 Freelance' },
  { slug: 'refund',     label: '↩️ Refund' },
  { slug: 'government', label: '🏛️ Government' },
  { slug: 'transfer',   label: '↔️ Transfer Received' },
  { slug: 'other',      label: '📥 Other Income' },
]

const slugToLabel = Object.fromEntries(ALL_CATEGORIES.map(c => [c.slug, c.label]))

function ConfidencePill({ score }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e'
  const bg    = score >= 80 ? 'rgba(16,185,129,0.1)' : score >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)'
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ color, background: bg }}>
      {score}%
    </span>
  )
}

export default function ImportPage() {
  const navigate = useNavigate()
  const fileRef = useRef()

  // stage: idle | uploading | reviewing | confirming | done | error
  const [stage, setStage]           = useState('idle')
  const [dragOver, setDragOver]     = useState(false)
  const [uploadData, setUploadData] = useState(null)   // UploadResponse from API
  const [categories, setCategories] = useState({})     // { temp_id: slug }
  const [result, setResult]         = useState(null)   // ConfirmResponse
  const [error, setError]           = useState('')
  const [history, setHistory]       = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')

  useEffect(() => {
    importsApi.history()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false))

    bankAccountsApi.list()
      .then(accounts => {
        setBankAccounts(accounts)
        const def = accounts.find(a => a.is_default)
        if (def) setSelectedAccountId(def.id)
      })
      .catch(() => {})
  }, [])

  async function handleFile(file) {
    if (!file) return
    setError('')
    setStage('uploading')
    try {
      const data = await importsApi.upload(file)
      if (data.parse_error && data.debits.length === 0) {
        setError(data.parse_error)
        setStage('error')
        return
      }
      setUploadData(data)
      // Initialise category/income-type map from auto-categorizer suggestions
      const catMap = {}
      data.debits.forEach(t => { catMap[t.temp_id] = t.category_slug })
      data.credits.forEach(t => { catMap[t.temp_id] = t.income_type || 'other' })
      setCategories(catMap)
      setStage('reviewing')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Upload failed. Please try again.'
      setError(msg)
      setStage('error')
    }
  }

  async function handleDeleteHistory(importId) {
    try {
      await importsApi.deleteHistory(importId)
      setHistory(prev => prev.filter(h => h.id !== importId))
    } catch {
      // silently ignore
    }
  }

  async function handleConfirm() {
    setStage('confirming')
    try {
      const transactions = [
        ...uploadData.debits.map(t => ({
          temp_id:        t.temp_id,
          date:           t.date,
          description:    t.description,
          amount:         t.amount,
          payment_method: t.payment_method,
          category_slug:  categories[t.temp_id] || 'others',
          income_type:    '',
          txn_type:       'debit',
          row_hash:       t.row_hash,
        })),
        ...uploadData.credits.map(t => ({
          temp_id:        t.temp_id,
          date:           t.date,
          description:    t.description,
          amount:         t.amount,
          payment_method: t.payment_method,
          category_slug:  '',
          income_type:    categories[t.temp_id] || 'other',
          txn_type:       'credit',
          row_hash:       t.row_hash,
        })),
      ]
      const res = await importsApi.confirm(uploadData.import_id, transactions, selectedAccountId || null)
      setResult(res)
      setStage('done')
      // Refresh history
      importsApi.history().then(setHistory).catch(() => {})
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Confirm failed. Please try again.'
      setError(msg)
      setStage('error')
    }
  }

  function reset() {
    setStage('idle')
    setUploadData(null)
    setCategories({})
    setResult(null)
    setError('')
  }

  const autoCount    = uploadData?.debits.filter(t => (t.confidence ?? 0) >= 70 && !t.is_duplicate).length ?? 0
  const reviewCount  = uploadData?.debits.filter(t => (t.confidence ?? 0) < 70  && !t.is_duplicate).length ?? 0
  const dupCount     = uploadData?.duplicate_count ?? 0
  const newCount     = uploadData?.new_count ?? 0
  const salaryTotal  = uploadData?.credits
    .filter(t => t.income_type === 'salary' && !t.is_duplicate)
    .reduce((s, t) => s + t.amount, 0) ?? 0

  return (
    <Layout title="Import Statement">
      <div className="space-y-6 max-w-4xl">

        {/* ── Upload zone ── */}
        {(stage === 'idle' || stage === 'uploading') && (
          <div className="glass rounded-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Upload Bank Statement</h3>
                <p className="text-xs text-slate-500">
                  Supports XLS, XLSX, CSV, PDF · Max 25 MB
                </p>
              </div>
              {/* Bank account selector */}
              {bankAccounts.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CreditCard size={13} className="text-slate-500" />
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
                    style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-medium)', color: '#c4b5fd' }}
                  >
                    <option value="">No account</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.icon} {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {stage === 'idle' ? (
              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                className="border-2 border-dashed rounded-xl p-14 flex flex-col items-center gap-3 cursor-pointer transition-all"
                style={{
                  borderColor: dragOver ? 'rgba(139,92,246,0.5)' : 'var(--border-input)',
                  background:  dragOver ? 'rgba(139,92,246,0.06)' : 'var(--bg-surface)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Upload size={24} className="text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-200">Drop your statement here</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-1 justify-center">
                  {['XLS', 'XLSX', 'CSV', 'PDF'].map(f => (
                    <span key={f} className="text-xs px-2.5 py-1 rounded-lg font-semibold text-slate-400"
                      style={{ background: 'var(--bg-surface-hover)' }}>{f}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {['HDFC', 'HDFC CC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'Yes Bank', 'IDFC'].map(b => (
                    <span key={b} className="text-[10px] px-2 py-0.5 rounded-md text-slate-500"
                      style={{ background: 'var(--bg-button-ghost)', border: '1px solid var(--border-subtle)' }}>{b}</span>
                  ))}
                </div>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".xls,.xlsx,.xlsm,.csv,.pdf"
                  onChange={e => handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="rounded-xl p-6 flex items-center gap-4"
                style={{ background: 'var(--bg-surface)' }}>
                <Loader size={20} className="text-violet-400 animate-spin flex-shrink-0" />
                <span className="text-sm text-slate-300">Parsing your statement and auto-categorizing transactions…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Error state ── */}
        {stage === 'error' && (
          <div className="glass rounded-2xl p-6">
            <div className="flex items-start gap-3 text-rose-400 mb-4">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Could not parse the file</p>
                <p className="text-xs text-rose-300/70 mt-1">{error}</p>
              </div>
            </div>
            <button onClick={reset}
              className="text-sm px-4 py-2 rounded-xl font-medium text-slate-300"
              style={{ background: 'var(--bg-surface-hover)' }}>
              Try another file
            </button>
          </div>
        )}

        {/* ── Review queue ── */}
        {stage === 'reviewing' && uploadData && (
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-200">Review Transactions</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
                      🏦 {uploadData.bank}
                    </span>
                  </div>
                  {uploadData.parse_error && (
                    <p className="text-xs text-amber-400 mt-1">⚠️ {uploadData.parse_error}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={reset}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-slate-500 hover:text-slate-300 transition-colors"
                    style={{ background: 'var(--bg-button-ghost)' }}>
                    Cancel
                  </button>
                  <button onClick={handleConfirm}
                    className="text-xs px-4 py-1.5 rounded-lg font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                    Confirm Import →
                  </button>
                </div>
              </div>

              {/* Duplicate notice */}
              {dupCount > 0 && (
                <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <span className="text-cyan-400 text-base flex-shrink-0">ℹ️</span>
                  <div>
                    <p className="text-cyan-300 font-semibold text-xs">
                      {dupCount} transactions already imported — will be skipped automatically
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      Only the <span className="text-white font-semibold">{newCount} new transactions</span> will be added. No duplicates will be created.
                    </p>
                  </div>
                </div>
              )}

              {/* Stats bar */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-4">
                <span>Found <b className="text-slate-300">{uploadData.total_found}</b> transactions</span>
                <span>·</span>
                <span><b className="text-emerald-400">{newCount}</b> new</span>
                {dupCount > 0 && (<><span>·</span>
                  <span><b className="text-cyan-400">{dupCount}</b> already imported (skipped)</span></>
                )}
                <span>·</span>
                <span><b className="text-slate-300">{autoCount}</b> auto-categorized</span>
                {reviewCount > 0 && (<><span>·</span>
                  <span><b className="text-amber-400">{reviewCount}</b> need review</span></>
                )}
                {salaryTotal > 0 && (<><span>·</span>
                  <span><b className="text-emerald-400">₹{salaryTotal.toLocaleString('en-IN')}</b> salary detected</span></>
                )}
              </div>

              {uploadData.debits.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">
                  No expense transactions found in this file.
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Narration</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Conf.</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadData.debits.map((tx, i) => (
                        <tr key={tx.temp_id}
                          style={{
                            borderBottom: i < uploadData.debits.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            opacity: tx.is_duplicate ? 0.4 : 1,
                          }}>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{tx.date}</td>
                          <td className="px-4 py-3 text-xs text-slate-300 max-w-[200px] truncate font-mono" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-200 whitespace-nowrap text-right">
                            {formatINR(tx.amount)}
                          </td>
                          <td className="px-4 py-3">
                            {tx.is_duplicate
                              ? <span className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee' }}>Already imported</span>
                              : <ConfidencePill score={tx.confidence} />
                            }
                          </td>
                          <td className="px-4 py-3">
                            {tx.is_duplicate ? (
                              <span className="text-xs text-slate-600 italic">will be skipped</span>
                            ) : (
                              <select
                                value={categories[tx.temp_id] || 'others'}
                                onChange={e => setCategories(prev => ({ ...prev, [tx.temp_id]: e.target.value }))}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg text-slate-200 outline-none cursor-pointer"
                                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)' }}
                              >
                                {ALL_CATEGORIES.map(c => (
                                  <option key={c.slug} value={c.slug}>{c.label}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Income / Credits section — sibling card */}
            {uploadData.credits.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-200 mb-1">
                  💰 Income Detected
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  These are credits to your account. Tag them correctly so your income is tracked.
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: 'rgba(16,185,129,0.05)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Description</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Conf.</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadData.credits.map((tx, i) => (
                        <tr key={tx.temp_id}
                          style={{
                            borderBottom: i < uploadData.credits.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            opacity: tx.is_duplicate ? 0.4 : 1,
                          }}>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{tx.date}</td>
                          <td className="px-4 py-3 text-xs text-slate-300 max-w-[220px] truncate font-mono" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-emerald-400 whitespace-nowrap text-right">
                            +{formatINR(tx.amount)}
                          </td>
                          <td className="px-4 py-3">
                            {tx.is_duplicate
                              ? <span className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee' }}>Already imported</span>
                              : <ConfidencePill score={tx.confidence} />
                            }
                          </td>
                          <td className="px-4 py-3">
                            {tx.is_duplicate ? (
                              <span className="text-xs text-slate-600 italic">will be skipped</span>
                            ) : (
                              <select
                                value={categories[tx.temp_id] || 'other'}
                                onChange={e => setCategories(prev => ({ ...prev, [tx.temp_id]: e.target.value }))}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg text-slate-200 outline-none cursor-pointer"
                                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                              >
                                {INCOME_TYPES.map(c => (
                                  <option key={c.slug} value={c.slug}>{c.label}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Confirming spinner ── */}

        {stage === 'confirming' && (
          <div className="glass rounded-2xl p-10 flex flex-col items-center gap-4">
            <Loader size={32} className="text-violet-400 animate-spin" />
            <p className="text-sm text-slate-400">Saving transactions to your account…</p>
          </div>
        )}

        {/* ── Done ── */}
        {stage === 'done' && result && (
          <div className="glass rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">Import complete!</h3>
            <p className="text-sm text-slate-500 mb-1">
              <b className="text-slate-300">{result.expenses_imported}</b> expenses
              {result.income_imported > 0 && <> · <b className="text-emerald-400">{result.income_imported}</b> income entries</>}
              {result.duplicates_skipped > 0 && ` · ${result.duplicates_skipped} duplicates skipped`}
            </p>
            {result.recurring_detected > 0 && (
              <p className="text-sm text-violet-400 mb-1">
                🔁 <b>{result.recurring_detected}</b> recurring expense{result.recurring_detected > 1 ? 's' : ''} auto-detected and added to <span
                  className="underline cursor-pointer hover:text-violet-300"
                  onClick={() => navigate('/recurring')}>Recurring</span>
              </p>
            )}
            <p className="text-xs text-slate-600 mb-6">Your dashboard has been updated.</p>
            <div className="flex justify-center gap-3">
              <button onClick={reset}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                Import Another
              </button>
              <button onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                View Dashboard →
              </button>
            </div>
          </div>
        )}

        {/* ── Upload history ── */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Upload History</h3>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader size={14} className="animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-600">No imports yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <FileText size={16} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{h.filename}</p>
                    <p className="text-xs text-slate-500">
                      {h.bank_name || 'Unknown bank'}
                      {h.imported_rows != null && ` · ${h.imported_rows} imported`}
                      {h.total_rows   != null && ` of ${h.total_rows}`}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                    h.status === 'completed'
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : h.status === 'failed'
                        ? 'text-rose-400 bg-rose-400/10'
                        : 'text-amber-400 bg-amber-400/10'
                  }`}>{h.status}</span>
                  <span className="text-xs text-slate-600 whitespace-nowrap">
                    {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => handleDeleteHistory(h.id)}
                    className="text-slate-600 hover:text-rose-400 transition-colors ml-1"
                    title="Remove from history"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
