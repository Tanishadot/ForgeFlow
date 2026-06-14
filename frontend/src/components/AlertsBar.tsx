import React from 'react'
import { useStore } from '../store'

const ICONS: Record<string, string> = {
  critical: '⛔',
  warning:  '⚠',
  info:     'ℹ',
}

export default function AlertsBar() {
  const alerts = useStore(s => s.alerts)
  if (alerts.length === 0) return null

  const criticals = alerts.filter(a => a.severity === 'critical')
  const warnings  = alerts.filter(a => a.severity === 'warning')

  return (
    <div className="flex flex-col gap-1 mb-3">
      {criticals.length > 0 && (
        <div className="alert-strip alert-strip-critical">
          <span className="font-bold shrink-0">{ICONS.critical} CRITICAL</span>
          <span className="text-red-200 opacity-40">|</span>
          {criticals.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && <span className="opacity-30">·</span>}
              <span>{a.message}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="alert-strip alert-strip-warning">
          <span className="font-bold shrink-0">{ICONS.warning} WARNING</span>
          <span className="text-amber-200 opacity-40">|</span>
          {warnings.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && <span className="opacity-30">·</span>}
              <span>{a.message}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
