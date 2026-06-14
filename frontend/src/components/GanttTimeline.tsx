import React from 'react'
import { useStore } from '../store'
import type { ScheduleItem } from '../types'

const WORKDAY_START_MINUTES = 9 * 60   // 09:00
const WORKDAY_DURATION_MINUTES = 8 * 60 // 09:00–17:00
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17]

function parseMinutes(iso: string | null): number | null {
  if (!iso) return null
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso
  const [h, m] = timePart.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function toPercent(iso: string | null): number {
  const mins = parseMinutes(iso)
  if (mins === null) return 0
  return Math.max(0, Math.min(100, ((mins - WORKDAY_START_MINUTES) / WORKDAY_DURATION_MINUTES) * 100))
}

function widthPercent(start: string | null, end: string | null): number {
  const s = parseMinutes(start)
  const e = parseMinutes(end)
  if (s === null || e === null) return 0
  return Math.max(0, Math.min(100, ((e - s) / WORKDAY_DURATION_MINUTES) * 100))
}

function blockClass(item: ScheduleItem): string {
  if (item.status === 'delayed' || item.delay) return 'gantt-block gantt-block-delayed'
  if (item.status === 'blocked') return ''
  return 'gantt-block gantt-block-scheduled'
}

interface GanttRowProps {
  machineId: string
  items: ScheduleItem[]
}

function GanttRow({ machineId, items }: GanttRowProps) {
  const scheduled = items.filter(i => i.start && i.end && i.status !== 'blocked')

  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="text-xs text-slate-400 font-mono w-10 shrink-0 text-right">{machineId}</div>
      <div className="relative flex-1 h-10 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {scheduled.map(item => (
          <div
            key={item.order}
            className={blockClass(item)}
            style={{
              left:  `${toPercent(item.start)}%`,
              width: `${widthPercent(item.start, item.end)}%`,
            }}
            title={`${item.order}: ${item.start ? item.start.slice(-8, -3) : '?'} – ${item.end ? item.end.slice(-8, -3) : '?'}`}
          >
            {item.order}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GanttTimeline() {
  const schedule = useStore(s => s.schedule)
  const machines = useStore(s => s.machines)

  const machineIds = [
    ...machines.map(m => m.machine_id),
    ...schedule.map(s => s.machine).filter((m): m is string => !!m),
  ].filter((v, i, a) => v && a.indexOf(v) === i)

  if (schedule.length === 0) {
    return <div className="text-center py-6 text-slate-500 text-sm">No schedule to display.</div>
  }

  return (
    <div>
      {/* Hour ticks */}
      <div className="flex mb-1 pl-12">
        {HOURS.map(h => (
          <div key={h} className="flex-1 text-xs text-slate-500 text-left -ml-2">
            {h < 10 ? `0${h}:00` : `${h}:00`}
          </div>
        ))}
      </div>

      {/* Machine rows */}
      {machineIds.map(mid => {
        const machine = machines.find(m => m.machine_id === mid)
        const isDown = machine?.status === 'down' || machine?.status === 'maintenance'
        const items = schedule.filter(s => s.machine === mid)

        if (isDown) {
          return (
            <div key={mid} className="flex items-center gap-2 mb-1">
              <div className="text-xs text-slate-400 font-mono w-10 shrink-0 text-right">{mid}</div>
              <div
                className="relative flex-1 h-10 rounded flex items-center px-3"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <span className="text-xs text-red-400 font-semibold">⛔ DOWN</span>
              </div>
            </div>
          )
        }

        return <GanttRow key={mid} machineId={mid} items={items} />
      })}

      {/* Blocked orders row */}
      {schedule.filter(s => s.status === 'blocked').length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="text-xs text-slate-500 font-mono w-10 shrink-0 text-right">—</div>
          <div className="flex-1 text-xs text-slate-500">
            Blocked: {schedule.filter(s => s.status === 'blocked').map(s => s.order).join(', ')}
          </div>
        </div>
      )}
    </div>
  )
}
