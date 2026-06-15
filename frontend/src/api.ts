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
  reply: string
  response: string
  session_id: string
  provider: string
  status: string
  errors: string[]
}

interface EmployeeEmailResponse {
  email: string | null
  found: boolean
}

interface OnboardingUploadResponse {
  status: string
  inserted: number
  errors: string[]
}

interface ShiftSummaryResponse {
  summary: string
  status: string
}

interface CompleteSignupRequest {
  user_id:      string
  admin_name:   string
  email:        string
  company_name: string
  industry:     string
  location:     string
  timezone:     string
  factory_size: string
  num_shifts:   string
}

interface CompleteSignupResponse {
  company_id: string
  ok:         boolean
}

export const api = {
  // ── Legacy schedule / what-if (backend agents) ─────────────
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

  // ── Auth helpers ────────────────────────────────────────────
  lookupEmployeeEmail: (employeeId: string) =>
    axios.get<EmployeeEmailResponse>(`/api/v1/auth/employee-email`, {
      params: { employee_id: employeeId },
    }),

  completeSignup: (body: CompleteSignupRequest) =>
    axios.post<CompleteSignupResponse>('/api/v1/auth/complete-signup', body),

  // ── Onboarding / CSV upload ─────────────────────────────────
  uploadEmployeesCsv: (formData: FormData) =>
    axios.post<OnboardingUploadResponse>('/api/v1/onboarding/employees', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  uploadMachinesCsv: (formData: FormData) =>
    axios.post<OnboardingUploadResponse>('/api/v1/onboarding/machines', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  uploadInventoryCsv: (formData: FormData) =>
    axios.post<OnboardingUploadResponse>('/api/v1/onboarding/inventory', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  uploadOrdersCsv: (formData: FormData) =>
    axios.post<OnboardingUploadResponse>('/api/v1/onboarding/orders', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // ── AI Shift Summary ─────────────────────────────────────────
  generateShiftSummary: (companyId: string, logs: Array<{ shift: string | null; notes: string; created_at: string }>) =>
    axios.post<ShiftSummaryResponse>('/api/v1/shift/summarize', { company_id: companyId, logs }),
}
