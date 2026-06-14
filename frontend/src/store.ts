import { create } from 'zustand'
import { api } from './api'
import type { ScheduleItem, Machine, InventoryItem, Alert, WhatIfResult, ScheduleSummary } from './types'

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

interface AppState {
  schedule: ScheduleItem[]
  summary: ScheduleSummary
  machines: Machine[]
  inventory: InventoryItem[]
  alerts: Alert[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  whatIfResult: WhatIfResult | null
  sessionId: string

  seed: () => Promise<void>
  generateSchedule: () => Promise<void>
  loadSupportData: () => Promise<void>
  refreshAll: () => Promise<void>
  runWhatIf: (scenario: Record<string, unknown>) => Promise<void>
  clearWhatIf: () => void
  clearError: () => void
}

export const useStore = create<AppState>((set, get) => ({
  schedule: [],
  summary: { on_track: 0, delayed: 0, blocked: 0, total: 0 },
  machines: [],
  inventory: [],
  alerts: [],
  loading: false,
  error: null,
  lastUpdated: null,
  whatIfResult: null,
  sessionId: Math.random().toString(36).slice(2, 10),

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

  generateSchedule: async () => {
    set({ loading: true, error: null })
    try {
      const resp = await api.generateSchedule()
      const { schedule, summary } = resp.data
      const { machines, inventory } = get()
      set({ schedule, summary, alerts: deriveAlerts(schedule, machines, inventory), lastUpdated: new Date() })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Schedule generation failed' })
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
      const machines = mResp.data.data
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
  clearError: () => set({ error: null }),
}))
