import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[ForgeFlow] Supabase env vars not set. ' +
    'Copy frontend/.env.example → frontend/.env and fill in your credentials. ' +
    'Auth and real-time data features will be disabled until then.'
  )
}

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseKey  ?? 'placeholder-anon-key',
)

// ── Table row types ───────────────────────────────────────────

export interface Profile {
  id:                      string
  full_name:               string | null
  employee_id:             string | null
  role:                    'employee' | 'manager' | 'admin'
  company_id:              string | null
  password_reset_required: boolean
  created_at:              string
}

export interface CompanyRow {
  id:           string
  company_name: string
  industry:     string | null
  location:     string | null
  timezone:     string
  created_at:   string
}

export interface EmployeeRow {
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
  auth_user_id:            string | null
  created_at:              string
}

export interface MachineRow {
  id:                      string
  company_id:              string
  machine_code:            string
  name:                    string | null
  type:                    string | null
  department:              string | null
  status:                  'running' | 'idle' | 'down' | 'maintenance'
  capacity_per_hour:       number
  maintenance_schedule:    string | null
  operating_cost_per_hour: number
  supported_operations:    string[]
  current_shift_operator:  string | null
  utilization:             number
  created_at:              string
}

export interface InventoryRow {
  id:               string
  company_id:       string
  material_code:    string
  material_name:    string | null
  quantity:         number
  unit:             string | null
  minimum_stock:    number
  supplier:         string | null
  lead_time_days:   number
  cost:             number
  storage_location: string | null
  created_at:       string
}

export interface OrderRow {
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
  updated_by:            string | null
  updated_at:            string
  created_at:            string
}

export interface ShiftLogRow {
  id:          string
  company_id:  string
  employee_id: string | null
  machine_id:  string | null
  order_id:    string | null
  shift:       string | null
  notes:       string
  created_at:  string
}

export interface ShiftContextRow {
  id:           string
  company_id:   string
  summary:      string
  generated_at: string
}

export interface AlertRow {
  id:         string
  company_id: string | null
  type:       string | null
  message:    string
  severity:   'critical' | 'warning' | 'info'
  created_at: string
}

export interface ScheduleRow {
  id:             string
  company_id:     string
  generated_at:   string
  summary:        Record<string, number>
  schedule_items: Record<string, unknown>[]
  machines:       Record<string, unknown>[]
}
