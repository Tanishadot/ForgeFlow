import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './styles/index.css'
import Dashboard from './pages/Dashboard'
import Copilot from './pages/Copilot'
import Simulation from './pages/Simulation'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen p-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Factory Copilot</h1>
            <nav>
              <Link className="mr-4 text-slate-300 hover:text-white" to="/">Dashboard</Link>
              <Link className="mr-4 text-slate-300 hover:text-white" to="/copilot">Copilot</Link>
              <Link className="text-slate-300 hover:text-white" to="/simulation">Simulation</Link>
            </nav>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="/simulation" element={<Simulation />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
