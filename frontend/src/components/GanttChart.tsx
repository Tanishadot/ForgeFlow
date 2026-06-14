import React from 'react'

export default function GanttChart() {
  // Minimal placeholder Gantt view using CSS bars
  const items = [
    {id:'O1', start:8, end:12, machine:'M-1'},
    {id:'O2', start:9, end:11, machine:'M-2'},
    {id:'O3', start:12.5, end:15, machine:'M-1'},
  ]

  const hours = Array.from({length:12}).map((_,i) => 6+i)

  return (
    <div>
      <div className="text-xs text-slate-400 mb-2">Timeline (hours)</div>
      <div className="overflow-x-auto">
        <div className="w-full">
          <div className="mb-2 flex text-xs text-slate-400">
            {hours.map(h => <div key={h} className="w-16">{h}:00</div>)}
          </div>
          <div>
            {items.map(it => (
              <div key={it.id} className="mb-2">
                <div className="text-sm">{it.id} ({it.machine})</div>
                <div className="relative h-6 bg-white/2 rounded-md">
                  <div className="absolute h-6 bg-nvidia-500 rounded-md" style={{left: `${(it.start-6)*6.6}%`, width: `${(it.end-it.start)*6.6}%`}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
