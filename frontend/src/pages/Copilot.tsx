import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import { useStore } from '../store'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTED = [
  'Why is order O-003 blocked?',
  'Which machine has the highest load?',
  'What orders are at risk of missing their deadline?',
  'How can I recover if M-3 is down?',
  'Which orders can be rerouted?',
  'What is causing the most delays today?',
]

export default function Copilot() {
  const schedule  = useStore(s => s.schedule)
  const sessionId = useStore(s => s.sessionId)
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setLoading(true)
    setInput('')
    setHistory(h => [...h, { role: 'user', text: msg }])
    try {
      const resp = await api.copilotChat(msg, schedule, sessionId)
      setHistory(h => [...h, { role: 'assistant', text: resp.data.reply || resp.data.response }])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reach AI service.'
      setHistory(h => [...h, { role: 'assistant', text: `Error: ${message}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="panel p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Factory Copilot</h2>
          <span className="badge" style={{ background: 'rgba(118,185,0,0.15)', color: '#a3e635' }}>
            NVIDIA NIM
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Ask questions about the production schedule. Answers are grounded in real schedule data.
        </p>
      </div>

      {/* Suggested questions */}
      {history.length === 0 && (
        <div className="panel p-4">
          <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Suggested questions</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map(q => (
              <button key={q} onClick={() => send(q)} disabled={loading} className="btn btn-ghost btn-sm text-xs">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat history */}
      <div className="panel p-4 scroll-y" style={{ minHeight: 200, maxHeight: 420 }}>
        {history.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            No messages yet. Ask a question above or type below.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="rounded px-4 py-2 max-w-[85%] text-sm leading-relaxed"
                  style={{
                    background: m.role === 'user'
                      ? 'rgba(118,185,0,0.12)'
                      : 'rgba(255,255,255,0.05)',
                    color: m.role === 'user' ? '#d9f99d' : '#cbd5e1',
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded px-4 py-2 text-slate-400 text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="panel p-4 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask about orders, machines, inventory…  (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          autoFocus
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn btn-primary">
          Send
        </button>
      </div>

      {schedule.length === 0 && (
        <div className="alert-strip alert-strip-warning text-xs">
          ⚠ No schedule loaded. Go to Dashboard → Load Sample Data → Generate Schedule first.
        </div>
      )}
    </div>
  )
}
