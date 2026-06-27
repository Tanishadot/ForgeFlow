import React, { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

interface Employee {
  employee_id: string
  name:        string | null
  email:       string
  department:  string | null
  role:        string
  shift:       string | null
  skill_level: string | null
}

interface MachineRow {
  machine_code: string
  name:         string | null
  type:         string | null
  department:   string | null
  status:       string
}

const SHIFT_TIMES: Record<string, string> = {
  '1': '09:00–17:00',
  '2': '17:00–01:00',
  '3': '01:00–09:00',
  'morning':   '06:00–14:00',
  'afternoon': '14:00–22:00',
  'night':     '22:00–06:00',
}

function resolveShift(raw: string | null): string {
  if (!raw) return '—'
  const key = raw.trim().toLowerCase().replace(/^shift\s*/i, '')
  return SHIFT_TIMES[key] ?? SHIFT_TIMES[raw.toLowerCase()] ?? raw
}

function StatusDot({ status }: { status: string }) {
  const s = status.toLowerCase()
  const [color, label] =
    s === 'running' || s === 'active'  ? ['#22c55e', 'Running'] :
    s === 'idle'                        ? ['#94a3b8', 'Idle']    :
    s === 'down' || s === 'maintenance' ? ['#ef4444', s.charAt(0).toUpperCase() + s.slice(1)] :
                                          ['#6b7280', status]
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {label}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-slate-500 text-sm">{message}</div>
  )
}

export default function Workforce() {
  const { companyId }                           = useAuth()
  const { canEditWorkforce, canAssignEmployees } = usePermissions()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [machines,  setMachines]  = useState<MachineRow[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!companyId) return

    Promise.all([
      supabase
        .from('employees')
        .select('employee_id, name, email, department, role, shift, skill_level')
        .eq('company_id', companyId)
        .order('name'),
      supabase
        .from('machines')
        .select('machine_code, name, type, department, status')
        .eq('company_id', companyId)
        .order('machine_code'),
    ]).then(([empRes, machRes]) => {
      setEmployees((empRes.data as Employee[])    || [])
      setMachines ((machRes.data as MachineRow[]) || [])
      setLoading(false)
    })
  }, [companyId])

  const roleChip = (role: string) => {
    const colors: Record<string, [string, string]> = {
      admin:    ['rgba(239,68,68,0.15)',   '#fca5a5'],
      manager:  ['rgba(59,130,246,0.15)',  '#93c5fd'],
      employee: ['rgba(100,116,139,0.12)', '#94a3b8'],
    }
    const [bg, text] = colors[role] ?? colors.employee
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
        style={{ background: bg, color: text }}
      >
        {role}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-6xl">

      {/* Page header */}
      <div className="panel p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-100">Workforce</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Today's shift assignments, machine operators, and employee roster
          </p>
        </div>
        {canEditWorkforce && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm text-xs">+ Assign Employee</button>
            <button className="btn btn-primary btn-sm text-xs">+ Create Shift</button>
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>

        {/* ── Machine Assignments ─────────────────────────────────────────── */}
        <div className="panel p-4 flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            Machine Assignments
            <span className="text-xs text-slate-600 font-normal">{machines.length} machines</span>
          </h2>

          {loading ? (
            <EmptyState message="Loading…" />
          ) : machines.length === 0 ? (
            <EmptyState message="No machines loaded. Upload machine data from the Admin panel." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Type</th>
                  <th>Dept</th>
                  <th>Status</th>
                  {canAssignEmployees && <th></th>}
                </tr>
              </thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.machine_code}>
                    <td>
                      <span className="font-mono font-semibold text-slate-200">
                        {m.machine_code}
                      </span>
                      {m.name && m.name !== m.machine_code && (
                        <div className="text-xs text-slate-500">{m.name}</div>
                      )}
                    </td>
                    <td className="text-slate-400">{m.type ?? '—'}</td>
                    <td className="text-slate-400">{m.department ?? '—'}</td>
                    <td><StatusDot status={m.status} /></td>
                    {canAssignEmployees && (
                      <td>
                        <button
                          className="btn btn-ghost btn-sm text-xs"
                          style={{ padding: '2px 8px' }}
                          title="Assign operator"
                        >
                          Assign
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Employee Roster ──────────────────────────────────────────────── */}
        <div className="panel p-4 flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            Employee Roster
            <span className="text-xs text-slate-600 font-normal">{employees.length} employees</span>
          </h2>

          {loading ? (
            <EmptyState message="Loading…" />
          ) : employees.length === 0 ? (
            <EmptyState message="No employees loaded. Upload employee data from the Admin panel." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Shift</th>
                  <th>Role</th>
                  {canEditWorkforce && <th></th>}
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.employee_id}>
                    <td>
                      <div className="font-medium text-slate-200">
                        {e.name ?? e.employee_id}
                      </div>
                      <div className="text-xs text-slate-500">{e.employee_id}</div>
                    </td>
                    <td className="text-slate-400 text-sm">{e.department ?? '—'}</td>
                    <td className="text-slate-400 text-sm font-mono">
                      {resolveShift(e.shift)}
                    </td>
                    <td>{roleChip(e.role)}</td>
                    {canEditWorkforce && (
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-sm text-xs"
                            style={{ padding: '2px 8px' }}
                            title="Edit employee"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-xs"
                            style={{ padding: '2px 8px', color: '#ef4444' }}
                            title="Remove from shift"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Shift legend — visible to all */}
      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Shift Schedule</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Shift 1', time: '09:00–17:00', key: '1' },
            { label: 'Shift 2', time: '17:00–01:00', key: '2' },
            { label: 'Shift 3', time: '01:00–09:00', key: '3' },
          ].map(shift => {
            const count = employees.filter(e => {
              const k = (e.shift ?? '').trim().toLowerCase().replace(/^shift\s*/i, '')
              return k === shift.key
            }).length
            return (
              <div
                key={shift.key}
                className="rounded-lg p-3"
                style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {shift.label}
                </div>
                <div className="text-sm font-mono text-slate-300">{shift.time}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {count > 0 ? `${count} employee${count !== 1 ? 's' : ''}` : 'No assignments'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
