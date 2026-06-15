import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

// ── Step metadata ──────────────────────────────────────────────
const STEPS = [
  {
    key:      'employees',
    title:    'Upload Employees',
    subtitle: 'Import your workforce from a CSV file.',
    icon:     '👥',
    columns:  [
      'employee_id', 'name', 'email', 'department',
      'role', 'shift', 'skill_level', 'phone',
    ],
    note: 'Accounts are created automatically with default password: employee123',
  },
  {
    key:      'machines',
    title:    'Upload Machines',
    subtitle: 'Register your machine fleet.',
    icon:     '⚙️',
    columns:  [
      'machine_code', 'name', 'type', 'department',
      'capacity_per_hour', 'status', 'maintenance_schedule',
      'operating_cost_per_hour', 'supported_operations',
    ],
    note: 'supported_operations: semicolon-separated (e.g. CNC;Drilling)',
  },
  {
    key:      'inventory',
    title:    'Upload Inventory',
    subtitle: 'Load your current material stock levels.',
    icon:     '📦',
    columns:  [
      'material_code', 'material_name', 'quantity', 'unit',
      'minimum_stock', 'supplier', 'lead_time_days', 'cost', 'storage_location',
    ],
    note: 'quantity and minimum_stock must be numbers',
  },
]

type StepKey = 'employees' | 'machines' | 'inventory'

interface StepResult {
  inserted: number
  errors:   string[]
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={{
                background: i < step  ? '#76b900'
                          : i === step ? 'rgba(118,185,0,0.2)'
                          : 'rgba(255,255,255,0.06)',
                border:     i === step ? '2px solid #76b900' : '2px solid transparent',
                color:      i < step  ? '#030712'
                          : i === step ? '#76b900'
                          : '#4b5563',
              }}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span
              className="text-xs hidden sm:block"
              style={{ color: i === step ? '#76b900' : '#4b5563' }}
            >
              {s.title.split(' ')[1]}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-2 mb-5"
              style={{ background: i < step ? '#76b900' : 'rgba(255,255,255,0.06)' }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function CsvDropzone({
  onFile,
  file,
  accept = '.csv',
}: {
  onFile: (f: File) => void
  file: File | null
  accept?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="cursor-pointer rounded-xl flex flex-col items-center justify-center gap-3 py-10 transition-all"
      style={{
        border:     `2px dashed ${dragging ? '#76b900' : file ? 'rgba(118,185,0,0.4)' : 'rgba(255,255,255,0.12)'}`,
        background: dragging ? 'rgba(118,185,0,0.05)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }}
      />
      {file ? (
        <>
          <span className="text-2xl">✅</span>
          <div className="text-center">
            <p className="text-slate-200 font-medium text-sm">{file.name}</p>
            <p className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
          </div>
        </>
      ) : (
        <>
          <span className="text-3xl text-slate-600">📄</span>
          <div className="text-center">
            <p className="text-slate-300 text-sm font-medium">Drag & drop CSV here</p>
            <p className="text-slate-500 text-xs">or click to browse</p>
          </div>
        </>
      )}
    </div>
  )
}

export default function Onboarding() {
  const navigate              = useNavigate()
  const { companyId, loading: authLoading } = useAuth()

  const [step,    setStep]    = useState(0)
  const [file,    setFile]    = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, StepResult>>({})

  const current = STEPS[step]

  async function handleUpload() {
    if (!file) { toast.error('Please select a CSV file first'); return }
    if (!companyId) { toast.error('Company not found — please re-login'); return }

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('company_id', companyId)

    try {
      let res
      if (current.key === 'employees') {
        res = await api.uploadEmployeesCsv(formData)
      } else if (current.key === 'machines') {
        res = await api.uploadMachinesCsv(formData)
      } else {
        res = await api.uploadInventoryCsv(formData)
      }

      const { inserted, errors } = res.data
      setResults(prev => ({ ...prev, [current.key]: { inserted, errors } }))

      if (errors.length > 0) {
        toast.error(`${inserted} rows inserted. ${errors.length} errors — check console.`)
        console.error('Upload errors:', errors)
      } else {
        toast.success(`${inserted} ${current.key} imported successfully!`)
      }

      goNext()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    toast(`Skipped ${current.title}`, { icon: '⏭' })
    goNext()
  }

  function goNext() {
    setFile(null)
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      toast.success('Factory setup complete! Welcome to ForgeFlow AI.')
      navigate('/dashboard')
    }
  }

  if (authLoading) return null

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-12"
      style={{ background: '#030712' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-3xl font-black tracking-tight" style={{ color: '#76b900' }}>ForgeFlow</span>
          <span className="text-3xl font-light text-slate-300"> AI</span>
          <p className="text-slate-400 text-sm mt-2">Factory Setup · Step {step + 1} of {STEPS.length}</p>
        </div>

        {/* Progress */}
        <ProgressBar step={step} />

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-8"
            style={{
              background:     'rgba(17, 24, 39, 0.9)',
              border:         '1px solid rgba(118,185,0,0.15)',
              boxShadow:      '0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Step header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(118,185,0,0.12)', border: '1px solid rgba(118,185,0,0.25)' }}
              >
                {current.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">{current.title}</h2>
                <p className="text-slate-400 text-xs">{current.subtitle}</p>
              </div>
            </div>

            {/* Expected columns */}
            <div
              className="rounded-lg p-3 mb-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-xs text-slate-500 font-medium mb-2">Expected CSV columns:</p>
              <div className="flex flex-wrap gap-1.5">
                {current.columns.map(col => (
                  <span
                    key={col}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(118,185,0,0.1)', color: '#86efac' }}
                  >
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">ℹ {current.note}</p>
            </div>

            {/* Dropzone */}
            <CsvDropzone onFile={setFile} file={file} />

            {/* Result from previous upload */}
            {results[current.key] && (
              <div
                className="mt-3 rounded-lg p-3 text-xs"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}
              >
                ✓ {results[current.key].inserted} records inserted
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="btn btn-ghost flex-1"
              >
                Skip for Now
              </button>
              <motion.button
                onClick={handleUpload}
                disabled={loading || !file}
                whileHover={!loading && file ? { scale: 1.02 } : {}}
                whileTap={!loading && file ? { scale: 0.98 } : {}}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#030712', borderTopColor: 'transparent' }} />
                    Uploading…
                  </span>
                ) : step === STEPS.length - 1 ? 'Upload & Finish' : 'Upload & Continue →'}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Skip all */}
        <p className="text-center text-xs text-slate-600 mt-5">
          <button
            className="hover:text-slate-400 transition-colors underline"
            onClick={() => navigate('/dashboard')}
          >
            Skip setup and go to dashboard
          </button>
        </p>
      </motion.div>
    </div>
  )
}
