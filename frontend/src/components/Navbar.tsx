import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import toast from 'react-hot-toast'

const ROLE_COLORS: Record<string, string> = {
  admin:    'rgba(239,68,68,0.15)',
  manager:  'rgba(59,130,246,0.15)',
  employee: 'rgba(100,116,139,0.15)',
}
const ROLE_TEXT: Record<string, string> = {
  admin:    '#fca5a5',
  manager:  '#93c5fd',
  employee: '#94a3b8',
}

function AlertBadge() {
  const alerts = useStore(s => s.alerts)
  const count  = alerts.filter(a => a.severity === 'critical').length
  if (count === 0) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}
    >
      ⛔ {count}
    </span>
  )
}

const NOW = new Date()
const SHIFT_LABEL = NOW.getHours() < 16 ? 'Shift 1 · 09:00–17:00' : 'Shift 2 · 17:00–01:00'

export default function Navbar() {
  const { user, profile, role, companyName, employeeId, signOut } = useAuth()
  const navigate = useNavigate()

  const navCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-nvidia-400 font-semibold border-b-2 border-nvidia-500 pb-0.5'
      : 'text-slate-400 hover:text-slate-200 transition-colors pb-0.5'

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'User'
  const initials    = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      className="flex items-center justify-between px-6 py-3 shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}
    >
      {/* Left: logo + company + shift + alert */}
      <div className="flex items-center gap-3">
        <NavLink to="/dashboard" className="flex items-center gap-1.5">
          <span className="text-nvidia-500 font-black text-xl tracking-tight">ForgeFlow</span>
          <span className="text-slate-300 font-light text-xl">AI</span>
        </NavLink>

        {/* Company name */}
        {companyName && (
          <span
            className="text-xs text-slate-400 border rounded px-2 py-0.5 hidden sm:inline"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            {companyName}
          </span>
        )}

        <span
          className="text-xs text-slate-500 border rounded px-2 py-0.5 hidden md:inline"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          {SHIFT_LABEL}
        </span>
        <AlertBadge />
      </div>

      {/* Center: nav links */}
      <nav className="hidden md:flex items-center gap-6 text-sm">
        <NavLink to="/dashboard"  className={navCls}>Dashboard</NavLink>
        <NavLink to="/simulation" className={navCls}>Simulation</NavLink>
        <NavLink to="/copilot"    className={navCls}>Copilot</NavLink>
      </nav>

      {/* Right: user info + logout */}
      {user && (
        <div className="flex items-center gap-3">
          {/* Role badge */}
          {role && (
            <span
              className="hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
              style={{
                background: ROLE_COLORS[role] ?? ROLE_COLORS.employee,
                color:      ROLE_TEXT[role]   ?? ROLE_TEXT.employee,
              }}
            >
              {role}
            </span>
          )}

          {/* Avatar + name */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'rgba(118,185,0,0.2)', color: '#76b900', border: '1px solid rgba(118,185,0,0.3)' }}
            >
              {initials}
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-sm text-slate-300">{displayName}</span>
              {employeeId && (
                <span className="text-xs text-slate-600">{employeeId}</span>
              )}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleSignOut}
            className="btn btn-ghost btn-sm text-xs"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
