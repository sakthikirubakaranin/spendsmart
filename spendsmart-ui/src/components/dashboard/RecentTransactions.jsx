import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { formatINR } from '../../utils/currency'

const methodColors = {
  'UPI':         { bg: 'rgba(6,182,212,0.12)',   text: '#06b6d4' },
  'Credit Card': { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa' },
  'Debit Card':  { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  'Cash':        { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  'Net Banking': { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
}

export default function RecentTransactions({ data = [] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h3>
        <Link to="/expenses" className="text-xs text-violet-500 hover:opacity-70 transition-opacity font-medium">
          View all →
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--text-muted)' }}>
          No transactions yet
        </div>
      ) : (
        <div className="space-y-1">
          {data.map(tx => {
            const mc = methodColors[tx.payment_method] || methodColors['Net Banking']
            return (
              <div key={tx.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5 cursor-pointer">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)' }}>
                  {tx.category?.icon ?? '💸'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tx.date}</span>
                    {tx.payment_method && (
                      <>
                        <span className="w-0.5 h-0.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: mc.bg, color: mc.text }}>
                          {tx.payment_method}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 font-semibold text-sm flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                  <ArrowUpRight size={13} style={{ color: 'var(--text-muted)' }} />
                  {formatINR(tx.amount)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
