import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import { useStore } from '../store'
import { answerQuestion } from '../services/handoverService'

interface Message {
  id:   string
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTED = [
  'Why was ORD008 delayed?',
  'What is the status of MC003?',
  'Which orders are urgent?',
  'Which inventory items are low?',
  'Give me a factory overview',
  'What orders are blocked?',
]

function uid() { return Math.random().toString(36).slice(2) }

interface Props {
  shiftNotes?: string
}

export default function AIChat({ shiftNotes }: Props) {
  const machines  = useStore(s => s.machines)
  const inventory = useStore(s => s.inventory)
  const orders    = useStore(s => s.orders)
  const schedule  = useStore(s => s.schedule)
  const sessionId = useStore(s => s.sessionId)

  const [history, setHistory] = useState<Message[]>([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  function push(msg: Omit<Message, 'id'>) {
    setHistory(h => [...h, { ...msg, id: uid() }])
  }

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setLoading(true)
    setInput('')
    push({ role: 'user', text: msg })

    try {
      const context = { machines, inventory, orders, schedule, shiftNotes }
      const local   = answerQuestion(msg, context)

      if (local !== null) {
        // Data-driven answer — immediate, no network call
        push({ role: 'assistant', text: local })
      } else {
        // Fall back to NVIDIA NIM for open-ended questions
        try {
          const resp = await api.copilotChat(msg, schedule, sessionId)
          push({ role: 'assistant', text: resp.data.reply || resp.data.response })
        } catch {
          push({
            role: 'assistant',
            text:
              'I can answer questions about specific orders (e.g. "Why is ORD008 delayed?"), ' +
              'machines (e.g. "What is MC003\'s status?"), inventory levels, and priorities. ' +
              'The AI backend is currently unavailable for more complex questions.',
          })
        }
      }
    } catch (e: unknown) {
      push({ role: 'assistant', text: e instanceof Error ? e.message : 'Failed to get an answer.' })
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
    <div
      className="flex flex-col"
      style={{
        height: '100%',
        background: '#0d1117',
        border: '1px solid rgba(118,185,0,0.15)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(118,185,0,0.04)',
        flexShrink: 0,
      }}>
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-sm font-semibold text-slate-200">Ask AI</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(118,185,0,0.12)', color: '#76b900', fontSize: '10px', border: '1px solid rgba(118,185,0,0.2)' }}
          >
            Shift Context
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Ask about orders, machines, inventory, or shift priorities
        </p>
      </div>

      {/* Suggested questions — shown only when chat is empty */}
      {history.length === 0 && (
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}
        >
          <div className="text-xs text-slate-600 mb-2">Try asking:</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#94a3b8',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        style={{ minHeight: 0 }}
      >
        {history.length === 0 && (
          <div className="text-center text-slate-600 text-xs py-8">
            No messages yet — ask a question above.
          </div>
        )}

        <AnimatePresence initial={false}>
          {history.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {m.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'rgba(118,185,0,0.14)', border: '1px solid rgba(118,185,0,0.3)' }}
                >
                  🤖
                </div>
              )}
              <div
                className="rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                style={{
                  maxWidth: '85%',
                  background: m.role === 'user'
                    ? 'rgba(118,185,0,0.12)'
                    : 'rgba(255,255,255,0.05)',
                  color: m.role === 'user' ? '#d9f99d' : '#cbd5e1',
                  border: m.role === 'user'
                    ? '1px solid rgba(118,185,0,0.2)'
                    : '1px solid rgba(255,255,255,0.06)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius:  m.role === 'assistant' ? 4 : 12,
                }}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: 'rgba(118,185,0,0.14)', border: '1px solid rgba(118,185,0,0.3)' }}
              >
                🤖
              </div>
              <div
                className="flex gap-1 px-3 py-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderBottomLeftRadius: 4,
                }}
              >
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#76b900' }}
                    animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.0, delay: i * 0.18, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1 text-xs"
          placeholder="Ask about orders, machines, inventory…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0 }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
