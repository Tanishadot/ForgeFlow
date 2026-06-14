import React from 'react'
import { useStore } from '../store'

const STATUS_BADGE: Record<string, string> = {
  running:     'badge badge-running',
  idle:        'badge badge-idle',
  down:        'badge badge-down',
  maintenance: 'badge badge-down',
}

const STATUS_LABEL: Record<string, string> = {
  running:     '● Running',
  idle:        '○ Idle',
  down:        '⛔ DOWN',
  maintenance: '⚠ Maintenance',
}

function utilColor(pct: number): string {
  if (pct >= 90) return '#ef4444'
  if (pct >= 75) return '#f97316'
  return '#76b900'
}

export default function MachinePanel() {
  const machines = useStore(s => s.machines)

  if (machines.length === 0) {
    return <div className="text-slate-500 text-xs text-center py-4">No machine data.</div>
  }

  return (
    <div className="space-y-3">
      {machines.map(m => {
        const status = m.status ?? 'idle'
        const isDown = status === 'down' || status === 'maintenance'
        const load = m.current_load ?? 0
        const cap  = m.capacity ?? 1
        const pct  = Math.min(100, Math.round((load / cap) * 100))

        return (
          <div key={m.machine_id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-200 text-sm">{m.machine_id}</span>
                {m.machine_type && (
                  <span className="text-xs text-slate-500">{m.machine_type}</span>
                )}
              </div>
              <span className={STATUS_BADGE[status] ?? 'badge badge-idle'}>
                {STATUS_LABEL[status] ?? status}
              </span>
            </div>

            {!isDown && (
              <div className="flex items-center gap-2">
                <div className="util-bar flex-1">
                  <div
                    className="util-bar-fill"
                    style={{ width: `${pct}%`, background: utilColor(pct) }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-400 w-8 text-right">{pct}%</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
