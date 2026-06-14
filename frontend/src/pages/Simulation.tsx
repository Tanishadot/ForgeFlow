import React from 'react'
import { useStore } from '../store'
import WhatIfPanel from '../components/WhatIfPanel'
import GanttTimeline from '../components/GanttTimeline'

export default function Simulation() {
  const schedule     = useStore(s => s.schedule)
  const whatIfResult = useStore(s => s.whatIfResult)
  const summary      = useStore(s => s.summary)

  const delayedCount  = whatIfResult?.impact.delayed_orders.length ?? 0
  const simOnTrack    = Math.max(0, summary.on_track - delayedCount)
  const simDelayed    = summary.delayed + delayedCount

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4">
        <h2 className="text-lg font-semibold">What-If Simulator</h2>
        <p className="text-sm text-slate-400 mt-1">
          Simulate machine failures, rush orders, and inventory shortages against the current schedule.
          See the impact before committing to a decision.
        </p>
      </div>

      {schedule.length === 0 && (
        <div className="alert-strip alert-strip-warning">
          ⚠ No schedule loaded. Go to Dashboard → Load Sample Data → Generate Schedule first.
        </div>
      )}

      {schedule.length > 0 && (
        <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
          {/* Controls */}
          <div className="panel p-4" style={{ width: 320, flexShrink: 0 }}>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Configure Scenario</h3>
            <WhatIfPanel />
          </div>

          {/* Results */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            {/* Before / After */}
            <div className="flex gap-3">
              <div className="panel p-4 flex-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Current Plan</div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-green-400 font-bold text-xl">{summary.on_track}</span>
                    <span className="text-slate-400 text-xs ml-1">on track</span>
                  </div>
                  <div>
                    <span className="text-orange-400 font-bold text-xl">{summary.delayed}</span>
                    <span className="text-slate-400 text-xs ml-1">delayed</span>
                  </div>
                  <div>
                    <span className="text-red-400 font-bold text-xl">{summary.blocked}</span>
                    <span className="text-slate-400 text-xs ml-1">blocked</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center text-slate-500 text-2xl">→</div>

              <div className={`panel p-4 flex-1 ${whatIfResult ? 'border-orange-900/50' : ''}`}
                style={whatIfResult ? { borderColor: 'rgba(249,115,22,0.3)' } : {}}>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  {whatIfResult ? 'Simulated Outcome' : 'Run simulation to see impact'}
                </div>
                {whatIfResult ? (
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-orange-400 font-bold text-xl">{simOnTrack}</span>
                      <span className="text-slate-400 text-xs ml-1">on track</span>
                    </div>
                    <div>
                      <span className="text-red-400 font-bold text-xl">{simDelayed}</span>
                      <span className="text-slate-400 text-xs ml-1">delayed</span>
                    </div>
                    <div>
                      <span className="text-red-500 font-bold text-xl">{summary.blocked}</span>
                      <span className="text-slate-400 text-xs ml-1">blocked</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-600 text-sm">—</div>
                )}
              </div>
            </div>

            {/* Schedule changes */}
            {whatIfResult?.impact.schedule_changes && whatIfResult.impact.schedule_changes.length > 0 && (
              <div className="panel p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Schedule Changes</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Change</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatIfResult.impact.schedule_changes.map((c, i) => (
                      <tr key={i}>
                        <td className="font-mono font-semibold">{c.order}</td>
                        <td>
                          {c.from && c.to
                            ? <span className="text-amber-300">{c.from} → {c.to}</span>
                            : <span className="badge badge-delayed">Delayed</span>}
                        </td>
                        <td className="text-slate-400 text-xs">{c.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Gantt (current schedule for reference) */}
            <div className="panel p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Current Schedule Timeline</h3>
              <GanttTimeline />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
