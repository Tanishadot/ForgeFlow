import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'

export default function ChangePassword() {
  const navigate = useNavigate()
  const { user }  = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [show,        setShow]        = useState(false)
  const [loading,     setLoading]     = useState(false)

  function validate(): string | null {
    if (newPassword.length < 8) return 'Password must be at least 8 characters'
    if (newPassword !== confirm) return 'Passwords do not match'
    if (newPassword === 'employee123') return 'Please choose a different password from the default'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { toast.error(err); return }

    setLoading(true)

    // Update password via Supabase Auth
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword })
    if (pwErr) {
      toast.error(pwErr.message)
      setLoading(false)
      return
    }

    // Clear password_reset_required in profile
    if (user) {
      await supabase
        .from('profiles')
        .update({ password_reset_required: false })
        .eq('id', user.id)

      // Also update employees table
      await supabase
        .from('employees')
        .update({ password_reset_required: false })
        .eq('auth_user_id', user.id)
    }

    setLoading(false)
    toast.success('Password updated successfully!')
    navigate('/dashboard', { replace: true })
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
          <span className="text-3xl font-black tracking-tight" style={{ color: '#76b900' }}>ForgeFlow</span>
          <span className="text-3xl font-light text-slate-300"> AI</span>
          <p className="text-slate-500 text-sm mt-2">Set your new password</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background:     'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(20px)',
            border:         '1px solid rgba(118,185,0,0.15)',
            boxShadow:      '0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Info banner */}
          <div
            className="rounded-lg p-3 mb-5 text-xs"
            style={{ background: 'rgba(118,185,0,0.08)', border: '1px solid rgba(118,185,0,0.2)', color: '#86efac' }}
          >
            🔑 Your account requires a password change before you can continue.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">New Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  autoFocus
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

            {/* Confirm Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Confirm Password</label>
              <input
                type={show ? 'text' : 'password'}
                className="input"
                placeholder="Repeat new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirm && newPassword !== confirm && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Strength indicator */}
            {newPassword && (
              <div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className="flex-1 h-1 rounded-full transition-all"
                      style={{
                        background:
                          newPassword.length >= n * 3
                            ? n <= 2 ? '#f97316' : '#76b900'
                            : 'rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {newPassword.length < 8 ? 'Too short' : newPassword.length < 12 ? 'Good' : 'Strong'}
                </p>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 20px rgba(118,185,0,0.35)' } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              className="btn btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#030712', borderTopColor: 'transparent' }} />
                  Saving…
                </span>
              ) : 'Set New Password →'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
