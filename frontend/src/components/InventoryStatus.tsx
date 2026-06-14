import React from 'react'

const inv = [
  {product: 'P1', qty: 120},
  {product: 'P2', qty: 5},
  {product: 'P3', qty: 0},
]

export default function InventoryStatus() {
  return (
    <div className="space-y-2">
      {inv.map(i => (
        <div key={i.product} className="flex items-center justify-between">
          <div>{i.product}</div>
          <div className={i.qty === 0 ? 'text-red-400' : i.qty < 10 ? 'text-yellow-300' : ''}>{i.qty}</div>
        </div>
      ))}
    </div>
  )
}
