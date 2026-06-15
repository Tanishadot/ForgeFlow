import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { useAuth } from '../context/AuthContext'
import AIHandoverCard from '../components/AIHandoverCard'
import AIChat from '../components/AIChat'
import ShiftNotesModal from '../components/ShiftNotesModal'
import {
  generateCriticalIssues,
  generateInventoryAlerts,
  generatePriorityTasks,
  generateSuggestedActions,
} from '../services/handoverService'

const SHIFT_LABELS = ['Shift 1 (09:00–17:00)', 'Shift 2 (17:00–01:00)', 'Shift 3 (01:00–09:00)']

function shortLabel(s: string) {
  const parts = s.split(' ')
  return parts[0] + ' ' + parts[1]
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-4 flex items-center gap-3"
      style={{ border: value > 0 ? `1px solid ${color}30` : undefined }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold" style={{ color: value > 0 ? color : '#4b5563' }}>{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </motion.div>
  )
}

export default function Handover() {
  const navigate = useNavigate()
  const { role } = useAuth()

  const machines     = useStore(s => s.machines)
  const inventory    = useStore(s => s.inventory)
  const orders       = useStore(s => s.orders)
  const schedule     = useStore(s => s.schedule)
  const shiftContext = useStore(s => s.shiftContext)

  const [currentShift,    setCurrentShift]    = useState(SHIFT_LABELS[0])
  const [nextShift,       setNextShift]       = useState(SHIFT_LABELS[1])
  const [notesModalOpen,  setNotesModalOpen]  = useState(false)

  // Derive handover intelligence from live store data
  const issues  = useMemo(() => generateCriticalIssues(machines, orders, schedule),  [machines, orders, schedule])
  const alerts  = useMemo(() => generateInventoryAlerts(inventory),                  [inventory])
  const tasks   = useMemo(() => generatePriorityTasks(orders, schedule),             [orders, schedule])
  const actions = useMemo(() => generateSuggestedActions(issues, alerts, tasks),     [issues, alerts, tasks])

  const shiftNotes = shiftContext?.summary ?? undefined
  const noData     = machines.length === 0 && orders.length === 0 && inventory.length === 0

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4">

      {/* Page header */}
      <div className="panel p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
          >
            ← Dashboard
          </button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: 'rgba(118,185,0,0.12)', border: '1px solid rgba(118,185,0,0.25)' }}
          >
            🤖
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100">AI Shift Handover</h1>
            <p className="text-xs text-slate-500">Intelligent shift-to-shift handover assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Shift selectors */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">From:</span>
            <select
              className="input text-xs"
              style={{ padding: '5px 10px', width: 'auto' }}
              value={currentShift}
              onChange={e => setCurrentShift(e.target.value)}
            >
              {SHIFT_LABELS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-slate-600">→</span>
            <span className="text-slate-500">To:</span>
            <select
              className="input text-xs"
              style={{ padding: '5px 10px', width: 'auto' }}
              value={nextShift}
              onChange={e => setNextShift(e.target.value)}
            >
              {SHIFT_LABELS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {(role === 'employee' || role === 'manager' || role === 'admin') && (
            <button
              onClick={() => setNotesModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              📝 Submit Shift Notes
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="🔴" label="Critical Issues"    value={issues.length}  color="#ef4444" />
        <StatCard icon="🟡" label="Inventory Alerts"   value={alerts.length}  color="#f97316" />
        <StatCard icon="📋" label="Priority Tasks"     value={tasks.length}   color="#76b900" />
        <StatCard icon="💡" label="Suggested Actions"  value={actions.length} color="#76b900" />
      </div>

      {/* No data */}
      {noData && (
        <div className="panel p-10 text-center">
          <div className="text-5xl mb-4">🏭</div>
          <div className="text-base font-semibold text-slate-300 mb-2">No factory data loaded</div>
          <div className="text-sm text-slate-500 mb-4">
            Upload machines, orders, and inventory from the dashboard first.
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary btn-sm">
            Go to Dashboard
          </button>
        </div>
      )}

      {/* Main grid: handover card + chat */}
      {!noData && (
        <div
          className="flex gap-4"
          style={{ alignItems: 'stretch', minHeight: 'calc(100vh - 300px)' }}
        >
          {/* Left — handover card (scrollable) */}
          <div
            className="flex-1 min-w-0 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 300px)' }}
          >
            <AIHandoverCard
              currentShift={shortLabel(currentShift)}
              nextShift={shortLabel(nextShift)}
              issues={issues}
              alerts={alerts}
              tasks={tasks}
              actions={actions}
              shiftNotes={shiftNotes}
            />
          </div>

          {/* Right — AI chat (fixed height, internal scroll) */}
          <div
            style={{ width: 380, minWidth: 320, flexShrink: 0, height: 'calc(100vh - 300px)' }}
          >
            <AIChat shiftNotes={shiftNotes} />
          </div>
        </div>
      )}

      <ShiftNotesModal open={notesModalOpen} onClose={() => setNotesModalOpen(false)} />
    </div>
  )
}
