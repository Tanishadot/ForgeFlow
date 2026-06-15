import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../services/supabase'
import { useStore } from '../store'
import { api } from '../api'

// ── Constants ──────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Automotive', 'Aerospace', 'Electronics', 'Food & Beverage',
  'Pharmaceuticals', 'Metal Fabrication', 'Plastics', 'Textiles', 'Other',
]
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
]
const FACTORY_SIZES = ['small', 'medium', 'enterprise']
const SHIFT_OPTS    = ['1', '2', '3', 'custom']

const TEMPLATES = {
  employees: {
    file:    'forgeflow_employees.csv',
    label:   'Employees',
    icon:    '👥',
    headers: ['employee_id','name','email','department','role','shift','skill_level','phone'],
  },
  machines: {
    file:    'forgeflow_machines.csv',
    label:   'Machines',
    icon:    '⚙️',
    headers: ['machine_code','name','type','department','capacity_per_hour','status','maintenance_schedule','operating_cost_per_hour','supported_operations'],
  },
  inventory: {
    file:    'forgeflow_inventory.csv',
    label:   'Inventory',
    icon:    '📦',
    headers: ['material_code','material_name','quantity','unit','minimum_stock','supplier','lead_time_days','cost','storage_location'],
  },
  orders: {
    file:    'forgeflow_orders.csv',
    label:   'Orders',
    icon:    '📋',
    headers: ['order_code','customer_name','product_name','quantity','priority','deadline','required_machine_type','estimated_duration','status'],
  },
}

type UploadType = keyof typeof TEMPLATES

interface CompanyDetails {
  id:           string
  company_name: string
  industry:     string | null
  location:     string | null
  timezone:     string
  factory_size: string
  num_shifts:   string
}

interface Counts {
  employees: number
  machines:  number
  inventory: number
  orders:    number
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Pill({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: selected ? 'rgba(118,185,0,0.18)' : 'rgba(255,255,255,0.04)',
        border:     `1px solid ${selected ? '#76b900' : 'rgba(255,255,255,0.08)'}`,
        color:      selected ? '#76b900' : '#94a3b8',
      }}
    >
      {children}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  companyId: string
}

export default function AdminSetupDashboard({ companyId }: Props) {
  const { loadFromDatabase } = useStore()

  const [company,   setCompany]   = useState<CompanyDetails | null>(null)
  const [counts,    setCounts]    = useState<Counts>({ employees: 0, machines: 0, inventory: 0, orders: 0 })
  const [editMode,  setEditMode]  = useState(false)
  const [edit,      setEdit]      = useState<Partial<CompanyDetails>>({})
  const [uploading, setUploading] = useState<UploadType | null>(null)
  const [saving,    setSaving]    = useState(false)

  const refs: Record<UploadType, React.RefObject<HTMLInputElement>> = {
    employees: useRef<HTMLInputElement>(null),
    machines:  useRef<HTMLInputElement>(null),
    inventory: useRef<HTMLInputElement>(null),
    orders:    useRef<HTMLInputElement>(null),
  }

  useEffect(() => { fetchAll() }, [companyId])

  async function fetchAll() {
    const [compRes, empRes, machRes, invRes, ordRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', companyId).single(),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('machines') .select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('orders')   .select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    ])

    if (compRes.data) {
      const c = compRes.data as CompanyDetails
      setCompany(c)
      setEdit({
        company_name: c.company_name,
        industry:     c.industry ?? '',
        location:     c.location ?? '',
        timezone:     c.timezone,
        factory_size: c.factory_size ?? 'small',
        num_shifts:   c.num_shifts   ?? '1',
      })
    }

    setCounts({
      employees: empRes.count ?? 0,
      machines:  machRes.count ?? 0,
      inventory: invRes.count ?? 0,
      orders:    ordRes.count ?? 0,
    })
  }

  function downloadTemplate(type: UploadType) {
    const tpl = TEMPLATES[type]
    const blob = new Blob([tpl.headers.join(',') + '\n'], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = tpl.file
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${tpl.file}`)
  }

  async function handleFile(type: UploadType, file: File) {
    setUploading(type)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('company_id', companyId)

    try {
      let res
      if      (type === 'employees') res = await api.uploadEmployeesCsv(fd)
      else if (type === 'machines')  res = await api.uploadMachinesCsv(fd)
      else if (type === 'inventory') res = await api.uploadInventoryCsv(fd)
      else                           res = await api.uploadOrdersCsv(fd)

      const { inserted, errors } = res.data
      if (errors.length > 0) {
        toast.error(`${inserted} inserted · ${errors.length} errors`)
        console.error(errors)
      } else {
        toast.success(`${inserted} ${TEMPLATES[type].label.toLowerCase()} imported!`)
      }
      await fetchAll()
      await loadFromDatabase(companyId)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed — is the backend running?')
    } finally {
      setUploading(null)
    }
  }

  async function saveSettings() {
    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({
        company_name: edit.company_name,
        industry:     edit.industry   || null,
        location:     edit.location   || null,
        timezone:     edit.timezone,
        factory_size: edit.factory_size,
        num_shifts:   edit.num_shifts,
      })
      .eq('id', companyId)
    setSaving(false)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      toast.success('Company settings saved!')
      setEditMode(false)
      await fetchAll()
    }
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const checklist = [
    { key: 'company',   label: 'Company Details',    done: true },
    { key: 'employees', label: 'Employees Uploaded',  done: counts.employees > 0 },
    { key: 'machines',  label: 'Machines Uploaded',   done: counts.machines  > 0 },
    { key: 'inventory', label: 'Inventory Uploaded',  done: counts.inventory > 0 },
    { key: 'orders',    label: 'Orders Uploaded',     done: counts.orders    > 0 },
  ]
  const doneCount  = checklist.filter(i => i.done).length
  const progressPct = Math.round((doneCount / checklist.length) * 100)

  const uploadCards: { type: UploadType; label: string; icon: string; count: number }[] = [
    { type: 'employees', label: 'Employees', icon: '👥', count: counts.employees },
    { type: 'machines',  label: 'Machines',  icon: '⚙️', count: counts.machines  },
    { type: 'inventory', label: 'Inventory', icon: '📦', count: counts.inventory },
    { type: 'orders',    label: 'Orders',    icon: '📋', count: counts.orders    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 pb-6"
    >
      {/* ── Section 1: Company Overview ──────────────────────────────────── */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#111827', border: '1px solid rgba(118,185,0,0.18)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏭</span>
              <h2 className="text-lg font-bold text-slate-100">
                {company?.company_name ?? '—'}
              </h2>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {[
                company?.industry,
                company?.location,
                company?.timezone,
                company?.factory_size
                  ? company.factory_size.charAt(0).toUpperCase() + company.factory_size.slice(1) + ' factory'
                  : null,
                company?.num_shifts
                  ? (company.num_shifts === 'custom' ? 'Custom shifts' : `${company.num_shifts} shift${company.num_shifts === '1' ? '' : 's'}`)
                  : null,
              ].filter(Boolean).map((v, i) => (
                <span key={i} className="text-xs text-slate-400">{v}</span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setEditMode(e => !e)}
            className="btn btn-ghost btn-sm whitespace-nowrap flex-shrink-0"
          >
            {editMode ? '✕ Cancel' : '✏ Edit Details'}
          </button>
        </div>

        {/* Section 5: Company Settings (inline expand) */}
        <AnimatePresence>
          {editMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-5 pt-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#76b900' }}>
                  Company Settings
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Company Name</label>
                    <input
                      className="input text-sm"
                      value={edit.company_name ?? ''}
                      onChange={e => setEdit(d => ({ ...d, company_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Industry</label>
                    <select
                      className="input text-sm"
                      value={edit.industry ?? ''}
                      onChange={e => setEdit(d => ({ ...d, industry: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Location</label>
                    <input
                      className="input text-sm"
                      value={edit.location ?? ''}
                      onChange={e => setEdit(d => ({ ...d, location: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Timezone</label>
                    <select
                      className="input text-sm"
                      value={edit.timezone ?? 'UTC'}
                      onChange={e => setEdit(d => ({ ...d, timezone: e.target.value }))}
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Factory Size</label>
                  <div className="flex gap-2">
                    {FACTORY_SIZES.map(s => (
                      <Pill
                        key={s}
                        selected={edit.factory_size === s}
                        onClick={() => setEdit(d => ({ ...d, factory_size: s }))}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Number of Shifts</label>
                  <div className="flex gap-2">
                    {SHIFT_OPTS.map(s => (
                      <Pill
                        key={s}
                        selected={edit.num_shifts === s}
                        onClick={() => setEdit(d => ({ ...d, num_shifts: s }))}
                      >
                        {s === 'custom' ? 'Custom' : `${s} Shift${s === '1' ? '' : 's'}`}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditMode(false)} className="btn btn-ghost btn-sm">
                    Cancel
                  </button>
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Section 2: Quick Setup ────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Quick Setup
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {uploadCards.map(card => (
            <div
              key={card.type}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: card.count > 0
                  ? 'rgba(118,185,0,0.07)'
                  : '#111827',
                border: `1px solid ${card.count > 0 ? 'rgba(118,185,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {/* Hidden file input */}
              <input
                ref={refs[card.type]}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(card.type, f)
                  e.target.value = ''
                }}
              />

              <div className="flex items-center justify-between">
                <span className="text-xl">{card.icon}</span>
                {card.count > 0 && (
                  <span className="text-xs font-bold" style={{ color: '#76b900' }}>✓</span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200">{card.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {card.count > 0 ? `${card.count} records` : 'No data yet'}
                </p>
              </div>

              <button
                onClick={() => refs[card.type].current?.click()}
                disabled={uploading === card.type}
                className="btn btn-ghost btn-sm text-xs w-full"
                style={{
                  borderColor: card.count > 0 ? 'rgba(118,185,0,0.3)' : undefined,
                  color:       card.count > 0 ? '#76b900' : undefined,
                }}
              >
                {uploading === card.type ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#76b900', borderTopColor: 'transparent' }} />
                    Uploading…
                  </span>
                ) : card.count > 0 ? 'Re-upload CSV' : 'Upload CSV'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-2">Accepts .csv and .xlsx files</p>
      </div>

      {/* ── Section 3 + 4: Templates + Progress ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* Download Templates */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
            Download Templates
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TEMPLATES) as UploadType[]).map(type => (
              <button
                key={type}
                onClick={() => downloadTemplate(type)}
                className="btn btn-ghost btn-sm text-xs flex items-center gap-1.5 justify-start"
              >
                <span>{TEMPLATES[type].icon}</span>
                <span>{TEMPLATES[type].label}</span>
                <span className="ml-auto text-slate-600">↓</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3">
            Download a CSV with the correct column headers, fill it in, and upload above.
          </p>
        </div>

        {/* Setup Progress */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Setup Progress
            </p>
            <span className="text-sm font-bold" style={{ color: progressPct === 100 ? '#76b900' : '#94a3b8' }}>
              {progressPct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#76b900' }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <div className="space-y-2.5">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center gap-2.5">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                  style={{
                    background: item.done ? 'rgba(118,185,0,0.2)' : 'rgba(255,255,255,0.06)',
                    border:     `1px solid ${item.done ? '#76b900' : 'rgba(255,255,255,0.1)'}`,
                    color:      item.done ? '#76b900' : '#4b5563',
                  }}
                >
                  {item.done ? '✓' : ''}
                </div>
                <span
                  className="text-xs"
                  style={{ color: item.done ? '#e2e8f0' : '#6b7280' }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {progressPct === 100 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg p-3 text-xs text-center font-medium"
              style={{ background: 'rgba(118,185,0,0.12)', color: '#76b900', border: '1px solid rgba(118,185,0,0.25)' }}
            >
              ✓ Factory setup complete! Refresh to see your dashboard.
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
