import { create } from 'zustand'
import { api } from './api'
import { supabase } from './services/supabase'
import type {
  ScheduleItem, Machine, InventoryItem, Alert, WhatIfResult, ScheduleSummary,
  Order, ShiftContext, ShiftLogInsert,
} from './types'
import type { MachineRow, InventoryRow, OrderRow, ShiftLogRow, ShiftContextRow } from './services/supabase'

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
    efficiency:   Math.round(100 - Number(r.utilization ?? 0)),
    status:       r.status,
  }))
}

// Recompute per-machine current_load from a schedule using duration-based utilization
function computeMachineLoads(machines: Machine[], schedule: ScheduleItem[]): Machine[] {
  const WORKDAY_MIN = 8 * 60  // 480 minutes (09:00–17:00)
  const minutesByMachine = new Map<string, number>()

  for (const item of schedule) {
    if (!item.machine || !item.start || !item.end || item.status === 'blocked') continue
    const [sh, sm] = item.start.split(':').map(Number)
    const [eh, em] = item.end.split(':').map(Number)
    const dur = Math.max(0, eh * 60 + em - (sh * 60 + sm))
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
  loading:      boolean
  error:        string | null
  lastUpdated:  Date | null
  whatIfResult: WhatIfResult | null
  sessionId:    string

  // Actions
  loadFromDatabase:   (companyId: string) => Promise<void>
  generateSchedule:   () => Promise<void>
  submitShiftLog:     (log: ShiftLogInsert) => Promise<void>
  loadShiftContext:   (companyId: string) => Promise<void>
  runWhatIf:          (scenario: Record<string, unknown>) => Promise<void>
  clearWhatIf:        () => void
  clearError:         () => void
  // Legacy (kept for backward-compat with WhatIfPanel / Simulation page)
  seed:               () => Promise<void>
  loadSupportData:    () => Promise<void>
  refreshAll:         () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  schedule:     [],
  summary:      { on_track: 0, delayed: 0, blocked: 0, total: 0 },
  machines:     [],
  inventory:    [],
  alerts:       [],
  orders:       [],
  shiftContext: null,
  loading:      false,
  error:        null,
  lastUpdated:  null,
  whatIfResult: null,
  sessionId:    Math.random().toString(36).slice(2, 10),

  // ── Primary: load live data from Supabase ─────────────────
  loadFromDatabase: async (companyId: string) => {
    set({ loading: true, error: null })
    try {
      const [machinesRes, inventoryRes, ordersRes] = await Promise.all([
        supabase.from('machines').select('*').eq('company_id', companyId).order('machine_code'),
        supabase.from('inventory').select('*').eq('company_id', companyId).order('material_name'),
        supabase.from('orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      ])

      const machineRows  = (machinesRes.data  ?? []) as MachineRow[]
      const inventoryRows = (inventoryRes.data ?? []) as InventoryRow[]
      const orderRows    = (ordersRes.data    ?? []) as OrderRow[]

      const machines  = mapMachines(machineRows)
      const inventory = mapInventory(inventoryRows)
      const orders    = orderRows as unknown as Order[]

      // Use existing orders as a schedule placeholder until AI schedule is generated
      const existingSchedule = get().schedule
      const schedule = existingSchedule.length > 0
        ? existingSchedule
        : mapOrdersToSchedule(orderRows)

      // Derive summary from order statuses (before schedule generation)
      const summary: ScheduleSummary = {
        total:    orderRows.length,
        on_track: orderRows.filter(o => o.status === 'in_progress' || o.status === 'pending').length,
        delayed:  0,
        blocked:  orderRows.filter(o => o.status === 'blocked').length,
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

  // ── Client-side schedule generation from Supabase data ──────
  generateSchedule: async () => {
    set({ loading: true, error: null })
    try {
      const { orders, machines, inventory } = get()

      if (orders.length === 0 || machines.length === 0) {
        set({ error: 'Upload orders and machines before generating a schedule.' })
        return
      }

      const WORKDAY_START = 9 * 60   // 09:00 in minutes
      const WORKDAY_END   = 17 * 60  // 17:00 in minutes

      const fmtTime = (totalMin: number): string => {
        const h   = Math.floor(totalMin / 60)
        const min = totalMin % 60
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      }

      // Seed each machine's next-available slot at workday start
      const machineNextSlot = new Map<string, number>()
      for (const m of machines) {
        machineNextSlot.set(m.machine_id, WORKDAY_START)
      }

      // Priority sort: urgent → high → normal → low, then by deadline
      const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
      const sorted = [...orders].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 2
        const pb = PRIORITY_ORDER[b.priority] ?? 2
        if (pa !== pb) return pa - pb
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        return 0
      })

      const schedule: ScheduleItem[] = []

      for (const order of sorted) {
        const reqType = (order.required_machine_type ?? '').toLowerCase().trim()

        // Find machines matching the required type
        const matching = machines.filter(m =>
          reqType && (m.machine_type ?? '').toLowerCase().trim() === reqType
        )

        if (matching.length === 0) {
          schedule.push({
            order:   order.order_code,
            machine: null,
            start:   null,
            end:     null,
            status:  'blocked',
            reason:  order.required_machine_type
              ? `No ${order.required_machine_type} available`
              : 'No required machine type specified',
          })
          continue
        }

        // Prefer non-maintenance machines; fall back to maintenance if that's all there is
        const active = matching.filter(m => m.status !== 'maintenance' && m.status !== 'down')
        const candidates = active.length > 0 ? active : matching.filter(m => m.status !== 'down')

        if (candidates.length === 0) {
          schedule.push({
            order:   order.order_code,
            machine: null,
            start:   null,
            end:     null,
            status:  'blocked',
            reason:  `All ${order.required_machine_type} machines are down`,
          })
          continue
        }

        // Pick the machine with the earliest free slot
        const machine = candidates.reduce((best, m) =>
          (machineNextSlot.get(m.machine_id) ?? WORKDAY_START) <
          (machineNextSlot.get(best.machine_id) ?? WORKDAY_START) ? m : best
        )

        const startMin = machineNextSlot.get(machine.machine_id) ?? WORKDAY_START
        const duration = Math.max(1, order.estimated_duration ?? 60)
        const endMin   = startMin + duration

        const isDelayed     = endMin > WORKDAY_END
        const isMaintenance = machine.status === 'maintenance'

        let reason: string | undefined
        if (isMaintenance) reason = `${machine.machine_id} is under maintenance — schedule may be affected`
        else if (isDelayed) reason = 'Scheduled beyond workday end'

        schedule.push({
          order:   order.order_code,
          machine: machine.machine_id,
          start:   fmtTime(startMin),
          end:     fmtTime(endMin),
          status:  isMaintenance || isDelayed ? 'delayed' : 'scheduled',
          delay:   isMaintenance || isDelayed,
          reason,
        })

        machineNextSlot.set(machine.machine_id, endMin)
      }

      const summary: ScheduleSummary = {
        total:    orders.length,
        on_track: schedule.filter(s => s.status === 'scheduled').length,
        delayed:  schedule.filter(s => s.status === 'delayed').length,
        blocked:  schedule.filter(s => s.status === 'blocked').length,
      }

      const updatedMachines = computeMachineLoads(machines, schedule)

      set({
        schedule,
        summary,
        machines: updatedMachines,
        alerts: deriveAlerts(schedule, updatedMachines, inventory),
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Schedule generation failed' })
    } finally {
      set({ loading: false })
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
  runWhatIf: async (scenario) => {
    set({ loading: true, error: null })
    try {
      const resp = await api.runWhatIf(get().schedule, scenario)
      set({ whatIfResult: resp.data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Simulation failed' })
    } finally {
      set({ loading: false })
    }
  },

  clearWhatIf: () => set({ whatIfResult: null }),
  clearError:  () => set({ error: null }),

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
      const { schedule, summary } = sResp.data
      set({
        machines,
        inventory,
        schedule,
        summary,
        alerts: deriveAlerts(schedule, machines, inventory),
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Refresh failed' })
    } finally {
      set({ loading: false })
    }
  },
}))
