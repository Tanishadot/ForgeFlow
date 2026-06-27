import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './styles/index.css'

import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

import Landing      from './pages/Landing'
import Login        from './pages/Login'
import Signup       from './pages/Signup'
import Onboarding   from './pages/Onboarding'
import ChangePassword from './pages/ChangePassword'
import Dashboard    from './pages/Dashboard'
import Copilot      from './pages/Copilot'
import Simulation   from './pages/Simulation'
import Handover     from './pages/Handover'
import Workforce    from './pages/Workforce'
import Admin        from './pages/Admin'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-5">{children}</main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#111827',
              color: '#e2e8f0',
              border: '1px solid rgba(118,185,0,0.2)',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#76b900', secondary: '#030712' } },
          }}
        />

        <Routes>
          {/* Public */}
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected — without Navbar */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          {/* Protected — with Navbar */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell><Dashboard /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulation"
            element={
              <ProtectedRoute>
                <AppShell><Simulation /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/copilot"
            element={
              <ProtectedRoute>
                <AppShell><Copilot /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/handover"
            element={
              <ProtectedRoute>
                <AppShell><Handover /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workforce"
            element={
              <ProtectedRoute>
                <AppShell><Workforce /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AppShell><Admin /></AppShell>
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
