import axios from 'axios'
import type { ScheduleItem, Machine, InventoryItem, WhatIfResult, ScheduleSummary } from './types'

interface ScheduleResponse {
  status: string
  schedule: ScheduleItem[]
  count: number
  summary: ScheduleSummary
}

interface DataResponse<T> {
  data_type: string
  total_rows: number
  data: T[]
}

interface CopilotResponse {
  response: string
  session_id: string
}

export const api = {
  seed: () =>
    axios.post<{ status: string; loaded: string[]; errors: string[] }>('/api/v1/seed'),

  generateSchedule: (params?: Partial<{ workday_start: string; workday_end: string; default_duration_minutes: number }>) =>
    axios.post<ScheduleResponse>('/api/v1/schedule', params ?? {}),

  getMachines: () =>
    axios.get<DataResponse<Machine>>('/api/v1/data/machines'),

  getInventory: () =>
    axios.get<DataResponse<InventoryItem>>('/api/v1/data/inventory'),

  getOrders: () =>
    axios.get<DataResponse<Record<string, unknown>>>('/api/v1/data/orders'),

  runWhatIf: (schedule: ScheduleItem[], scenario: Record<string, unknown>) =>
    axios.post<WhatIfResult>('/api/v1/whatif', { schedule, scenario }),

  copilotChat: (message: string, schedule: ScheduleItem[], sessionId: string) =>
    axios.post<CopilotResponse>('/copilot/chat', {
      message,
      schedule,
      session_id: sessionId,
      use_nim: true,
    }),
}
