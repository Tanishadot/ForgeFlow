import React from 'react'

const machines = [
  {id: 'M-1', status: 'running', utilization: 78},
  {id: 'M-2', status: 'idle', utilization: 12},
  {id: 'M-3', status: 'maintenance', utilization: 0},
]

export default function MachineStatus() {
  return (
    <div className="space-y-2">
      {machines.map(m => (
        <div key={m.id} className="flex items-center justify-between">
          <div>
            <div className="font-medium">{m.id}</div>
            <div className="text-sm text-slate-400">{m.status}</div>
          </div>
          <div className="text-right">
            <div className="text-sm">{m.utilization}%</div>
          </div>
        </div>
      ))}
    </div>
  )
}
