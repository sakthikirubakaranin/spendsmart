import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../api/auth'

const steps = ['Account', 'Income', 'First Expense']

function PasswordStrength({ password }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'One number', ok: /[0-9]/.test(password) },
  ]
  return (
    <div className="mt-2 space-y-1">
      {checks.map(c => (
        <div key={c.label} className={`flex items-center gap-2 text-xs transition-colors ${c.ok ? 'text-emerald-400' : 'text-slate-600'}`}>
          <Check size={11} className={c.ok ? 'text-emerald-400' : 'text-slate-700'} />
          {c.label}
        </div>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    income: '', budgetFood: '', budgetGrocery: '', budgetTransport: '',
  })

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
  const inputFocus = e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'
  const inputBlur = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'

  const handleNext = async (e) => {
    e.preventDefault()
    setError('')

    // Steps 0 and 1 — just advance
    if (step < steps.length - 1) {
      setStep(s => s + 1)
      return
    }

    // Step 2 — final submit: register then auto-login
    setLoading(true)
    try {
      await authApi.register({ full_name: form.name, email: form.email, password: form.password })
      await login(form.email, form.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Registration failed. Please try again.')
      setStep(0) // send back to account step if register fails
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center dot-grid px-4 py-12" style={{ background: '#07070f' }}>
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">SpendSmart</span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all flex-shrink-0
                ${i <= step ? 'text-white' : 'text-slate-600'}`}
                style={{ background: i <= step ? 'linear-gradient(135deg,#8b5cf6,#06b6d4)' : 'rgba(255,255,255,0.06)' }}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span className={`ml-2 text-xs font-medium ${i === step ? 'text-slate-200' : 'text-slate-600'}`}>{s}</span>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px mx-3" style={{ background: i < step ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-7">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-accent-rose/10 border border-accent-rose/30 text-accent-rose text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleNext} className="space-y-4">

            {/* Step 0: Account */}
            {step === 0 && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-slate-100 mb-1">Create your account</h2>
                  <p className="text-sm text-slate-500 mb-5">Free forever. No credit card needed.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Full Name</label>
                  <input required className={inputClass} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                    placeholder="Sakthi Kumar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Email</label>
                  <input required type="email" className={inputClass} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                    placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Password</label>
                  <div className="relative">
                    <input required type={showPass ? 'text' : 'password'} className={`${inputClass} pr-11`} style={inputStyle}
                      onFocus={inputFocus} onBlur={inputBlur} placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {form.password && <PasswordStrength password={form.password} />}
                </div>
              </>
            )}

            {/* Step 1: Monthly Income */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-slate-100 mb-1">Set your monthly income</h2>
                  <p className="text-sm text-slate-500 mb-5">We'll use this to calculate your savings rate. You can skip this.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Monthly Take-Home Income</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                    <input type="number" className={`${inputClass} pl-8`} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                      placeholder="85,000" value={form.income} onChange={e => setForm({ ...form, income: e.target.value })} />
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick budget setup (optional)</p>
                  {[
                    { key: 'budgetFood', label: '🍽️ Food & Dining', placeholder: '10,000' },
                    { key: 'budgetGrocery', label: '🛒 Grocery', placeholder: '6,000' },
                    { key: 'budgetTransport', label: '🚌 Transport', placeholder: '5,000' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="flex items-center gap-3 mb-3">
                      <span className="text-sm text-slate-300 w-36 flex-shrink-0">{label}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                        <input type="number" className={`${inputClass} pl-7 py-2`} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
                          placeholder={placeholder} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: First Expense (optional, just UI — skipped in API call) */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-slate-100 mb-1">Almost done!</h2>
                  <p className="text-sm text-slate-500 mb-5">Click "Let's go!" to enter the app. You can add expenses from the dashboard.</p>
                </div>
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(6,182,212,0.2))', border: '1px solid rgba(139,92,246,0.3)' }}>
                    🎉
                  </div>
                  <p className="text-white/60 text-sm text-center">Your account is ready. Start tracking your expenses to get personalised insights.</p>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-2">
              {step > 0 && (
                <button type="button" onClick={() => setStep(s => s - 1)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Back
                </button>
              )}
              {step < steps.length - 1 && (
                <button type="button" onClick={() => setStep(s => s + 1)}
                  className="py-3 px-5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors">
                  Skip
                </button>
              )}
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : step === steps.length - 1
                    ? <>Let's go! <ArrowRight size={15} /></>
                    : <>Next <ArrowRight size={15} /></>}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
