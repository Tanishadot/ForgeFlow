import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import './styles/index.css'
import Dashboard from './pages/Dashboard'
import Copilot from './pages/Copilot'
import Simulation from './pages/Simulation'
import { useStore } from './store'

const NOW = new Date()
const SHIFT_LABEL = NOW.getHours() < 16 ? 'Shift 1 · 09:00–17:00' : 'Shift 2 · 17:00–01:00'

function AlertBadge() {
  const alerts = useStore(s => s.alerts)
  const criticals = alerts.filter(a => a.severity === 'critical').length
  if (criticals === 0) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}
    >
      ⛔ {criticals}
    </span>
  )
}

function App() {
  const navCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'text-nvidia-400 font-semibold border-b-2 border-nvidia-500 pb-0.5'
      : 'text-slate-400 hover:text-slate-200 transition-colors pb-0.5'

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-nvidia-500 font-black text-xl tracking-tight">ForgeFlow</span>
              <span className="text-slate-300 font-light text-xl">AI</span>
            </div>
            <span
              className="text-xs text-slate-500 border rounded px-2 py-0.5"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {SHIFT_LABEL}
            </span>
            <AlertBadge />
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <NavLink to="/"           className={navCls}>Dashboard</NavLink>
            <NavLink to="/simulation" className={navCls}>Simulation</NavLink>
            <NavLink to="/copilot"    className={navCls}>Copilot</NavLink>
          </nav>
        </header>

        {/* Main */}
        <main className="flex-1 p-5">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/copilot"    element={<Copilot />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
