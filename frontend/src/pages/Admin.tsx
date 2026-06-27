import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminSetupDashboard from '../components/AdminSetupDashboard'

export default function Admin() {
  const { role, companyId } = useAuth()

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  if (!companyId) return null

  return (
    <div className="max-w-5xl">
      <div className="panel p-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-100">Factory Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage employees, machines, inventory, orders, and company settings
          </p>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
        >
          Admin only
        </span>
      </div>
      <AdminSetupDashboard companyId={companyId} />
    </div>
  )
}
