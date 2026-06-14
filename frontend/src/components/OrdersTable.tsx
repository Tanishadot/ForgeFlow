import React from 'react'

const mock = [
  {order: 'O1', product: 'P1', qty: 10, due: '2026-06-14'},
  {order: 'O2', product: 'P2', qty: 5, due: '2026-06-15'},
  {order: 'O3', product: 'P3', qty: 7, due: '2026-06-14', status: 'delayed'},
]

export default function OrdersTable() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-400">
          <th className="pb-2">Order</th>
          <th className="pb-2">Product</th>
          <th className="pb-2">Qty</th>
          <th className="pb-2">Due</th>
          <th className="pb-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {mock.map((r) => (
          <tr key={r.order} className="border-t border-white/3">
            <td className="py-2">{r.order}</td>
            <td className="py-2">{r.product}</td>
            <td className="py-2">{r.qty}</td>
            <td className="py-2">{r.due}</td>
            <td className="py-2">{r.status || 'ok'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
