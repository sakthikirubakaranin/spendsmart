/**
 * AIChatWidget — floating chat panel for NLP expense queries.
 *
 * - Renders a sparkle button in the bottom-right corner on all auth'd pages
 * - Click opens a slide-up chat panel
 * - Conversation is kept in component state (resets on close)
 * - Each answer shows which model was used
 */

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2, Bot, ChevronDown } from 'lucide-react'
import { aiApi } from '../api/ai'

const SUGGESTED = [
  'How much did I spend last month?',
  'What is my biggest expense category?',
  'How does this month compare to last month?',
  'Show me all transactions above ₹5,000',
  'What did I spend on food this year?',
]

const MONTHS_OPTIONS = [
  { value: 3,  label: 'Last 3 months' },
  { value: 6,  label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 24, label: 'Last 24 months' },
]

export default function AIChatWidget() {
  const [open, setOpen]       = useState(false)
  const [input, setInput]     = useState('')
  const [months, setMonths]   = useState(6)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])   // [{role:'user'|'ai', text, model?}]
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  async function send(question) {
    const q = (question || input).trim()
    if (!q || loading) return

    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)

    try {
      const { answer, model_used } = await aiApi.query(q, months)
      setMessages(m => [...m, { role: 'ai', text: answer, model: model_used }])
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Something went wrong. Please try again.'
      setMessages(m => [...m, { role: 'ai', text: `⚠️ ${detail}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Ask AI about your expenses"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          background: open
            ? 'rgba(139,92,246,0.9)'
            : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
          boxShadow: '0 8px 32px rgba(139,92,246,0.4)',
        }}
      >
        {open
          ? <X size={22} className="text-white" />
          : <Sparkles size={22} className="text-white" />}
      </button>

      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-40 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: '380px',
            height: '520px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(139,92,246,0.25)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.1))',
              borderBottom: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
            >
              <Bot size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200">AI Assistant</p>
              <p className="text-xs text-slate-500">Ask anything about your expenses</p>
            </div>

            {/* Months selector */}
            <div className="relative flex-shrink-0">
              <select
                value={months}
                onChange={e => setMonths(Number(e.target.value))}
                className="appearance-none text-xs pr-5 pl-2 py-1 rounded-lg outline-none cursor-pointer"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  color: '#a78bfa',
                }}
              >
                {MONTHS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.1))' }}
                >
                  <Sparkles size={22} className="text-violet-400" />
                </div>
                <p className="text-sm font-medium text-slate-300 mb-1">Ask about your spending</p>
                <p className="text-xs text-slate-500 mb-4">
                  I can answer questions about your expense patterns, totals, trends and more.
                </p>

                {/* Suggestion chips */}
                <div className="flex flex-col gap-1.5 w-full">
                  {SUGGESTED.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-xl transition-all hover:text-violet-300"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2.5 rounded-2xl text-sm"
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(6,182,212,0.2))',
                          border: '1px solid rgba(139,92,246,0.3)',
                          color: '#e2e8f0',
                          borderBottomRightRadius: '4px',
                        }
                      : {
                          background: msg.error
                            ? 'rgba(244,63,94,0.08)'
                            : 'var(--bg-surface)',
                          border: `1px solid ${msg.error ? 'rgba(244,63,94,0.2)' : 'var(--border-subtle)'}`,
                          color: msg.error ? '#fb7185' : 'var(--text-primary)',
                          borderBottomLeftRadius: '4px',
                        }
                  }
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.model && (
                    <p className="text-xs mt-1.5 opacity-40">{msg.model}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                  <span className="text-xs text-slate-500">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="flex-shrink-0 px-3 py-3"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
          >
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors mb-2 ml-1"
              >
                Clear conversation
              </button>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your expenses…"
                rows={1}
                className="flex-1 resize-none px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  maxHeight: '80px',
                  lineHeight: '1.4',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
              >
                <Send size={15} className="text-white" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </>
  )
}
