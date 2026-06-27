import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import AlertsBar from '../components/AlertsBar'
import ScheduleTable from '../components/ScheduleTable'
import GanttTimeline from '../components/GanttTimeline'
import MachinePanel from '../components/MachinePanel'
import InventoryPanel from '../components/InventoryPanel'
import WhatIfPanel from '../components/WhatIfPanel'
import CopilotPanel from '../components/CopilotPanel'
import UpdateStatusModal from '../components/UpdateStatusModal'
import ShiftNotesModal from '../components/ShiftNotesModal'
import ShiftSummaryBanner from '../components/ShiftSummaryBanner'
import AdminSetupDashboard from '../components/AdminSetupDashboard'
import ExplanationModal from '../components/ExplanationModal'

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="font-bold" style={{ color }}>{value}</span>
      <span className="text-slate-500 text-xs">{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    loading, error, lastUpdated, summary, alerts,
    generateSchedule, explainSchedule, loadFromDatabase, loadShiftContext, clearError,
    explanation, explanationRecommendations, explanationProvider, explanationLoading, clearExplanation,
  } = useStore()
  const schedule  = useStore(s => s.schedule)
  const machines  = useStore(s => s.machines)
  const inventory = useStore(s => s.inventory)
  const orders    = useStore(s => s.orders)
  const { role, companyId } = useAuth()
  const perms = usePermissions()

  const [statusModalOpen,     setStatusModalOpen]     = useState(false)
  const [shiftNotesModalOpen, setShiftNotesModalOpen] = useState(false)
  const [explainModalOpen,    setExplainModalOpen]    = useState(false)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length

  useEffect(() => {
    if (companyId) {
      loadFromDatabase(companyId)
      loadShiftContext(companyId)
    }
  }, [companyId])

  function fmtTime(d: Date | null) {
    if (!d) return '—'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isAdmin = role === 'admin'
  const hasData = machines.length > 0 || schedule.length > 0

  // Admin sees the setup wizard until machines + inventory + orders are all loaded
  const isAdminSetup = isAdmin && (
    machines.length === 0 || inventory.length === 0 || orders.length === 0
  )

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Previous Shift Summary */}
      <ShiftSummaryBanner />

      {/* Sub-header: summary + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          {hasData && !isAdminSetup && (
            <>
              <SummaryPill label="on track" value={summary.on_track} color="#22c55e" />
              <SummaryPill label="delayed"  value={summary.delayed}  color="#f97316" />
              <SummaryPill label="blocked"  value={summary.blocked}  color="#ef4444" />
              <span className="text-slate-600 text-xs">|</span>
              <span className="text-slate-500 text-xs">{summary.total} orders total</span>
            </>
          )}
          {lastUpdated && !isAdminSetup && (
            <span className="text-slate-600 text-xs hidden sm:inline">
              Updated {fmtTime(lastUpdated)}
            </span>
          )}
        </div>

        {/* Action buttons — AI & operational features available to all authenticated users */}
        {!isAdminSetup && (
          <div className="flex gap-2 flex-wrap">
            {perms.canRunScheduler && (
              <button
                onClick={generateSchedule}
                disabled={loading || !hasData}
                className="btn btn-primary btn-sm"
              >
                {loading ? 'Running…' : '▶ Run AI Scheduler'}
              </button>
            )}

            {perms.canExplainSchedule && schedule.length > 0 && (
              <button
                onClick={() => { setExplainModalOpen(true); explainSchedule() }}
                disabled={loading || explanationLoading}
                className="btn btn-ghost btn-sm"
                style={{ border: '1px solid rgba(118,185,0,0.3)', color: '#76b900' }}
              >
                {explanationLoading ? 'Analyzing…' : '✨ Explain Schedule'}
              </button>
            )}

            {perms.canViewShiftLogs && (
              <button
                onClick={() => navigate('/copilot')}
                className="btn btn-ghost btn-sm"
              >
                📋 Shift Logs
              </button>
            )}

            {perms.canAccessHandover && (
              <button
                onClick={() => navigate('/handover')}
                className="btn btn-ghost btn-sm"
                style={{ border: '1px solid rgba(118,185,0,0.3)', color: '#76b900' }}
              >
                🤖 Handover Brief
              </button>
            )}

            {perms.canSubmitShiftNotes && (
              <button
                onClick={() => setShiftNotesModalOpen(true)}
                className="btn btn-ghost btn-sm"
              >
                📝 Submit Shift Notes
              </button>
            )}

            {perms.canUpdateStatus && (
              <button
                onClick={() => setStatusModalOpen(true)}
                className="btn btn-ghost btn-sm"
              >
                ✏ Update Status
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert-strip alert-strip-critical flex items-center justify-between">
          <span>⛔ {error}</span>
          <button onClick={clearError} className="btn btn-ghost btn-sm ml-4">Dismiss</button>
        </div>
      )}

      {/* ── Admin Setup Dashboard ────────────────────────────────────────── */}
      {isAdminSetup && companyId && !loading && (
        <AdminSetupDashboard companyId={companyId} />
      )}

      {/* ── Non-admin empty state ──────────────────────────────────────────── */}
      {!isAdminSetup && !hasData && !loading && !isAdmin && (
        <div className="panel p-10 text-center flex flex-col items-center gap-3">
          <div className="text-4xl">🏭</div>
          <div className="text-lg font-semibold text-slate-300">No factory data loaded</div>
          <div className="text-sm text-slate-500">
            Your admin is setting up the factory. Check back soon.
          </div>
        </div>
      )}

      {/* ── Alerts ────────────────────────────────────────────────────────── */}
      {!isAdminSetup && <AlertsBar />}

      {/* ── Main dashboard grid ───────────────────────────────────────────── */}
      {!isAdminSetup && hasData && (
        <div className="flex gap-3 flex-1 min-h-0" style={{ alignItems: 'flex-start' }}>
          {/* Left column */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                Today's Schedule
                {criticalCount > 0 && (
                  <span className="badge badge-down text-xs">{criticalCount} critical</span>
                )}
              </h2>
              <ScheduleTable />
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Production Timeline</h2>
              <GanttTimeline />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3" style={{ width: 300, minWidth: 260, flexShrink: 0 }}>
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Machines</h2>
              <MachinePanel />
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Inventory</h2>
              <InventoryPanel />
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">What-If Simulator</h2>
              <WhatIfPanel />
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                AI Copilot
                <span className="text-xs text-nvidia-400 font-normal">NVIDIA NIM</span>
              </h2>
              <CopilotPanel />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <UpdateStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
      />
      <ShiftNotesModal
        open={shiftNotesModalOpen}
        onClose={() => setShiftNotesModalOpen(false)}
      />
      <ExplanationModal
        open={explainModalOpen}
        onClose={() => { setExplainModalOpen(false); clearExplanation() }}
        summaries={explanation ?? []}
        recommendations={explanationRecommendations ?? []}
        provider={explanationProvider}
        loading={explanationLoading}
      />
    </div>
  )
}
