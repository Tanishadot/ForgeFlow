import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import { useStore } from '../store'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

const QUICK = [
  'Why is that order blocked?',
  'Which machine is overloaded?',
  'What orders are due today?',
  'How can I recover production?',
]

export default function CopilotPanel() {
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
      setHistory(h => [...h, { role: 'assistant', text: resp.data.response }])
    } catch {
      // fallback: call /explain as a degraded response
      try {
        const fallback = await api.copilotChat(msg, schedule, sessionId)
        setHistory(h => [...h, { role: 'assistant', text: fallback.data.response }])
      } catch {
        setHistory(h => [...h, { role: 'assistant', text: 'Unable to reach AI service. Check backend.' }])
      }
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
    <div className="flex flex-col gap-2" style={{ minHeight: 0 }}>
      {/* Quick queries */}
      {history.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {QUICK.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              className="btn btn-ghost btn-sm text-xs"
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {history.length > 0 && (
        <div className="scroll-y space-y-2 text-xs" style={{ maxHeight: 180 }}>
          {history.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className="inline-block rounded px-3 py-2 max-w-[90%] text-left leading-relaxed"
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
            <div className="text-left">
              <div className="inline-block rounded px-3 py-2 text-slate-400" style={{ background: 'rgba(255,255,255,0.03)' }}>
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="input text-xs flex-1"
          placeholder="Ask anything about the schedule…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn btn-primary btn-sm">
          Ask
        </button>
      </div>
    </div>
  )
}
