import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { useAuth } from '../context/AuthContext'
import { generateAndStoreShiftSummary } from '../services/shiftContext'
import toast from 'react-hot-toast'

export default function ShiftSummaryBanner() {
  const shiftContext  = useStore(s => s.shiftContext)
  const loadShiftContext = useStore(s => s.loadShiftContext)
  const { companyId, role } = useAuth()

  const [dismissed,   setDismissed]   = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [expanded,    setExpanded]    = useState(false)

  if (!shiftContext || dismissed) return null

  const summary = shiftContext.summary
  const isLong  = summary.length > 180

  async function handleGenerate() {
    if (!companyId) return
    setGenerating(true)
    try {
      await generateAndStoreShiftSummary(companyId)
      await loadShiftContext(companyId)
      toast.success('Shift summary regenerated')
    } catch (e) {
      toast.error('Failed to generate summary')
    } finally {
      setGenerating(false)
    }
  }

  const ago = (() => {
    if (!shiftContext.generated_at) return ''
    const diff = Date.now() - new Date(shiftContext.generated_at).getTime()
    const mins = Math.round(diff / 60000)
    if (mins < 2)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.round(mins / 60)}h ago`
  })()

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="rounded-lg overflow-hidden"
        style={{ background: 'rgba(118,185,0,0.06)', border: '1px solid rgba(118,185,0,0.2)' }}
      >
        <div className="p-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <span className="text-xs font-semibold" style={{ color: '#76b900' }}>
                Previous Shift Summary
              </span>
              {ago && (
                <span className="text-xs text-slate-600">· {ago}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Regenerate (manager/admin only) */}
              {(role === 'manager' || role === 'admin') && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  title="Regenerate summary from latest shift logs"
                >
                  {generating ? '⟳ Generating…' : '⟳ Refresh'}
                </button>
              )}

              {/* Expand/collapse */}
              {isLong && (
                <button
                  onClick={() => setExpanded(x => !x)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {/* Dismiss */}
              <button
                onClick={() => setDismissed(true)}
                className="text-slate-600 hover:text-slate-400 transition-colors text-sm leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Summary text */}
          <div className="mt-2">
            <p
              className="text-xs text-slate-300 leading-relaxed whitespace-pre-line"
              style={{
                display:            '-webkit-box',
                WebkitBoxOrient:    'vertical',
                WebkitLineClamp:    expanded || !isLong ? undefined : 3,
                overflow:           expanded || !isLong ? 'visible' : 'hidden',
              } as React.CSSProperties}
            >
              {summary}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
