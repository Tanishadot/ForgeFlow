export interface ScheduleItem {
  order: string
  machine: string | null
  start: string | null   // ISO datetime or null
  end: string | null     // ISO datetime or null
  status?: 'scheduled' | 'delayed' | 'blocked' | 'error'
  delay?: boolean
  reason?: string
}

export interface Machine {
  machine_id: string
  machine_type?: string
  location?: string
  capacity?: number
  current_load?: number
  efficiency?: number
  status?: string   // 'running' | 'idle' | 'down' | 'maintenance'
}

export interface InventoryItem {
  product_id?: string
  material_name?: string
  quantity_on_hand: number
  reorder_level: number
  unit?: string
}

export interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  type: 'machine_down' | 'order_delayed' | 'order_blocked' | 'inventory_low' | 'inventory_critical'
  message: string
  affected?: string[]
}

export interface ScheduleSummary {
  on_track: number
  delayed: number
  blocked: number
  total: number
}

export interface WhatIfImpact {
  delayed_orders: string[]
  schedule_changes: Array<{ order: string; from?: string; to?: string; reason?: string }>
  utilization_changes: Record<string, { before: number; after: number }>
}

export interface WhatIfResult {
  status: 'success' | 'error'
  scenario: Record<string, unknown>
  impact: WhatIfImpact
  errors: string[]
}

export type ScenarioType = 'machine_failure' | 'rush_order' | 'inventory_reduction'

export type MachineStatus = 'running' | 'idle' | 'down' | 'maintenance'
