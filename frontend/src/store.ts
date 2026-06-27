import { create } from 'zustand'
import { api } from './api'
import { supabase } from './services/supabase'
import type {
  ScheduleItem, Machine, InventoryItem, Alert, WhatIfResult, ScheduleSummary,
  Order, ShiftContext, ShiftLogInsert,
} from './types'
import type { MachineRow, InventoryRow, OrderRow, ShiftLogRow, ShiftContextRow, ScheduleRow } from './services/supabase'

const DOWNTIME = new Set(['down', 'maintenance', 'offline', 'disabled'])

function deriveAlerts(
  schedule: ScheduleItem[],
  machines: Machine[],
  inventory: InventoryItem[],
): Alert[] {
  const alerts: Alert[] = []

  for (const m of machines) {
    if (m.status && DOWNTIME.has(m.status)) {
      const affected = schedule.filter(s => s.machine === m.machine_id).map(s => s.order)
      alerts.push({
        id: `machine-${m.machine_id}`,
        severity: 'critical',
        type: 'machine_down',
        message: `${m.machine_id} (${m.machine_type ?? 'Machine'}) is ${m.status.toUpperCase()}`,
        affected,
      })
    }
  }

  for (const s of schedule) {
    if (s.status === 'blocked') {
      alerts.push({
        id: `blocked-${s.order}`,
        severity: 'critical',
        type: 'order_blocked',
        message: `Order ${s.order} blocked — ${s.reason ?? 'no machine available'}`,
        affected: [s.order],
      })
    } else if (s.status === 'delayed' || s.delay) {
      alerts.push({
        id: `delayed-${s.order}`,
        severity: 'warning',
        type: 'order_delayed',
        message: `Order ${s.order} delayed — ${s.reason ?? 'past workday end'}`,
        affected: [s.order],
      })
    }
  }

  for (const inv of inventory) {
    const current = inv.quantity_on_hand ?? 0
    const level = inv.reorder_level ?? 0
    const label = inv.material_name ?? inv.product_id ?? 'Unknown'
    if (level > 0 && current < level * 0.3) {
      alerts.push({
        id: `inv-crit-${inv.product_id}`,
        severity: 'critical',
        type: 'inventory_critical',
        message: `${label}: CRITICAL — ${current}/${level} ${inv.unit ?? ''}`.trim(),
      })
    } else if (level > 0 && current < level) {
      alerts.push({
        id: `inv-low-${inv.product_id}`,
        severity: 'warning',
        type: 'inventory_low',
        message: `${label}: LOW — ${current}/${level} ${inv.unit ?? ''}`.trim(),
      })
    }
  }

  return alerts
}

// Map Supabase machine rows → Machine (for existing components)
function mapMachines(rows: MachineRow[]): Machine[] {
  return rows.map(r => ({
    machine_id:   r.machine_code,
    machine_type: r.type ?? undefined,
    location:     r.department ?? undefined,
    capacity:     r.capacity_per_hour,
    current_load: 0,
    // Use utilization directly (not inverted) — efficiency bar shows how busy the machine is
    efficiency:   Math.round(Number(r.utilization ?? 0)),
    status:       r.status,
  }))
}

// Parse a time value that may be either "HH:MM" or "YYYY-MM-DDTHH:MM:SS" → minutes since midnight
function parseTimeToMinutes(val: string | null): number {
  if (!val) return 0
  const timePart = val.includes('T') ? val.split('T')[1] : val
  const parts = timePart.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (isNaN(h) || isNaN(m)) return 0
  return h * 60 + m
}

// Recompute per-machine current_load from a schedule using duration-based utilization.
// Handles both HH:MM and ISO datetime strings in start/end.
function computeMachineLoads(machines: Machine[], schedule: ScheduleItem[]): Machine[] {
  const WORKDAY_MIN = 8 * 60  // 480 minutes (09:00–17:00)
  const minutesByMachine = new Map<string, number>()

  for (const item of schedule) {
    if (!item.machine || !item.start || !item.end || item.status === 'blocked') continue
    const startMin = parseTimeToMinutes(item.start)
    const endMin   = parseTimeToMinutes(item.end)
    const dur = Math.max(0, endMin - startMin)
    minutesByMachine.set(item.machine, (minutesByMachine.get(item.machine) ?? 0) + dur)
  }

  return machines.map(m => {
    const mins = minutesByMachine.get(m.machine_id) ?? 0
    const utilPct = Math.min(100, Math.round((mins / WORKDAY_MIN) * 100))
    return {
      ...m,
      current_load: Math.round((mins / WORKDAY_MIN) * (m.capacity ?? 100)),
      efficiency:   utilPct,
    }
  })
}

// Map Supabase inventory rows → InventoryItem (for existing components)
function mapInventory(rows: InventoryRow[]): InventoryItem[] {
  return rows.map(r => ({
    product_id:       r.material_code,
    material_name:    r.material_name ?? undefined,
    quantity_on_hand: r.quantity,
    reorder_level:    r.minimum_stock,
    unit:             r.unit ?? undefined,
  }))
}

// Map Supabase order rows → ScheduleItem (pending orders without schedule)
function mapOrdersToSchedule(rows: OrderRow[]): ScheduleItem[] {
  return rows.map(r => ({
    order:   r.order_code,
    machine: null,
    start:   null,
    end:     null,
    status:  r.status === 'blocked' ? 'blocked' : 'scheduled',
    reason:  r.notes ?? undefined,
  }))
}

// Priority string → urgency score (0-10) for the backend order agent
const URGENCY_MAP: Record<string, number> = { urgent: 10, high: 7, normal: 4, low: 1 }

// Transform Supabase Order to backend agent format.
// No client-side sorting — OrderPrioritizerAgent on the backend scores and ranks.
function ordersToBackendFormat(orders: Order[]): Record<string, unknown>[] {
  return orders.map(o => ({
    order_id:         o.order_code,
    product_name:     o.product_name ?? undefined,   // needed by BOM service
    quantity:         o.quantity,
    machine_type:     o.required_machine_type ?? undefined,
    duration_minutes: o.estimated_duration,
    due_date:         o.deadline ?? undefined,
    urgency_score:    URGENCY_MAP[o.priority] ?? 4,
  }))
}

// Transform Machine (from Supabase) to backend machine agent format.
function machinesToBackendFormat(machines: Machine[]): Record<string, unknown>[] {
  return machines.map(m => ({
    machine_id:   m.machine_id,
    machine_type: m.machine_type ?? undefined,
    location:     m.location ?? undefined,
    capacity:     m.capacity ?? 100,
    current_load: m.current_load ?? 0,
    status:       m.status ?? 'idle',
  }))
}

// Transform InventoryItem (from Supabase) to backend inventory agent format.
function inventoryToBackendFormat(inventory: InventoryItem[]): Record<string, unknown>[] {
  return inventory.map(i => ({
    material_name:    i.material_name ?? i.product_id,
    product_id:       i.product_id,
    quantity_on_hand: i.quantity_on_hand,
    reorder_level:    i.reorder_level,
    unit:             i.unit,
  }))
}

interface AppState {
  // Scheduling
  schedule:     ScheduleItem[]
  summary:      ScheduleSummary
  machines:     Machine[]
  inventory:    InventoryItem[]
  alerts:       Alert[]
  // Orders (Supabase)
  orders:       Order[]
  // Shift
  shiftContext: ShiftContext | null
  // UI state
  loading:           boolean
  explanationLoading: boolean
  error:             string | null
  lastUpdated:       Date | null
  whatIfResult:      WhatIfResult | null
  sessionId:         string
  companyId:         string | null
  // Schedule explanation (NVIDIA NIM)
  explanation:              string[] | null
  explanationRecommendations: string[] | null
  explanationProvider:      string | null

  // Actions
  loadFromDatabase:   (companyId: string) => Promise<void>
  generateSchedule:   () => Promise<void>
  explainSchedule:    () => Promise<void>
  submitShiftLog:     (log: ShiftLogInsert) => Promise<void>
  loadShiftContext:   (companyId: string) => Promise<void>
  runWhatIf:          (scenario: Record<string, unknown>) => Promise<void>
  applyWhatIf:        () => void
  clearWhatIf:        () => void
  clearExplanation:   () => void
  clearError:         () => void
  // Legacy (kept for backward-compat with WhatIfPanel / Simulation page)
  seed:               () => Promise<void>
  loadSupportData:    () => Promise<void>
  refreshAll:         () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  schedule:            [],
  summary:             { on_track: 0, delayed: 0, blocked: 0, total: 0 },
  machines:            [],
  inventory:           [],
  alerts:              [],
  orders:              [],
  shiftContext:        null,
  loading:             false,
  explanationLoading:  false,
  error:               null,
  lastUpdated:         null,
  whatIfResult:        null,
  sessionId:           Math.random().toString(36).slice(2, 10),
  companyId:           null,
  explanation:                null,
  explanationRecommendations: null,
  explanationProvider:        null,

  // ── Primary: load live data from Supabase ─────────────────
  loadFromDatabase: async (companyId: string) => {
    if (!companyId) {
      set({ error: 'Cannot load data: company ID is missing. Please sign in again.' })
      return
    }
    set({ loading: true, error: null, companyId })
    try {
      const [machinesRes, inventoryRes, ordersRes, scheduleRes] = await Promise.all([
        supabase.from('machines').select('*').eq('company_id', companyId).order('machine_code'),
        supabase.from('inventory').select('*').eq('company_id', companyId).order('material_name'),
        supabase.from('orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('schedules').select('*').eq('company_id', companyId)
          .order('generated_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      const machineRows   = (machinesRes.data  ?? []) as MachineRow[]
      const inventoryRows = (inventoryRes.data ?? []) as InventoryRow[]
      const orderRows     = (ordersRes.data    ?? []) as OrderRow[]

      const machines  = mapMachines(machineRows)
      const inventory = mapInventory(inventoryRows)
      const orders    = orderRows as unknown as Order[]

      // Load persisted schedule from Supabase if available; fall back to
      // pending placeholder rows so the table is not empty on first load.
      const existingSchedule = get().schedule
      let schedule: ScheduleItem[]
      let summary: ScheduleSummary

      const saved = scheduleRes.data as ScheduleRow | null
      if (existingSchedule.length > 0) {
        schedule = existingSchedule
        summary  = get().summary
      } else if (saved && Array.isArray(saved.schedule_items) && saved.schedule_items.length > 0) {
        schedule = saved.schedule_items as unknown as ScheduleItem[]
        summary  = (saved.summary as unknown as ScheduleSummary) ?? {
          total: orderRows.length, on_track: 0, delayed: 0, blocked: 0,
        }
        // Restore machine utilization from persisted data
        if (Array.isArray(saved.machines) && saved.machines.length > 0) {
          const savedMachines = saved.machines as Record<string, unknown>[]
          const restoredMachines = machines.map(m => {
            const bm = savedMachines.find(b => (b.machine_id as string) === m.machine_id)
            if (!bm) return m
            return {
              ...m,
              efficiency:   Number(bm.utilization_pct ?? 0),
              current_load: Number(bm.current_load ?? 0),
            }
          })
          set({ machines: restoredMachines })
        }
      } else {
        schedule = mapOrdersToSchedule(orderRows)
        summary  = {
          total:    orderRows.length,
          on_track: orderRows.filter(o => o.status === 'in_progress' || o.status === 'pending').length,
          delayed:  0,
          blocked:  orderRows.filter(o => o.status === 'blocked').length,
        }
      }

      set({
        machines,
        inventory,
        orders,
        schedule,
        summary,
        alerts: deriveAlerts(schedule, machines, inventory),
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Failed to load data' })
    } finally {
      set({ loading: false })
    }
  },

  // ── AI schedule generation via backend agents ─────────────
  // Sends Supabase data to the backend so the full AgentIQ pipeline runs:
  // OrderPrioritizerAgent → InventoryAgent(BOM) → MachineAgent → Scheduler
  generateSchedule: async () => {
    set({ loading: true, error: null })
    try {
      const { orders, machines, inventory, companyId } = get()

      if (orders.length === 0 || machines.length === 0) {
        set({ error: 'Upload orders and machines before generating a schedule.' })
        return
      }

      const resp = await api.generateSchedule({
        orders:     ordersToBackendFormat(orders),
        machines:   machinesToBackendFormat(machines),
        inventory:  inventoryToBackendFormat(inventory),
        company_id: companyId ?? undefined,
      })

      const { schedule, summary, machines: backendMachines } = resp.data

      // Use backend-computed utilization (single source of truth).
      // Fall back to client-side calculation only if backend omits machine data.
      const updatedMachines = (backendMachines && backendMachines.length > 0)
        ? machines.map(m => {
            const bm = backendMachines.find(b => (b.machine_id as string) === m.machine_id)
            if (!bm) return m
            return {
              ...m,
              efficiency:   Number(bm.utilization_pct ?? 0),
              current_load: Number(bm.current_load ?? 0),
            }
          })
        : computeMachineLoads(machines, schedule)

      set({
        schedule,
        summary,
        machines: updatedMachines,
        alerts: deriveAlerts(schedule, updatedMachines, inventory),
        lastUpdated: new Date(),
        explanation: null,         // reset stale explanation on new schedule
        explanationProvider: null,
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Schedule generation failed' })
    } finally {
      set({ loading: false })
    }
  },

  // ── AI Schedule Explanation via NVIDIA NIM ─────────────────
  explainSchedule: async () => {
    const { schedule, orders, machines, inventory, summary } = get()
    if (schedule.length === 0) {
      set({ error: 'Generate a schedule first before requesting an explanation.' })
      return
    }
    set({ explanationLoading: true, error: null })
    try {
      const resp = await api.explainSchedule(schedule, {
        orders:    ordersToBackendFormat(orders),
        machines:  machinesToBackendFormat(machines),
        inventory: inventoryToBackendFormat(inventory),
        summary,
      })
      set({
        explanation:                resp.data.summaries,
        explanationRecommendations: resp.data.recommendations ?? [],
        explanationProvider:        resp.data.provider,
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Explanation failed' })
    } finally {
      set({ explanationLoading: false })
    }
  },

  // ── Shift log submission ───────────────────────────────────
  submitShiftLog: async (log: ShiftLogInsert) => {
    const { data, error } = await supabase
      .from('shift_logs')
      .insert(log as unknown as ShiftLogRow)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  // ── Fetch latest shift context ────────────────────────────
  loadShiftContext: async (companyId: string) => {
    const { data } = await supabase
      .from('shift_context')
      .select('*')
      .eq('company_id', companyId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      set({ shiftContext: (data as ShiftContextRow) as unknown as ShiftContext })
    }
  },

  // ── What-If simulation ────────────────────────────────────
  // All three scenarios rerun the full AgentIQ pipeline on the backend.
  runWhatIf: async (scenario) => {
    set({ loading: true, error: null })
    try {
      const { schedule, machines, inventory, orders } = get()
      const resp = await api.runWhatIf(
        schedule,
        scenario,
        machinesToBackendFormat(machines),
        inventoryToBackendFormat(inventory),
        ordersToBackendFormat(orders),
      )
      set({ whatIfResult: resp.data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Simulation failed' })
    } finally {
      set({ loading: false })
    }
  },

  applyWhatIf: () => {
    const { whatIfResult, machines, inventory } = get()
    const newSchedule = whatIfResult?.impact?.new_schedule as ScheduleItem[] | undefined
    if (!newSchedule || newSchedule.length === 0) return
    const onTrack = newSchedule.filter(s => !s.status || s.status === 'scheduled').length
    const delayed = newSchedule.filter(s => s.status === 'delayed').length
    const blocked = newSchedule.filter(s => s.status === 'blocked').length
    const summary: ScheduleSummary = { total: newSchedule.length, on_track: onTrack, delayed, blocked }
    set({
      schedule:    newSchedule,
      summary,
      alerts:      deriveAlerts(newSchedule, machines, inventory),
      whatIfResult: null,
      explanation: null,
      explanationRecommendations: null,
      explanationProvider: null,
      lastUpdated: new Date(),
    })
  },

  clearWhatIf:      () => set({ whatIfResult: null }),
  clearExplanation: () => set({ explanation: null, explanationRecommendations: null, explanationProvider: null }),
  clearError:       () => set({ error: null }),

  // ── Legacy compatibility ───────────────────────────────────
  seed: async () => {
    set({ loading: true, error: null })
    try {
      await api.seed()
      await get().refreshAll()
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Seed failed' })
    } finally {
      set({ loading: false })
    }
  },

  loadSupportData: async () => {
    const [mResp, iResp] = await Promise.all([api.getMachines(), api.getInventory()])
    set({ machines: mResp.data.data, inventory: iResp.data.data })
  },

  refreshAll: async () => {
    set({ loading: true, error: null })
    try {
      const [mResp, iResp, sResp] = await Promise.all([
        api.getMachines(),
        api.getInventory(),
        api.generateSchedule(),
      ])
      const machines  = mResp.data.data
      const inventory = iResp.data.data
      const { schedule, summary, machines: backendMachines } = sResp.data
      const updatedMachines = (backendMachines && backendMachines.length > 0)
        ? machines.map(m => {
            const bm = backendMachines.find(b => (b.machine_id as string) === m.machine_id)
            if (!bm) return m
            return { ...m, efficiency: Number(bm.utilization_pct ?? 0), current_load: Number(bm.current_load ?? 0) }
          })
        : computeMachineLoads(machines, schedule)
      set({
        machines: updatedMachines,
        inventory,
        schedule,
        summary,
        alerts: deriveAlerts(schedule, updatedMachines, inventory),
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Refresh failed' })
    } finally {
      set({ loading: false })
    }
  },
}))
