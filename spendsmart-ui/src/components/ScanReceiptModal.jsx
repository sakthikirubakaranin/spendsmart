/**
 * ScanReceiptModal
 *
 * Lets the user:
 *  - Take a photo with their phone camera (mobile)
 *  - Upload an image or PDF from their device
 *
 * Sends to POST /ocr/scan-receipt, shows extracted data in an editable form,
 * then creates the expense on confirm.
 */

import { useRef, useState, useEffect } from 'react'
import { Camera, Upload, X, CheckCircle, AlertCircle, Loader2, RotateCcw, Receipt } from 'lucide-react'
import { client } from '../api/client'
import { expensesApi, categoriesApi } from '../api/expenses'

const today = () => new Date().toISOString().slice(0, 10)

const CONFIDENCE_LABEL = {
  high:   { text: 'High confidence', color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  medium: { text: 'Medium confidence', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  low:    { text: 'Low confidence — please verify', color: '#f87171', bg: 'rgba(244,63,94,0.12)' },
}

export default function ScanReceiptModal({ onClose, onSaved }) {
  const cameraRef    = useRef(null)
  const uploadRef    = useRef(null)

  const [step, setStep]         = useState('pick')   // pick | scanning | review | saving | done | error
  const [preview, setPreview]   = useState(null)      // data URL for image preview
  const [fileName, setFileName] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [errMsg, setErrMsg]     = useState('')
  const [categories, setCategories] = useState([])

  // Editable form fields (pre-filled from OCR)
  const [form, setForm] = useState({
    date: today(), amount: '', description: '', category_id: '', payment_method: 'UPI', notes: '',
  })

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {})
  }, [])

  // When OCR result arrives, pre-fill form
  useEffect(() => {
    if (!scanResult) return
    const matchedCat = categories.find(c => c.slug === scanResult.suggested_category_slug)
    setForm(f => ({
      ...f,
      date:        scanResult.date || today(),
      amount:      scanResult.amount?.toFixed(2) || '',
      description: scanResult.description || '',
      category_id: matchedCat ? String(matchedCat.id) : '',
    }))
  }, [scanResult, categories])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── File chosen ────────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return

    setFileName(file.name)
    setErrMsg('')

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(file)
    } else {
      setPreview(null)  // PDF: no preview
    }

    setStep('scanning')

    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await client.post('/ocr/scan-receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setScanResult(data)
      setStep('review')
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to scan receipt. Please try again.'
      setErrMsg(detail)
      setStep('error')
    }
  }

  // ── Submit expense ─────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setStep('saving')
    try {
      await expensesApi.create({
        ...form,
        amount: parseFloat(form.amount),
        category_id: form.category_id ? parseInt(form.category_id) : undefined,
      })
      setStep('done')
      setTimeout(() => { onSaved?.(); onClose() }, 1200)
    } catch (err) {
      setErrMsg(err?.response?.data?.detail || 'Failed to save expense')
      setStep('review')
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm text-slate-100 placeholder-slate-400 outline-none transition-all"
  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-input)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-modal)', border: '1px solid rgba(139,92,246,0.35)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-violet-400" />
            <span className="text-sm font-semibold text-slate-100">Scan Receipt / Bill</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        {/* ── Step: pick ── */}
        {step === 'pick' && (
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-500 text-center">Take a photo or upload an image/PDF of your receipt</p>

            {/* Camera (mobile: opens back camera) */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            <button onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: '1px solid rgba(139,92,246,0.4)' }}>
              <Camera size={20} />
              Take a Photo
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--bg-surface-hover)' }} />
              <span className="text-xs text-slate-600">or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--bg-surface-hover)' }} />
            </div>

            {/* File upload (desktop + mobile) */}
            <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            <button onClick={() => uploadRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--bg-button-ghost)', border: '1px solid var(--border-medium)' }}>
              <Upload size={18} />
              Upload Image or PDF
            </button>

            <p className="text-xs text-slate-600 text-center">
              Supports JPEG, PNG, WEBP, HEIC, PDF · Max 10 MB
            </p>
          </div>
        )}

        {/* ── Step: scanning ── */}
        {step === 'scanning' && (
          <div className="p-8 flex flex-col items-center gap-4">
            {preview && (
              <img src={preview} alt="Receipt" className="max-h-40 rounded-xl object-contain mb-2"
                style={{ border: '1px solid var(--border-medium)' }} />
            )}
            {!preview && fileName && (
              <div className="px-4 py-3 rounded-xl text-xs text-slate-400"
                style={{ background: 'var(--bg-input)' }}>{fileName}</div>
            )}
            <Loader2 size={32} className="text-violet-400 animate-spin" />
            <p className="text-sm text-slate-300 font-medium">Reading your receipt…</p>
            <p className="text-xs text-slate-600">Using AI to extract merchant, amount, and date</p>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === 'error' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <AlertCircle size={36} className="text-rose-400" />
            <p className="text-sm text-rose-300 font-medium text-center">{errMsg}</p>
            <button onClick={() => setStep('pick')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-medium)' }}>
              <RotateCcw size={14} /> Try Again
            </button>
          </div>
        )}

        {/* ── Step: review ── */}
        {(step === 'review' || step === 'saving') && scanResult && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Confidence badge */}
            {scanResult.confidence && (() => {
              const c = CONFIDENCE_LABEL[scanResult.confidence]
              return (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}>
                  <CheckCircle size={13} />
                  {c.text} — review and confirm below
                </div>
              )
            })()}

            {/* Image thumbnail */}
            {preview && (
              <img src={preview} alt="Receipt" className="w-full max-h-36 rounded-xl object-contain"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
            )}

            {/* Items list if extracted */}
            {scanResult.items?.length > 0 && (
              <div className="rounded-xl p-3 space-y-1.5"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs text-slate-500 mb-2 font-medium">Detected items</p>
                {scanResult.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-400 truncate">{it.name}</span>
                    <span className="text-slate-300 ml-2 flex-shrink-0">₹{it.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {errMsg && (
              <div className="px-3 py-2 rounded-lg text-xs text-rose-400"
                style={{ background: 'rgba(244,63,94,0.1)' }}>{errMsg}</div>
            )}

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Date</label>
                <input required type="date" className={inputClass} style={inputStyle}
                  value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Amount (₹)</label>
                <input required type="number" min="0.01" step="0.01" className={inputClass} style={inputStyle}
                  placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Description</label>
              <input required className={inputClass} style={inputStyle}
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
              <select className={inputClass} style={inputStyle}
                value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Select category —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-modal)' }}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              {scanResult.suggested_category_name && !form.category_id && (
                <p className="text-xs text-violet-400 mt-1">
                  Suggested: {scanResult.suggested_category_name}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Payment Method</label>
              <select className={inputClass} style={inputStyle}
                value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                {['UPI', 'NET_BANKING', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH'].map(m => (
                  <option key={m} value={m} style={{ background: 'var(--bg-modal)' }}>{m.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
              <input className={inputClass} style={inputStyle}
                placeholder="Any extra notes…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep('pick')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                <RotateCcw size={13} /> Rescan
              </button>
              <button type="submit" disabled={step === 'saving'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
                {step === 'saving' ? 'Saving…' : 'Add Expense'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <div className="p-8 flex flex-col items-center gap-3">
            <CheckCircle size={40} className="text-emerald-400" />
            <p className="text-sm font-semibold text-slate-100">Expense added!</p>
          </div>
        )}
      </div>
    </div>
  )
}
