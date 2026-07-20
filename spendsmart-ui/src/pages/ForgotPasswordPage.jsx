import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Mail, ArrowLeft, Loader2 } from 'lucide-react'
import { authApi } from '../api/auth'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      // Backend always returns 200 to prevent email enumeration,
      // so errors here are network/server issues.
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          {!sent ? (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-white mb-1">Forgot password?</h2>
                <p className="text-white/40 text-sm">
                  Enter your email and we'll send you a 6-digit OTP to reset your password.
                </p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm"
                  style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/60 text-sm mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-purple/60 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Sending OTP…</>
                    : <><Mail size={16} /> Send OTP</>}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl"
                style={{ background: 'rgba(16,185,129,0.15)' }}>
                ✉️
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Check your inbox</h3>
              <p className="text-sm text-white/50 mb-6">
                If an account exists for <strong className="text-white/70">{email}</strong>,
                a 6-digit OTP has been sent. It expires in 10 minutes.
              </p>
              <button
                onClick={() => navigate('/reset-password', { state: { email } })}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold hover:opacity-90 transition-all"
              >
                Enter OTP →
              </button>
              <button
                onClick={() => setSent(false)}
                className="mt-3 text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center">
            <Link to="/login"
              className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft size={14} /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
