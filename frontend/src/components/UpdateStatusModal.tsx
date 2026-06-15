import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../hooks/useOrders'
import { useStore } from '../store'
import type { OrderRow } from '../services/supabase'

const STATUS_OPTIONS: { value: OrderRow['status']; label: string; color: string }[] = [
  { value: 'pending',     label: 'Pending',     color: '#94a3b8' },
  { value: 'in_progress', label: 'In Progress', color: '#76b900' },
  { value: 'completed',   label: 'Completed',   color: '#22c55e' },
  { value: 'blocked',     label: 'Blocked',     color: '#ef4444' },
]

interface Props {
  open:     boolean
  onClose:  () => void
}

export default function UpdateStatusModal({ open, onClose }: Props) {
  const { user } = useAuth()
  const { updateStatus } = useOrders()
  const schedule = useStore(s => s.schedule)

  const [orderId,  setOrderId]  = useState('')
  const [status,   setStatus]   = useState<OrderRow['status']>('in_progress')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const orderOptions = schedule.map(s => s.order)

  async function handleSave() {
    if (!orderId) { toast.error('Select an order'); return }
    if (!user)    { toast.error('Not authenticated'); return }

    setSaving(true)
    try {
      await updateStatus(orderId, status, notes, user.id)
      toast.success(`Order ${orderId} updated to ${status}`)
      setOrderId('')
      setNotes('')
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Update failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdrop}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95, y: 16  }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="panel w-full max-w-md p-6"
            style={{ background: '#111827', border: '1px solid rgba(118,185,0,0.2)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-200">Update Order Status</h2>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Order ID */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Order ID</label>
                {orderOptions.length > 0 ? (
                  <select
                    className="input"
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                  >
                    <option value="">Select order…</option>
                    {orderOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    placeholder="e.g. O-001"
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                  />
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-all"
                      style={{
                        background:  status === opt.value ? `${opt.color}22` : 'rgba(255,255,255,0.04)',
                        border:      `1px solid ${status === opt.value ? opt.color : 'rgba(255,255,255,0.08)'}`,
                        color:       status === opt.value ? opt.color : '#94a3b8',
                        fontWeight:  status === opt.value ? 600 : 400,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: opt.color }}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Notes <span className="text-slate-600">(optional)</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Add context for this status change…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !orderId}
                className="btn btn-primary flex-1"
              >
                {saving ? 'Saving…' : 'Save Status'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
