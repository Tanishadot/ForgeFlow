import React from 'react'
import { motion } from 'framer-motion'
import type { CriticalIssue, InventoryAlert, PriorityTask, SuggestedAction } from '../services/handoverService'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  normal: '#76b900',
  low:    '#64748b',
}

const ITEM_V = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0 },
}

interface Props {
  currentShift: string
  nextShift:    string
  issues:       CriticalIssue[]
  alerts:       InventoryAlert[]
  tasks:        PriorityTask[]
  actions:      SuggestedAction[]
  shiftNotes?:  string
}

export default function AIHandoverCard({
  currentShift, nextShift, issues, alerts, tasks, actions, shiftNotes,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #111827 100%)',
        border: '1px solid rgba(118,185,0,0.3)',
        borderRadius: 12,
        boxShadow: '0 0 40px rgba(118,185,0,0.07), 0 4px 24px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(118,185,0,0.14) 0%, rgba(118,185,0,0.03) 100%)',
        borderBottom: '1px solid rgba(118,185,0,0.18)',
        padding: '18px 22px',
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'rgba(118,185,0,0.15)', border: '1px solid rgba(118,185,0,0.3)' }}
            >
              🤖
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 tracking-widest uppercase">
                AI Handover Brief
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{currentShift} → {nextShift}</div>
            </div>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(118,185,0,0.12)', color: '#76b900', border: '1px solid rgba(118,185,0,0.25)' }}
          >
            NVIDIA NIM
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-lg">👋</span>
          <div>
            <div className="text-sm text-slate-200">
              Welcome, <span className="font-semibold" style={{ color: '#76b900' }}>{nextShift}</span>
            </div>
            <div className="text-xs text-slate-500">Here is what {currentShift} needs you to know</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Shift notes */}
        {shiftNotes && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            padding: '12px 16px',
          }}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              📋 Previous Shift Notes
            </div>
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {shiftNotes}
            </div>
          </div>
        )}

        {/* ── Critical Issues ──────────────────────────────────── */}
        <Section
          title="Critical Issues"
          icon="🔴"
          color="#ef4444"
          count={issues.length}
          emptyIcon="🟢"
          emptyMsg="No critical machine issues"
          isEmpty={issues.length === 0}
        >
          {issues.map((issue, i) => (
            <motion.div
              key={issue.machineId}
              variants={ITEM_V}
              initial="hidden"
              animate="show"
              transition={{ delay: i * 0.07 }}
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-base">🔴</span>
                <span className="text-sm font-bold text-red-300">{issue.machineId}</span>
                <span className="text-xs text-slate-400">{issue.machineType}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase"
                  style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}
                >
                  {issue.status}
                </span>
              </div>

              {issue.affectedOrders.length > 0 && (
                <div className="ml-7">
                  <div className="text-xs text-slate-500 mb-1.5">Affected orders:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {issue.affectedOrders.map(o => (
                      <span
                        key={o}
                        className="text-xs px-2 py-0.5 rounded font-mono font-medium"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239,68,68,0.22)',
                        }}
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </Section>

        {/* ── Inventory Alerts ─────────────────────────────────── */}
        <Section
          title="Inventory Alerts"
          icon="🟡"
          color="#f97316"
          count={alerts.length}
          emptyIcon="🟢"
          emptyMsg="All inventory levels healthy"
          isEmpty={alerts.length === 0}
        >
          {alerts.map((alert, i) => {
            const barPct  = Math.min(100, Math.round((alert.current / alert.minimum) * 100))
            const barColor = alert.severity === 'critical' ? '#ef4444' : '#f97316'

            return (
              <motion.div
                key={alert.materialCode}
                variants={ITEM_V}
                initial="hidden"
                animate="show"
                transition={{ delay: i * 0.07 }}
                style={{
                  background: alert.severity === 'critical' ? 'rgba(239,68,68,0.05)' : 'rgba(249,115,22,0.05)',
                  border: `1px solid ${alert.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{alert.severity === 'critical' ? '🔴' : '🟡'}</span>
                    <span className="text-sm font-semibold text-slate-200">{alert.materialName}</span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full uppercase font-semibold"
                    style={{
                      background: alert.severity === 'critical' ? 'rgba(239,68,68,0.18)' : 'rgba(249,115,22,0.18)',
                      color:      alert.severity === 'critical' ? '#fca5a5' : '#fdba74',
                    }}
                  >
                    {alert.severity}
                  </span>
                </div>

                {/* Stock level bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Current: {alert.current} {alert.unit}</span>
                    <span>Minimum: {alert.minimum} {alert.unit}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.07 + 0.2 }}
                      style={{ background: barColor }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-start gap-1.5 text-xs"
                  style={{ color: alert.severity === 'critical' ? '#fca5a5' : '#fdba74' }}
                >
                  <span className="flex-shrink-0">💡</span>
                  <span>{alert.recommendation}</span>
                </div>
              </motion.div>
            )
          })}
        </Section>

        {/* ── Priority Tasks ───────────────────────────────────── */}
        <Section
          title="Priority Tasks"
          icon="📋"
          color="#76b900"
          count={tasks.length}
          emptyIcon="✅"
          emptyMsg="No active orders"
          isEmpty={tasks.length === 0}
        >
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <motion.div
                key={task.orderCode}
                variants={ITEM_V}
                initial="hidden"
                animate="show"
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  padding: '10px 13px',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                  style={{ background: 'rgba(118,185,0,0.14)', color: '#76b900', border: '1px solid rgba(118,185,0,0.3)' }}
                >
                  {task.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-200 font-medium">{task.label}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ color: PRIORITY_COLORS[task.priority] ?? '#94a3b8', background: 'rgba(255,255,255,0.04)' }}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{task.reason}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── Suggested Actions ────────────────────────────────── */}
        {actions.length > 0 && (
          <Section
            title="Suggested Actions"
            icon="💡"
            color="#76b900"
            isEmpty={false}
          >
            <div className="space-y-2">
              {actions.map((action, i) => (
                <motion.div
                  key={i}
                  variants={ITEM_V}
                  initial="hidden"
                  animate="show"
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2.5"
                  style={{
                    background: 'rgba(118,185,0,0.04)',
                    border: '1px solid rgba(118,185,0,0.1)',
                    borderRadius: 8,
                    padding: '9px 13px',
                  }}
                >
                  <span className="flex-shrink-0">{action.icon}</span>
                  <span className="text-xs text-slate-300 leading-relaxed">{action.action}</span>
                </motion.div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </motion.div>
  )
}

function Section({
  title, icon, color, count, emptyIcon, emptyMsg, isEmpty, children,
}: {
  title:     string
  icon:      string
  color:     string
  count?:    number
  emptyIcon?: string
  emptyMsg?: string
  isEmpty:   boolean
  children?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{icon}</span>
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color }}
        >
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: `${color}22`, color }}
          >
            {count}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-1 px-2">
          <span>{emptyIcon}</span>
          <span>{emptyMsg}</span>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  )
}
