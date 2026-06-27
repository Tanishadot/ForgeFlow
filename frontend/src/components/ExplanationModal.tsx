import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open:            boolean
  onClose:         () => void
  summaries:       string[]
  recommendations: string[]
  provider:        string | null
  loading:         boolean
}

export default function ExplanationModal({ open, onClose, summaries, recommendations, provider, loading }: Props) {
  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="panel flex flex-col gap-4"
            style={{ width: '100%', maxWidth: 720, maxHeight: '85vh', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ background: 'rgba(118,185,0,0.12)', border: '1px solid rgba(118,185,0,0.25)' }}
                >
                  ✨
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Schedule Analysis</h2>
                  <p className="text-xs text-slate-500">
                    {provider === 'nim'
                      ? 'Powered by NVIDIA NIM · meta/llama-3.1-8b-instruct'
                      : 'Generated from schedule data'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm text-slate-400">✕</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-nvidia-400 border-t-transparent animate-spin"
                  />
                  <p className="text-sm text-slate-400">Analyzing schedule with NVIDIA NIM…</p>
                </div>
              )}

              {!loading && summaries.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No explanation available.</p>
              )}

              {/* Per-order summaries */}
              {!loading && summaries.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Order-by-Order Analysis
                  </h3>
                  {summaries.map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex gap-3 rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span
                        className="text-xs font-mono font-bold flex-shrink-0 mt-0.5"
                        style={{ color: '#76b900', minWidth: 24 }}
                      >
                        #{i + 1}
                      </span>
                      <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {!loading && recommendations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Recommendations
                  </h3>
                  {recommendations.map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: summaries.length * 0.04 + i * 0.06 }}
                      className="flex gap-3 rounded-lg p-3"
                      style={{ background: 'rgba(118,185,0,0.06)', border: '1px solid rgba(118,185,0,0.15)' }}
                    >
                      <span className="text-sm flex-shrink-0 mt-0.5">→</span>
                      <p className="text-sm text-slate-200 leading-relaxed">{text}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loading && (summaries.length > 0 || recommendations.length > 0) && (
              <div
                className="flex items-center justify-between flex-shrink-0 pt-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs text-slate-500">
                  {summaries.length} order(s) · {recommendations.length} recommendation(s)
                </span>
                <button onClick={onClose} className="btn btn-primary btn-sm">Close</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
