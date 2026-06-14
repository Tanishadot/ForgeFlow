import React from 'react'
import OrdersTable from '../components/OrdersTable'
import MachineStatus from '../components/MachineStatus'
import InventoryStatus from '../components/InventoryStatus'
import ProductionSchedule from '../components/ProductionSchedule'
import GanttChart from '../components/GanttChart'

export default function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-8">
        <div className="panel p-4 rounded-md mb-4">
          <h2 className="text-lg font-semibold mb-2">Production Schedule</h2>
          <ProductionSchedule />
        </div>
        <div className="panel p-4 rounded-md">
          <h2 className="text-lg font-semibold mb-2">Gantt View</h2>
          <GanttChart />
        </div>
      </div>

      <div className="col-span-4 space-y-4">
        <div className="panel p-4 rounded-md">
          <h2 className="text-lg font-semibold mb-2">Orders</h2>
          <OrdersTable />
        </div>
        <div className="panel p-4 rounded-md">
          <h2 className="text-lg font-semibold mb-2">Machine Status</h2>
          <MachineStatus />
        </div>
        <div className="panel p-4 rounded-md">
          <h2 className="text-lg font-semibold mb-2">Inventory</h2>
          <InventoryStatus />
        </div>
      </div>
    </div>
  )
}
