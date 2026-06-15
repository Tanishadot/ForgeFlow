import React from 'react'
import { useStore } from '../store'
import type { ScheduleItem } from '../types'

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const t = iso.includes('T') ? iso.split('T')[1] : iso
  return t.slice(0, 5)
}

function statusBadge(item: ScheduleItem) {
  const s = item.status
  if (s === 'blocked') return <span className="badge badge-blocked">Blocked</span>
  if (s === 'delayed' || item.delay) return <span className="badge badge-delayed">Delayed</span>
  if (s === 'error')   return <span className="badge badge-down">Error</span>
  return <span className="badge badge-scheduled">On Time</span>
}

function rowClass(item: ScheduleItem): string {
  if (item.status === 'blocked') return 'opacity-60'
  if (item.status === 'delayed' || item.delay) return 'text-orange-200'
  return ''
}

export default function ScheduleTable() {
  const schedule = useStore(s => s.schedule)
  const orders   = useStore(s => s.orders)

  const orderMap = new Map(orders.map(o => [o.order_code, o]))

  if (schedule.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No schedule data. Click <strong>Generate Schedule</strong> after loading data.
      </div>
    )
  }

  return (
    <div className="scroll-y" style={{ maxHeight: 320 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Product</th>
            <th>Machine</th>
            <th>Start</th>
            <th>End</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map(item => {
            const order = orderMap.get(item.order)
            return (
              <tr key={item.order} className={rowClass(item)}>
                <td className="font-mono font-semibold text-slate-200">{item.order}</td>
                <td className="text-slate-300">{order?.customer_name ?? <span className="text-slate-500">—</span>}</td>
                <td className="text-slate-300">{order?.product_name  ?? <span className="text-slate-500">—</span>}</td>
                <td>{item.machine ?? <span className="text-slate-500">—</span>}</td>
                <td className="font-mono text-sm">{fmtTime(item.start)}</td>
                <td className="font-mono text-sm">{fmtTime(item.end)}</td>
                <td>{statusBadge(item)}</td>
                <td className="text-slate-400 text-xs max-w-xs truncate">{item.reason ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
