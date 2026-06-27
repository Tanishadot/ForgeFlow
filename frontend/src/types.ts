// ── Scheduling ────────────────────────────────────────────────

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
  new_schedule?: ScheduleItem[]
  affected_orders?: Array<{ order: string; was: string; now: string; reason?: string }>
}

export interface WhatIfResult {
  status: 'success' | 'error'
  scenario: Record<string, unknown>
  impact: WhatIfImpact
  errors: string[]
}

export type ScenarioType = 'machine_failure' | 'rush_order' | 'inventory_reduction'

export type MachineStatus = 'running' | 'idle' | 'down' | 'maintenance'

// ── B2B SaaS Entities ─────────────────────────────────────────

export interface Company {
  id:           string
  company_name: string
  industry:     string | null
  location:     string | null
  timezone:     string
  created_at:   string
}

export interface Employee {
  id:                      string
  company_id:              string
  employee_id:             string
  name:                    string | null
  email:                   string | null
  department:              string | null
  role:                    'employee' | 'manager' | 'admin'
  shift:                   string | null
  skill_level:             string | null
  phone:                   string | null
  password_reset_required: boolean
  created_at:              string
}

export interface Order {
  id:                    string
  company_id:            string
  order_code:            string
  customer_name:         string | null
  product_name:          string | null
  quantity:              number
  priority:              'low' | 'normal' | 'high' | 'urgent'
  deadline:              string | null
  required_machine_type: string | null
  estimated_duration:    number
  status:                'pending' | 'in_progress' | 'completed' | 'blocked'
  notes:                 string | null
  updated_at:            string
  created_at:            string
}

export interface ShiftLog {
  id:          string
  company_id:  string
  employee_id: string | null
  machine_id:  string | null
  order_id:    string | null
  shift:       string | null
  notes:       string
  created_at:  string
}

export interface ShiftContext {
  id:           string
  company_id:   string
  summary:      string
  generated_at: string
}

export interface ShiftLogInsert {
  company_id:  string
  employee_id: string | null
  machine_id:  string | null
  order_id:    string | null
  shift:       string
  notes:       string
}
