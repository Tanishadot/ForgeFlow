import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../services/supabase'
import { api } from '../api'

const INDUSTRIES = [
  'Automotive', 'Aerospace', 'Electronics', 'Food & Beverage',
  'Pharmaceuticals', 'Metal Fabrication', 'Plastics', 'Textiles', 'Other',
]

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
]

const FACTORY_SIZES = [
  { value: 'small',      label: 'Small',      desc: '< 50 employees' },
  { value: 'medium',     label: 'Medium',     desc: '50–500 employees' },
  { value: 'enterprise', label: 'Enterprise', desc: '500+ employees' },
]

const SHIFT_OPTIONS = [
  { value: '1', label: '1 Shift' },
  { value: '2', label: '2 Shifts' },
  { value: '3', label: '3 Shifts' },
  { value: 'custom', label: 'Custom' },
]

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all text-center"
      style={{
        background: selected ? 'rgba(118,185,0,0.15)' : 'rgba(255,255,255,0.04)',
        border:     `1px solid ${selected ? '#76b900' : 'rgba(255,255,255,0.08)'}`,
        color:      selected ? '#76b900' : '#94a3b8',
      }}
    >
      {children}
    </button>
  )
}

export default function Signup() {
  const navigate = useNavigate()

  // Company fields
  const [companyName,  setCompanyName]  = useState('')
  const [industry,     setIndustry]     = useState('')
  const [location,     setLocation]     = useState('')
  const [timezone,     setTimezone]     = useState('UTC')
  const [factorySize,  setFactorySize]  = useState('small')
  const [numShifts,    setNumShifts]    = useState('1')
  // Admin fields
  const [adminName,    setAdminName]    = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [show,         setShow]         = useState(false)
  const [loading,      setLoading]      = useState(false)

  function validate(): string | null {
    if (!companyName.trim())               return 'Company name is required'
    if (!industry)                         return 'Industry is required'
    if (!location.trim())                  return 'Location is required'
    if (!adminName.trim())                 return 'Admin name is required'
    if (!email.trim())                     return 'Admin email is required'
    if (!/\S+@\S+\.\S+/.test(email))       return 'Enter a valid email address'
    if (password.length < 8)               return 'Password must be at least 8 characters'
    if (password !== confirm)              return 'Passwords do not match'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { toast.error(err); return }

    setLoading(true)

    // 1. Create Supabase auth user
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: adminName } },
    })

    if (signUpErr) {
      toast.error(signUpErr.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      toast.error('Account creation failed. Please try again.')
      setLoading(false)
      return
    }

    // 2. Create company + profile + employee via backend (service-role key bypasses RLS)
    try {
      await api.completeSignup({
        user_id:      authData.user.id,
        admin_name:   adminName,
        email,
        company_name: companyName,
        industry,
        location,
        timezone,
        factory_size: factorySize,
        num_shifts:   numShifts,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to set up company. Is the backend running?')
      setLoading(false)
      return
    }

    // 3. Explicitly sign in so we always have an active session
    //    (signUp alone does not create a session when email confirmation is ON)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (signInErr) {
      // Email confirmation is required — company is created, user just needs to confirm
      toast('Account created! Check your email to confirm, then log in.', {
        icon: '📧',
        duration: 8000,
      })
      navigate('/login')
      return
    }

    toast.success(`Welcome to ForgeFlow AI, ${adminName}! Let's set up your factory.`)
    navigate('/onboarding')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-12"
      style={{ background: '#030712' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="text-3xl font-black tracking-tight" style={{ color: '#76b900' }}>ForgeFlow</span>
            <span className="text-3xl font-light text-slate-300"> AI</span>
          </Link>
          <p className="text-slate-500 text-sm mt-2">Create your company account</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background:     'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(20px)',
            border:         '1px solid rgba(118,185,0,0.15)',
            boxShadow:      '0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#76b900' }}>
            Company Information
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Company Name</label>
              <input
                type="text"
                className="input"
                placeholder="Acme Manufacturing Ltd."
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Industry */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Industry</label>
                <select
                  className="input"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Detroit, MI"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Timezone</label>
              <select
                className="input"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            {/* Factory Size */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Factory Size</label>
              <div className="flex gap-2">
                {FACTORY_SIZES.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={factorySize === opt.value}
                    onClick={() => setFactorySize(opt.value)}
                  >
                    <span className="block font-semibold">{opt.label}</span>
                    <span className="block text-slate-500 font-normal" style={{ fontSize: '10px' }}>{opt.desc}</span>
                  </OptionButton>
                ))}
              </div>
            </div>

            {/* Number of Shifts */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Number of Shifts</label>
              <div className="flex gap-2">
                {SHIFT_OPTIONS.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={numShifts === opt.value}
                    onClick={() => setNumShifts(opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#76b900' }}>
                Admin Account
              </p>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Your Name</label>
              <input
                type="text"
                className="input"
                placeholder="Jane Smith"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Admin Email</label>
              <input
                type="email"
                className="input"
                placeholder="admin@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Password */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min. 8 chars"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    tabIndex={-1}
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Confirm Password</label>
                <input
                  type={show ? 'text' : 'password'}
                  className="input"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 20px rgba(118,185,0,0.35)' } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              className="btn btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#030712', borderTopColor: 'transparent' }} />
                  Creating account…
                </span>
              ) : 'Create Company Account →'}
            </motion.button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:text-slate-200 transition-colors" style={{ color: '#76b900' }}>
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
