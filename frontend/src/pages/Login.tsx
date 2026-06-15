import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../services/supabase'
import { api } from '../api'

type LoginType = 'admin' | 'employee'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from     = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [loginType,   setLoginType]   = useState<LoginType>('employee')

  // Admin fields
  const [adminEmail,    setAdminEmail]    = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  // Employee fields
  const [employeeId, setEmployeeId] = useState('')
  const [empPassword, setEmpPassword] = useState('')

  const [show,    setShow]    = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!adminEmail.trim()) { toast.error('Email is required'); return }
    if (!adminPassword)     { toast.error('Password is required'); return }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email:    adminEmail.trim(),
      password: adminPassword,
    })
    setLoading(false)

    if (error) { toast.error(error.message); return }

    toast.success('Welcome back!')
    navigate(from, { replace: true })
  }

  async function handleEmployeeLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId.trim()) { toast.error('Employee ID is required'); return }
    if (!empPassword)       { toast.error('Password is required'); return }

    setLoading(true)

    // 1. Resolve employee_id → email via backend
    let email: string | null = null
    try {
      const resp = await api.lookupEmployeeEmail(employeeId.trim())
      email = resp.data.email
    } catch {
      try {
        const { data } = await supabase.rpc('get_employee_auth_email', {
          p_employee_id: employeeId.trim(),
        })
        email = data as string | null
      } catch {
        toast.error('Could not verify Employee ID. Check your connection.')
        setLoading(false)
        return
      }
    }

    if (!email) {
      toast.error('Employee ID not found. Contact your admin.')
      setLoading(false)
      return
    }

    // 2. Sign in
    const { error } = await supabase.auth.signInWithPassword({ email, password: empPassword })
    setLoading(false)

    if (error) { toast.error(error.message); return }

    // 3. Check for forced password reset
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('password_reset_required')
        .eq('id', user.id)
        .single()

      if (profile?.password_reset_required) {
        toast('Please set a new password before continuing.', { icon: '🔑' })
        navigate('/change-password', { replace: true })
        return
      }
    }

    toast.success('Welcome back!')
    navigate(from, { replace: true })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#030712' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="text-3xl font-black tracking-tight" style={{ color: '#76b900' }}>ForgeFlow</span>
            <span className="text-3xl font-light text-slate-300"> AI</span>
          </Link>
          <p className="text-slate-500 text-sm mt-2">Sign in to your workspace</p>
        </div>

        {/* Login type selector */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {(['admin', 'employee'] as LoginType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => { setLoginType(type); setShow(false) }}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: loginType === type
                  ? 'rgba(118,185,0,0.12)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${loginType === type ? 'rgba(118,185,0,0.5)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="text-lg mb-1">{type === 'admin' ? '🏢' : '👷'}</div>
              <div
                className="text-sm font-semibold"
                style={{ color: loginType === type ? '#76b900' : '#cbd5e1' }}
              >
                {type === 'admin' ? 'Company Admin' : 'Employee'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {type === 'admin' ? 'Email & password' : 'Employee ID & password'}
              </div>
            </button>
          ))}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background:     'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(20px)',
            border:         '1px solid rgba(118,185,0,0.15)',
            boxShadow:      '0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          <AnimatePresence mode="wait">
            {loginType === 'admin' ? (
              <motion.form
                key="admin"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleAdminLogin}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="admin@company.com"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      required
                      autoComplete="current-password"
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

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 20px rgba(118,185,0,0.35)' } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="btn btn-primary w-full py-2.5 mt-1"
                >
                  {loading ? <Spinner /> : 'Sign In as Admin'}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="employee"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleEmployeeLogin}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Employee ID</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. EMP-001"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={empPassword}
                      onChange={e => setEmpPassword(e.target.value)}
                      required
                      autoComplete="current-password"
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
                  <p className="text-xs text-slate-600 mt-1">Default password for new accounts: employee123</p>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 20px rgba(118,185,0,0.35)' } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="btn btn-primary w-full py-2.5 mt-1"
                >
                  {loading ? <Spinner /> : 'Sign In as Employee'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-center text-xs text-slate-500">
              New company?{' '}
              <Link to="/signup" className="font-semibold hover:text-slate-200 transition-colors" style={{ color: '#76b900' }}>
                Create account
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span
        className="w-4 h-4 border-2 rounded-full animate-spin"
        style={{ borderColor: '#030712', borderTopColor: 'transparent' }}
      />
      Signing in…
    </span>
  )
}
