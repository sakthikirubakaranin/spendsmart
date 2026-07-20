import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, Shield, TrendingUp, Brain } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { signInWithGoogle } from '../lib/firebase'

const features = [
  { icon: TrendingUp, label: 'Real-time analytics' },
  { icon: Brain, label: 'AI-powered categorisation' },
  { icon: Shield, label: 'Bank-grade security' },
  { icon: Zap, label: 'Instant bank import' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, socialLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    try {
      const idToken = await signInWithGoogle()
      await socialLogin(idToken)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Google sign-in failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-void dot-grid flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[480px] shrink-0">
        <div className="relative">
          <div className="absolute -top-24 -left-16 w-64 h-64 bg-accent-purple/20 rounded-full blur-3xl" />
          <div className="absolute top-32 -right-8 w-48 h-48 bg-accent-cyan/15 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SpendSmart</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Track smarter,<br />spend better.
          </h1>
          <p className="text-white/50 mb-10">
            AI-powered expense tracking built for India — with bank statement import, auto-categorisation, and smart insights.
          </p>
          <div className="space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Icon size={15} className="text-accent-purple" />
                </div>
                <span className="text-white/70 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-white/40 text-sm">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-accent-rose/10 border border-accent-rose/30 text-accent-rose text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-purple/60 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-white/60 text-sm mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-white/20 focus:outline-none focus:border-accent-purple/60 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-white/50 cursor-pointer">
                <input type="checkbox" className="rounded accent-violet-500" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-accent-purple hover:text-accent-purple/80 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-medium text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13 17.8 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17z"/>
                <path fill="#FBBC05" d="M10.5 28.7A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.7-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.5-4.2-13.4-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <p className="text-center text-white/40 text-sm mt-5">
            No account?{' '}
            <Link to="/register" className="text-accent-purple hover:text-accent-purple/80 transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
