import React, { useEffect } from 'react'
import { useStore } from '../store'
import AlertsBar from '../components/AlertsBar'
import ScheduleTable from '../components/ScheduleTable'
import GanttTimeline from '../components/GanttTimeline'
import MachinePanel from '../components/MachinePanel'
import InventoryPanel from '../components/InventoryPanel'
import WhatIfPanel from '../components/WhatIfPanel'
import CopilotPanel from '../components/CopilotPanel'

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="font-bold" style={{ color }}>{value}</span>
      <span className="text-slate-500 text-xs">{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const { loading, error, lastUpdated, summary, alerts, seed, generateSchedule, clearError } = useStore()
  const schedule  = useStore(s => s.schedule)
  const machines  = useStore(s => s.machines)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length

  function fmtTime(d: Date | null) {
    if (!d) return '—'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const hasData = machines.length > 0 || schedule.length > 0

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Sub-header: summary + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          {hasData && (
            <>
              <SummaryPill label="on track" value={summary.on_track} color="#22c55e" />
              <SummaryPill label="delayed"  value={summary.delayed}  color="#f97316" />
              <SummaryPill label="blocked"  value={summary.blocked}  color="#ef4444" />
              <span className="text-slate-600 text-xs">|</span>
              <span className="text-slate-500 text-xs">{summary.total} orders total</span>
            </>
          )}
          {lastUpdated && (
            <span className="text-slate-600 text-xs hidden sm:inline">
              Updated {fmtTime(lastUpdated)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={seed} disabled={loading} className="btn btn-ghost btn-sm">
            {loading ? '…' : '⬇ Load Sample Data'}
          </button>
          <button onClick={generateSchedule} disabled={loading || !hasData} className="btn btn-primary btn-sm">
            {loading ? 'Generating…' : '▶ Generate Schedule'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert-strip alert-strip-critical flex items-center justify-between">
          <span>⛔ {error}</span>
          <button onClick={clearError} className="btn btn-ghost btn-sm ml-4">Dismiss</button>
        </div>
      )}

      {/* Alerts */}
      <AlertsBar />

      {/* Empty state */}
      {!hasData && !loading && (
        <div className="panel p-10 text-center flex flex-col items-center gap-3">
          <div className="text-4xl">🏭</div>
          <div className="text-lg font-semibold text-slate-300">No factory data loaded</div>
          <div className="text-sm text-slate-500">Load sample data to see the production schedule, machine status, and AI recommendations.</div>
          <button onClick={seed} disabled={loading} className="btn btn-primary mt-2">
            ⬇ Load Sample Data
          </button>
        </div>
      )}

      {/* Main grid */}
      {hasData && (
        <div className="flex gap-3 flex-1 min-h-0" style={{ alignItems: 'flex-start' }}>
          {/* Left column */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            {/* Schedule table */}
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                Today's Schedule
                {criticalCount > 0 && (
                  <span className="badge badge-down text-xs">{criticalCount} critical</span>
                )}
              </h2>
              <ScheduleTable />
            </div>

            {/* Gantt */}
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Production Timeline</h2>
              <GanttTimeline />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3" style={{ width: 300, minWidth: 260, flexShrink: 0 }}>
            {/* Machines */}
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Machines</h2>
              <MachinePanel />
            </div>

            {/* Inventory */}
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Inventory</h2>
              <InventoryPanel />
            </div>

            {/* What-If */}
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">What-If Simulator</h2>
              <WhatIfPanel />
            </div>

            {/* Copilot */}
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
    </div>
  )
}
