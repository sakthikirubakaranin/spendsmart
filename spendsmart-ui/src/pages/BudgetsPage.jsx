import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { budgetsApi } from '../api/budgets'
import { analyticsApi } from '../api/analytics'
import { categoriesApi } from '../api/expenses'
import { formatINR } from '../utils/currency'
import { Save, Copy } from 'lucide-react'

function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function prevMonth(d) {
  const p = new Date(d)
  p.setMonth(p.getMonth() - 1)
  return p
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function barColor(pct) {
  if (pct >= 100) return 'from-accent-rose to-pink-700'
  if (pct >= 80) return 'from-accent-amber to-orange-600'
  return 'from-accent-green to-emerald-600'
}

export default function BudgetsPage() {
  const today = new Date()
  const [month] = useState(today)
  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState({})      // category_id -> { amount, rollover }
  const [spendMap, setSpendMap] = useState({})    // category_id -> spent
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    const monthStr = toMonthStr(month)
    Promise.all([
      categoriesApi.list(),
      budgetsApi.get(monthStr),
      analyticsApi.budgetStatus(monthStr),
    ]).then(([cats, budgetRows, statusRows]) => {
      setCategories(cats)
      // Build initial budget map
      const bm = {}
      budgetRows.forEach(b => { bm[b.category_id] = { amount: b.amount, rollover: b.rollover } })
      setBudgets(bm)
      // Build spend map from budget-status
      const sm = {}
      statusRows.forEach(s => { sm[s.category_id] = s.spent })
      setSpendMap(sm)
    }).finally(() => setLoading(false))
  }, [])

  function setAmount(catId, val) {
    setBudgets(prev => ({ ...prev, [catId]: { ...prev[catId], amount: val, rollover: prev[catId]?.rollover ?? false } }))
  }

  function toggleRollover(catId) {
    setBudgets(prev => ({ ...prev, [catId]: { ...prev[catId], rollover: !(prev[catId]?.rollover) } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = categories
        .filter(c => budgets[c.id]?.amount > 0)
        .map(c => ({ category_id: c.id, amount: parseFloat(budgets[c.id]?.amount || 0), rollover: budgets[c.id]?.rollover ?? false }))
      await budgetsApi.upsert(toMonthStr(month), payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyFromPrev() {
    setCopying(true)
    try {
      const fromStr = toMonthStr(prevMonth(month))
      const toStr = toMonthStr(month)
      const rows = await budgetsApi.copy(fromStr, toStr)
      const bm = {}
      rows.forEach(b => { bm[b.category_id] = { amount: b.amount, rollover: b.rollover } })
      setBudgets(bm)
    } finally {
      setCopying(false)
    }
  }

  return (
    <Layout title="Budgets">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-semibold">{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</h2>
          <p className="text-white/40 text-sm">Set monthly spending limits per category</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopyFromPrev} disabled={copying} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 text-sm transition-all disabled:opacity-40">
            <Copy size={14} /> {copying ? 'Copying…' : 'Copy from last month'}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save budgets'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const budget = parseFloat(budgets[cat.id]?.amount || 0)
            const spent = spendMap[cat.id] || 0
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
            const rollover = budgets[cat.id]?.rollover ?? false

            return (
              <div key={cat.id} className="glass rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium text-sm">{cat.name}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-white/40 text-xs cursor-pointer">
                          <input type="checkbox" checked={rollover} onChange={() => toggleRollover(cat.id)} className="accent-violet-500" />
                          Rollover
                        </label>
                        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                          <span className="text-white/40 text-sm">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={budgets[cat.id]?.amount ?? ''}
                            onChange={e => setAmount(cat.id, e.target.value)}
                            placeholder="0"
                            className="w-24 bg-transparent text-white text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    {budget > 0 && (
                      <>
                        <div className="h-1.5 bg-white/5 rounded-full mb-1">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${barColor(pct)} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-white/40">
                          <span>{formatINR(spent)} spent</span>
                          <span className={pct >= 80 ? 'text-accent-rose' : 'text-white/40'}>{Math.round(pct)}%</span>
                          <span>{formatINR(Math.max(budget - spent, 0))} left</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
