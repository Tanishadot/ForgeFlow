import React from 'react'
import { useStore } from '../store'

function stockLevel(current: number, reorder: number): { label: string; cls: string; barPct: number; barColor: string } {
  if (reorder <= 0) return { label: 'OK', cls: 'badge-ok', barPct: 100, barColor: '#76b900' }
  const ratio = current / reorder
  if (ratio < 0.3) return { label: 'CRITICAL', cls: 'badge-critical', barPct: ratio * 100, barColor: '#ef4444' }
  if (ratio < 1.0) return { label: 'LOW',      cls: 'badge-low',      barPct: ratio * 100, barColor: '#f59e0b' }
  return { label: 'OK', cls: 'badge-ok', barPct: Math.min(100, ratio * 100), barColor: '#76b900' }
}

export default function InventoryPanel() {
  const inventory = useStore(s => s.inventory)

  if (inventory.length === 0) {
    return <div className="text-slate-500 text-xs text-center py-4">No inventory data.</div>
  }

  return (
    <div className="space-y-3">
      {inventory.map((inv, i) => {
        const name    = inv.material_name ?? inv.product_id ?? `Item ${i}`
        const current = inv.quantity_on_hand ?? 0
        const reorder = inv.reorder_level ?? 0
        const unit    = inv.unit ?? ''
        const { label, cls, barPct, barColor } = stockLevel(current, reorder)

        return (
          <div key={inv.product_id ?? i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[130px]" title={name}>{name}</span>
              <span className={`badge ${cls}`}>{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="util-bar flex-1">
                <div className="util-bar-fill" style={{ width: `${Math.min(100, barPct)}%`, background: barColor }} />
              </div>
              <span className="text-xs font-mono text-slate-400 shrink-0">
                {current}/{reorder} {unit}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
