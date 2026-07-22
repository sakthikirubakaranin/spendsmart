import { useState } from 'react'
import Layout from '../components/layout/Layout'
import { Download, FileText, Table, FileSpreadsheet, Mail, CheckCircle } from 'lucide-react'

const MONTHS = ['July 2026','June 2026','May 2026','April 2026','March 2026','February 2026']

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState('2026-07-01')
  const [toDate, setToDate] = useState('2026-07-31')
  const [selectedMonth, setSelectedMonth] = useState('July 2026')
  const [downloading, setDownloading] = useState(null)
  const [done, setDone] = useState(null)

  const handleDownload = async (type) => {
    setDownloading(type)
    await new Promise(r => setTimeout(r, 1500))
    setDownloading(null)
    setDone(type)
    setTimeout(() => setDone(null), 3000)
  }

  const inputClass = "px-3 py-2 rounded-xl text-sm text-slate-200 outline-none transition-all"
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

  const ExportCard = ({ type, icon: Icon, title, desc, color, ext }) => (
    <div className="glass rounded-2xl p-5 flex items-center justify-between gap-4 relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 blur-2xl pointer-events-none" style={{ background: color }} />
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <button onClick={() => handleDownload(type)} disabled={downloading === type}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 flex-shrink-0"
        style={{ background: done === type ? 'rgba(16,185,129,0.3)' : `linear-gradient(135deg, ${color}, ${color}99)` }}>
        {done === type ? <><CheckCircle size={14} /> Downloaded!</>
          : downloading === type ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Preparing...</>
          : <><Download size={14} /> Download {ext}</>}
      </button>
    </div>
  )

  return (
    <Layout title="Reports">
      <div className="space-y-6 max-w-3xl">

        {/* Date range picker */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Select Date Range</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedMonth === m ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  style={selectedMonth === m ? { background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)' } : { background: 'rgba(255,255,255,0.04)' }}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className={inputClass} style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
              <span className="text-slate-600 text-sm">to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className={inputClass} style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            </div>
          </div>
        </div>

        {/* Export options */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Export Formats</h3>
          <ExportCard type="csv" icon={Table}           title="CSV Spreadsheet"    ext=".csv"  color="#10b981"
            desc="All transactions with date, description, amount, category, payment method, notes" />
          <ExportCard type="pdf" icon={FileText}         title="PDF Report"        ext=".pdf"  color="#8b5cf6"
            desc="Professional report with summary cards, charts, category breakdown, and saving tips" />
          <ExportCard type="xlsx" icon={FileSpreadsheet} title="Excel with Pivot"  ext=".xlsx" color="#06b6d4"
            desc="Excel workbook with raw data sheet + pivot table by category + charts" />
        </div>

        {/* Email report */}
        <div className="glass rounded-2xl p-5" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Email Report</h3>
          <div className="flex items-center gap-3">
            <input type="email" defaultValue="sakthi@example.com" placeholder="your@email.com"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm text-slate-200 outline-none"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            <button onClick={() => handleDownload('email')} disabled={downloading === 'email'}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 flex-shrink-0"
              style={{ background: done === 'email' ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
              {done === 'email' ? <><CheckCircle size={14} /> Sent!</>
                : downloading === 'email' ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                : <><Mail size={14} /> Send PDF</>}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2">PDF report for the selected date range will be emailed to you</p>
        </div>

        {/* Past reports */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Past Reports</h3>
          <div className="space-y-2">
            {['June 2026', 'May 2026', 'April 2026'].map(month => (
              <div key={month} className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <div className="flex items-center gap-3">
                  <FileText size={15} className="text-violet-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">SpendSmart_Report_{month.replace(' ', '_')}.pdf</p>
                    <p className="text-xs text-slate-500">Generated on the 1st of the following month</p>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-400 transition-colors font-medium">
                  <Download size={13} /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
