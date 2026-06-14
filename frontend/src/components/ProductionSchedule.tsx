import React from 'react'

const schedule = [
  {order: 'O1', machine: 'M-1', start: '2026-06-14T08:00', end: '2026-06-14T12:00'},
  {order: 'O2', machine: 'M-2', start: '2026-06-14T09:00', end: '2026-06-14T11:00'},
  {order: 'O3', machine: 'M-1', start: '2026-06-14T12:30', end: '2026-06-14T15:00', status: 'delayed'},
]

export default function ProductionSchedule() {
  return (
    <div className="space-y-2 text-sm">
      {schedule.map(s => (
        <div key={s.order} className="flex justify-between border-b border-white/4 py-2">
          <div>
            <div className="font-medium">{s.order}</div>
            <div className="text-slate-400 text-xs">{s.machine}</div>
          </div>
          <div className="text-right">
            <div>{s.start} → {s.end}</div>
            <div className="text-xs text-slate-400">{s.status || 'scheduled'}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
