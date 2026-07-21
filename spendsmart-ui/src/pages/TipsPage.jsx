import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { analyticsApi } from '../api/analytics'
import { formatINR } from '../utils/currency'
import {
  Zap, TrendingUp, TrendingDown, Shield, RefreshCw,
  ThumbsUp, ThumbsDown, X, AlertTriangle, PiggyBank,
  BookOpen, Target, Landmark, BarChart2, Clock,
} from 'lucide-react'

// ── Data: static invest + best-practices content ─────────────────────────────

const INVEST_TIPS = [
  {
    icon: '📈', title: 'Start a SIP in Index Funds',
    desc: 'A ₹5,000/month SIP in a Nifty 50 index fund compounding at 12% p.a. grows to ~₹11.6 lakh in 10 years. Use Zerodha Coin or Groww — choose direct plans (no commission).',
    tag: 'Equity', color: '#10b981',
  },
  {
    icon: '🛡️', title: 'Build a 6-Month Emergency Fund First',
    desc: 'Before investing, park 6× monthly expenses in a liquid fund or high-yield savings (SBI Wecare, AU Small Finance). This prevents selling investments during emergencies.',
    tag: 'Safety Net', color: '#06b6d4',
  },
  {
    icon: '🏠', title: 'Maximise Section 80C (Save ₹46,800 tax/year)',
    desc: 'Contribute ₹1.5L/year to ELSS, EPF top-up, or PPF. ELSS has the shortest lock-in (3 years) with equity returns. PPF gives tax-free 7.1% guaranteed.',
    tag: 'Tax Saving', color: '#f59e0b',
  },
  {
    icon: '💊', title: 'Get Health Insurance Before You Need It',
    desc: 'A ₹10L family floater policy costs ~₹12,000–18,000/year. One hospitalisation without insurance can wipe out years of savings. Premium is deductible under 80D.',
    tag: 'Insurance', color: '#8b5cf6',
  },
  {
    icon: '🌍', title: 'Diversify: Equity + Debt + Gold',
    desc: 'Rule of thumb: 100 minus your age = equity %. At 30: 70% equity (index funds), 20% debt (PPF/FD), 10% gold (Sovereign Gold Bond — 2.5% interest + appreciation).',
    tag: 'Diversification', color: '#ec4899',
  },
  {
    icon: '📊', title: 'NPS for Retirement + Extra ₹15,600 Tax Saving',
    desc: 'NPS Tier 1 gives an additional ₹50,000 deduction under 80CCD(1B) beyond 80C. Equity NPS has historically returned 10–12% p.a. Start at any age — the earlier the better.',
    tag: 'Retirement', color: '#3b82f6',
  },
]

const BEST_PRACTICES = [
  {
    icon: '📋', title: 'The 50-30-20 Rule',
    desc: 'Allocate 50% of take-home income to needs (rent, groceries, EMIs), 30% to wants (dining, travel, entertainment), and 20% to savings/investments. Automate the 20% on salary day.',
    level: 'Foundation',
  },
  {
    icon: '⚡', title: 'Pay Yourself First',
    desc: 'Transfer your savings amount the moment your salary arrives — before paying any bill. Set up auto-debit on the 1st of each month. What remains is your spending budget.',
    level: 'Foundation',
  },
  {
    icon: '💳', title: 'Zero Credit Card Debt',
    desc: 'Credit card interest is 36–42% p.a. — the most expensive money you can borrow. Pay 100% of your statement every month. Use cards only for rewards, never for purchases you cannot afford now.',
    level: 'Foundation',
  },
  {
    icon: '📅', title: 'Monthly Financial Review (15 Minutes)',
    desc: 'On the last Sunday of every month: check your net worth, review this month\'s spend vs budget, adjust next month\'s budget. SpendSmart\'s dashboard makes this a 5-minute task.',
    level: 'Habit',
  },
  {
    icon: '🎯', title: 'Goal-Based Investing',
    desc: 'Label every investment with a goal and timeline: "House down payment 2028", "Car 2026", "Child education 2035". Different goals → different instruments (equity for long, debt for short).',
    level: 'Habit',
  },
  {
    icon: '🛒', title: 'The 24-Hour Rule for Non-Essentials',
    desc: 'Before any non-essential purchase above ₹500, wait 24 hours. 80% of impulse purchases lose their appeal overnight. Add to cart — don\'t buy for a day. Cancel if you forgot about it.',
    level: 'Habit',
  },
  {
    icon: '🔄', title: 'Automate Everything',
    desc: 'SIPs, PPF, insurance premiums, credit card payments — automate all of them. Manual transfers get skipped. Automating removes willpower from the equation.',
    level: 'Advanced',
  },
  {
    icon: '📈', title: 'Increase SIP by 10% Every Year',
    desc: 'Step-up SIPs aligned with salary hikes are the most powerful wealth multiplier. A ₹5,000/month SIP stepped up 10% yearly becomes ₹2.8 crore in 20 years vs ₹50L fixed.',
    level: 'Advanced',
  },
  {
    icon: '🏦', title: 'Keep 3 Bank Accounts',
    desc: 'Salary account (receives income, pays EMIs), Savings account (emergency fund, FDs), Investment account (linked to Demat, MF platforms). Separating prevents accidental overspending.',
    level: 'Advanced',
  },
]

const LEVEL_COLORS = { Foundation: '#10b981', Habit: '#8b5cf6', Advanced: '#f59e0b' }
const TYPE_META = {
  reduce:  { label: 'Reduce',  bg: 'rgba(244,63,94,0.12)',  text: '#fb7185' },
  alert:   { label: 'Alert',   bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  invest:  { label: 'Invest',  bg: 'rgba(16,185,129,0.12)', text: '#34d399' },
  save:    { label: 'Save',    bg: 'rgba(6,182,212,0.12)',  text: '#22d3ee' },
}

// ── Personalised tip card ─────────────────────────────────────────────────────
function TipCard({ tip, onDismiss }) {
  const [rated, setRated] = useState(null)
  const meta = TYPE_META[tip.type] || TYPE_META.save

  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden transition-all"
      style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'var(--bg-surface-hover)' }}>
          {tip.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
              style={{ background: meta.bg, color: meta.text }}>{meta.label}</span>
            <span className="text-xs text-white/40">{tip.category}</span>
            {tip.priority === 'high' && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle size={10} /> High priority
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white mb-1.5 leading-snug">{tip.headline}</h3>
          <p className="text-xs text-white/50 leading-relaxed">{tip.detail}</p>
        </div>
        {tip.potential_saving > 0 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-white/40 mb-0.5">Potential saving</p>
            <p className="text-lg font-extrabold text-emerald-400">{formatINR(tip.potential_saving)}</p>
            <p className="text-xs text-white/30">/month</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setRated(1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${rated === 1 ? 'text-emerald-400 bg-emerald-500/20' : 'text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10'}`}>
            <ThumbsUp size={11} /> Helpful
          </button>
          <button onClick={() => setRated(-1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${rated === -1 ? 'text-rose-400 bg-rose-500/20' : 'text-white/30 hover:text-rose-400 hover:bg-rose-500/10'}`}>
            <ThumbsDown size={11} /> Not helpful
          </button>
        </div>
        <button onClick={() => onDismiss(tip.id)}
          className="text-white/20 hover:text-white/50 transition-colors p-1">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TipsPage() {
  const [tab, setTab]           = useState('tips')
  const [tipsData, setTipsData] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [dismissed, setDismissed] = useState(new Set())

  async function load() {
    setLoading(true)
    try {
      const data = await analyticsApi.financialTips()
      setTipsData(data)
    } catch {
      setTipsData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeTips = (tipsData?.tips || []).filter(t => !dismissed.has(t.id))
  const totalSaving = activeTips.reduce((s, t) => s + (t.potential_saving || 0), 0)

  return (
    <Layout title="Tips & Best Practices">
      <div className="max-w-3xl space-y-5">

        {/* Tab bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
          style={{ background: 'var(--bg-button-ghost)', border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'tips',      label: 'Smart Tips',     icon: Zap },
            { id: 'invest',    label: 'Save & Grow',    icon: TrendingUp },
            { id: 'practices', label: 'Best Practices', icon: BookOpen },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === id
                ? { background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }
                : { color: 'var(--text-muted)' }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            TAB: SMART TIPS — personalised from real data
        ══════════════════════════════════════════════ */}
        {tab === 'tips' && (
          <>
            {/* Summary banner */}
            {tipsData && !loading && (
              <div className="glass rounded-2xl p-5 relative overflow-hidden"
                style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }} />
                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}>
                      <Zap size={22} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{activeTips.length} personalised tips based on your data</p>
                      {totalSaving > 0 && (
                        <p className="text-xs text-white/50 mt-0.5">
                          Act on all of them to save up to{' '}
                          <span className="text-emerald-400 font-semibold">{formatINR(totalSaving)}/month</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Snapshot cards */}
                    {tipsData.monthly_income > 0 && (
                      <div className="text-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                        <p className="text-xs text-white/40">Income</p>
                        <p className="text-sm font-bold text-emerald-400">{formatINR(tipsData.monthly_income)}</p>
                      </div>
                    )}
                    <div className="text-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-xs text-white/40">Spent</p>
                      <p className="text-sm font-bold text-rose-400">{formatINR(tipsData.monthly_expenses)}</p>
                    </div>
                    {tipsData.surplus > 0 && (
                      <div className="text-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                        <p className="text-xs text-white/40">Surplus</p>
                        <p className="text-sm font-bold text-cyan-400">{formatINR(tipsData.surplus)}</p>
                      </div>
                    )}
                    <button onClick={load} disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-white/5 rounded-2xl h-36" />
                ))}
              </div>
            ) : !tipsData || tipsData.tips.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-white/60 font-medium">Great job! No spending alerts this month.</p>
                <p className="text-white/30 text-sm mt-1">Import your bank statement to get personalised tips.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTips.map(tip => (
                  <TipCard key={tip.id} tip={tip} onDismiss={id => setDismissed(s => new Set([...s, id]))} />
                ))}
                {activeTips.length === 0 && (
                  <div className="glass rounded-2xl p-10 text-center text-white/30 text-sm">
                    All tips reviewed. Click Refresh for fresh analysis.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: SAVE & GROW — investment playbook
        ══════════════════════════════════════════════ */}
        {tab === 'invest' && (
          <>
            <div className="glass rounded-2xl p-5" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-3 mb-1">
                <PiggyBank size={20} className="text-emerald-400" />
                <h3 className="text-white font-semibold">Your Savings & Investment Playbook</h3>
              </div>
              <p className="text-white/40 text-xs">Actionable steps to build wealth — in order of priority</p>
            </div>

            <div className="space-y-3">
              {INVEST_TIPS.map((t, i) => (
                <div key={i} className="glass rounded-2xl p-5 flex gap-4"
                  style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${t.color}18` }}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-white">{t.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0"
                        style={{ background: `${t.color}18`, color: t.color }}>{t.tag}</span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">{t.desc}</p>
                  </div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 self-start mt-1"
                    style={{ background: 'var(--bg-input-hover)', color: 'var(--text-muted)' }}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick calc */}
            <div className="glass rounded-2xl p-5" style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={16} className="text-violet-400" />
                <h3 className="text-white font-semibold text-sm">Power of Compounding — Quick Reference</h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-2">SIP Amount</th>
                      <th className="text-right py-2">5 Years</th>
                      <th className="text-right py-2">10 Years</th>
                      <th className="text-right py-2">20 Years</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[2000, 5000, 10000, 20000].map(amt => {
                      const fv = (m, r, n) => m * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
                      const r = 0.01 // 12% p.a. monthly
                      return (
                        <tr key={amt} className="border-b border-white/5">
                          <td className="py-2 text-white/70 font-medium">₹{amt.toLocaleString('en-IN')}/mo</td>
                          <td className="py-2 text-right text-white/60">{formatINR(fv(amt, r, 60))}</td>
                          <td className="py-2 text-right text-emerald-400 font-semibold">{formatINR(fv(amt, r, 120))}</td>
                          <td className="py-2 text-right text-emerald-300 font-bold">{formatINR(fv(amt, r, 240))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-white/20 text-xs mt-2">Assumes 12% p.a. CAGR. Not guaranteed — for illustration only.</p>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: BEST PRACTICES — financial discipline
        ══════════════════════════════════════════════ */}
        {tab === 'practices' && (
          <>
            <div className="glass rounded-2xl p-5" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
              <div className="flex items-center gap-3 mb-1">
                <Target size={20} className="text-cyan-400" />
                <h3 className="text-white font-semibold">Financial Discipline Rules</h3>
              </div>
              <p className="text-white/40 text-xs">Timeless habits that separate the financially free from everyone else</p>
            </div>

            {['Foundation', 'Habit', 'Advanced'].map(level => (
              <div key={level}>
                <div className="flex items-center gap-2 mb-3 mt-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: LEVEL_COLORS[level] }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: LEVEL_COLORS[level] }}>
                    {level}
                  </span>
                  <div className="flex-1 h-px" style={{ background: `${LEVEL_COLORS[level]}20` }} />
                </div>
                <div className="space-y-3">
                  {BEST_PRACTICES.filter(p => p.level === level).map((p, i) => (
                    <div key={i} className="glass rounded-2xl p-4 flex gap-4"
                      style={{ border: '1px solid var(--border-subtle)' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: `${LEVEL_COLORS[level]}15` }}>
                        {p.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-1">{p.title}</h3>
                        <p className="text-xs text-white/50 leading-relaxed">{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Mindset footer */}
            <div className="glass rounded-2xl p-5 relative overflow-hidden"
              style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
              <div className="absolute inset-0 opacity-5 pointer-events-none"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #10b981)' }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark size={16} className="text-violet-400" />
                  <span className="text-white font-semibold text-sm">The Golden Rule</span>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  "Do not save what is left after spending, but spend what is left after saving."
                </p>
                <p className="text-white/30 text-xs mt-2">— Warren Buffett</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
