import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { authApi } from '../api/auth'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefillEmail = location.state?.email || ''

  const [form, setForm] = useState({
    email: prefillEmail,
    otp: '',
    new_password: '',
    confirm: '',
  })
  const [showPw, setShowPw] = useState({ new: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.new_password !== form.confirm) {
      setError('Passwords do not match'); return
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters'); return
    }

    setLoading(true)
    try {
      await authApi.resetPassword({
        email: form.email,
        otp: form.otp,
        new_password: form.new_password,
      })
      setDone(true)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Invalid or expired OTP. Please request a new one.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-purple/60 transition-all"

  return (
    <div className="min-h-screen bg-void dot-grid flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">SpendSmart</span>
        </div>

        <div className="glass rounded-2xl p-8">
          {!done ? (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-white mb-1">Reset password</h2>
                <p className="text-white/40 text-sm">
                  Enter the OTP from your email and choose a new password.
                </p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm"
                  style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email (pre-filled) */}
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>

                {/* OTP */}
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">6-Digit OTP</label>
                  <input
                    type="text"
                    required
                    value={form.otp}
                    onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="123456"
                    maxLength={6}
                    className={`${inputClass} text-center text-xl font-mono tracking-[0.4em]`}
                  />
                </div>

                {/* New password */}
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw.new ? 'text' : 'password'}
                      required
                      value={form.new_password}
                      onChange={set('new_password')}
                      placeholder="Min 8 characters"
                      className={`${inputClass} pr-11`}
                    />
                    <button type="button"
                      onClick={() => setShowPw(s => ({ ...s, new: !s.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPw.new ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showPw.confirm ? 'text' : 'password'}
                      required
                      value={form.confirm}
                      onChange={set('confirm')}
                      placeholder="Repeat new password"
                      className={`${inputClass} pr-11`}
                    />
                    <button type="button"
                      onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPw.confirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !form.email || form.otp.length < 6 || !form.new_password || !form.confirm}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Resetting…</>
                    : 'Reset Password'}
                </button>
              </form>

              <p className="text-center text-white/40 text-xs mt-4">
                Didn't receive the OTP?{' '}
                <Link to="/forgot-password" className="text-accent-purple hover:text-accent-purple/80 transition-colors">
                  Request a new one
                </Link>
              </p>
            </>
          ) : (
            /* Success */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.15)' }}>
                <CheckCircle size={28} style={{ color: '#34d399' }} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Password reset!</h3>
              <p className="text-sm text-white/50 mb-6">
                Your password has been updated. You can now log in with your new password.
              </p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold hover:opacity-90 transition-all"
              >
                Go to Login
              </button>
            </div>
          )}

          {!done && (
            <div className="mt-6 flex items-center justify-center">
              <Link to="/login"
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
