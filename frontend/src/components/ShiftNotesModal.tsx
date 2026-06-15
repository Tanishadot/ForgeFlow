import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { supabase } from '../services/supabase'
import type { ShiftLogInsert } from '../types'

const SHIFTS = ['Shift 1 (09:00–17:00)', 'Shift 2 (17:00–01:00)', 'Shift 3 (01:00–09:00)']

interface Props {
  open:    boolean
  onClose: () => void
}

export default function ShiftNotesModal({ open, onClose }: Props) {
  const { user, companyId, employeeId } = useAuth()
  const schedule  = useStore(s => s.schedule)
  const machines  = useStore(s => s.machines)
  const { submitShiftLog } = useStore()

  const [machineCode, setMachineCode] = useState('')
  const [orderCode,   setOrderCode]   = useState('')
  const [shift,       setShift]       = useState(SHIFTS[0])
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)

  const orderOptions   = schedule.map(s => s.order)
  const machineOptions = machines.map(m => m.machine_id)

  async function handleSubmit() {
    if (!notes.trim()) { toast.error('Notes are required'); return }
    if (!companyId)    { toast.error('Not associated with a company'); return }

    setSaving(true)
    try {
      // Resolve machine uuid from machine_code
      let machineId: string | null = null
      if (machineCode) {
        const { data } = await supabase
          .from('machines')
          .select('id')
          .eq('company_id', companyId)
          .eq('machine_code', machineCode)
          .single()
        machineId = data?.id ?? null
      }

      // Resolve order uuid from order_code
      let orderId: string | null = null
      if (orderCode) {
        const { data } = await supabase
          .from('orders')
          .select('id')
          .eq('company_id', companyId)
          .eq('order_code', orderCode)
          .single()
        orderId = data?.id ?? null
      }

      // Resolve employee uuid from employee_id
      let empDbId: string | null = null
      if (employeeId) {
        const { data } = await supabase
          .from('employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('employee_id', employeeId)
          .single()
        empDbId = data?.id ?? null
      }

      const log: ShiftLogInsert = {
        company_id:  companyId,
        employee_id: empDbId,
        machine_id:  machineId,
        order_id:    orderId,
        shift:       shift.split(' ')[0] + ' ' + shift.split(' ')[1],
        notes:       notes.trim(),
      }

      await submitShiftLog(log)
      toast.success('Shift notes submitted!')
      setNotes('')
      setMachineCode('')
      setOrderCode('')
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit notes')
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
              <div>
                <h2 className="text-base font-semibold text-slate-200">Submit Shift Notes</h2>
                <p className="text-xs text-slate-500 mt-0.5">Log handover notes for the next shift</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Shift selector */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {SHIFTS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShift(s)}
                      className="text-xs px-2 py-2 rounded transition-all text-center"
                      style={{
                        background: shift === s ? 'rgba(118,185,0,0.15)' : 'rgba(255,255,255,0.04)',
                        border:     `1px solid ${shift === s ? 'rgba(118,185,0,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color:      shift === s ? '#76b900' : '#94a3b8',
                        fontWeight: shift === s ? 600 : 400,
                      }}
                    >
                      {s.split(' ')[0]} {s.split(' ')[1]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Machine */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Machine <span className="text-slate-600">(optional)</span>
                </label>
                <select
                  className="input"
                  value={machineCode}
                  onChange={e => setMachineCode(e.target.value)}
                >
                  <option value="">All machines / not specific</option>
                  {machineOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Order */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Order <span className="text-slate-600">(optional)</span>
                </label>
                {orderOptions.length > 0 ? (
                  <select
                    className="input"
                    value={orderCode}
                    onChange={e => setOrderCode(e.target.value)}
                  >
                    <option value="">Not order-specific</option>
                    {orderOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    placeholder="e.g. O-001"
                    value={orderCode}
                    onChange={e => setOrderCode(e.target.value)}
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Notes *</label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  placeholder="Describe any issues, observations, or handover information for the next shift…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-600 mt-1">{notes.length}/500 characters</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !notes.trim()}
                className="btn btn-primary flex-1"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: '#030712', borderTopColor: 'transparent' }} />
                    Submitting…
                  </span>
                ) : '📝 Submit Notes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
