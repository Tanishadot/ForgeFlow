import React, { useState } from 'react'
import { useStore } from '../store'
import type { ScenarioType } from '../types'

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  machine_failure:      'Machine Failure',
  rush_order:           'Rush Order',
  inventory_reduction:  'Inventory Shortage',
}

function buildRecommendation(
  scenarioType: ScenarioType,
  machineId: string,
  delayedOrders: string[],
  scheduleChanges: Array<{ order: string; from?: string; to?: string; reason?: string }>,
): string {
  const rerouted = scheduleChanges.filter(c => c.to)
  const stuck    = delayedOrders.filter(o => !rerouted.find(c => c.order === o))

  if (scenarioType === 'machine_failure') {
    const parts: string[] = [`${machineId} failure affects ${delayedOrders.length} order(s).`]
    if (rerouted.length > 0) {
      parts.push(`${rerouted.length} can be rerouted (${rerouted.map(c => `${c.order} → ${c.to}`).join(', ')}).`)
    }
    if (stuck.length > 0) {
      parts.push(`${stuck.length} order(s) cannot be rerouted and will be delayed: ${stuck.join(', ')}.`)
    }
    return parts.join(' ')
  }
  if (scenarioType === 'rush_order') {
    return `Rush order insertion pushes ${delayedOrders.length} order(s) into conflict. Consider renegotiating deadlines for: ${delayedOrders.join(', ')}.`
  }
  if (scenarioType === 'inventory_reduction') {
    return `Inventory shortage blocks ${delayedOrders.length} order(s): ${delayedOrders.join(', ')}. Trigger an emergency reorder.`
  }
  return `${delayedOrders.length} order(s) affected.`
}

export default function WhatIfPanel() {
  const machines     = useStore(s => s.machines)
  const inventory    = useStore(s => s.inventory)
  const summary      = useStore(s => s.summary)
  const whatIfResult = useStore(s => s.whatIfResult)
  const loading      = useStore(s => s.loading)
  const runWhatIf    = useStore(s => s.runWhatIf)
  const applyWhatIf  = useStore(s => s.applyWhatIf)
  const clearWhatIf  = useStore(s => s.clearWhatIf)

  const [scenarioType, setScenarioType] = useState<ScenarioType>('machine_failure')
  const [machineId, setMachineId]       = useState('')
  const [duration, setDuration]         = useState('4')
  const [productId, setProductId]       = useState('')
  const [reduction, setReduction]       = useState('20')

  async function handleRun() {
    let scenario: Record<string, unknown>
    if (scenarioType === 'machine_failure') {
      scenario = { type: 'machine_failure', machine: machineId || machines[0]?.machine_id }
    } else if (scenarioType === 'rush_order') {
      const selectedMachine = machines.find(m => m.machine_id === machineId) ?? machines[0]
      scenario = {
        type: 'rush_order',
        order: {
          order_id:         `RUSH-${Date.now()}`,
          product_name:     'Rush Order',
          urgency_score:    10,
          due_date:         new Date().toISOString().split('T')[0],
          duration_minutes: Math.round(parseFloat(duration) * 60),
          machine_type:     selectedMachine?.machine_type ?? undefined,
          quantity:         1,
        },
      }
    } else {
      scenario = {
        type: 'inventory_reduction',
        product_id: productId || inventory[0]?.product_id,
        reduction: parseFloat(reduction) || 20,
      }
    }
    await runWhatIf(scenario)
  }

  const impact = whatIfResult?.impact
  const delayedCount = impact?.delayed_orders.length ?? 0
  const simOnTrack   = Math.max(0, summary.on_track - delayedCount)

  return (
    <div className="space-y-3">
      {/* Scenario selector */}
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(SCENARIO_LABELS) as ScenarioType[]).map(t => (
          <button
            key={t}
            onClick={() => { setScenarioType(t); clearWhatIf() }}
            className={`btn btn-sm ${scenarioType === t ? 'btn-primary' : 'btn-ghost'}`}
          >
            {SCENARIO_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Scenario config */}
      {scenarioType === 'machine_failure' && (
        <div className="flex gap-2">
          <select
            className="input text-xs"
            value={machineId}
            onChange={e => setMachineId(e.target.value)}
          >
            <option value="">Pick machine</option>
            {machines.map(m => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} ({m.machine_type ?? '?'})
              </option>
            ))}
          </select>
        </div>
      )}

      {scenarioType === 'rush_order' && (
        <div className="flex gap-2">
          <select
            className="input text-xs"
            value={machineId}
            onChange={e => setMachineId(e.target.value)}
          >
            <option value="">Pick machine</option>
            {machines.filter(m => m.status === 'running' || m.status === 'idle').map(m => (
              <option key={m.machine_id} value={m.machine_id}>{m.machine_id}</option>
            ))}
          </select>
          <input
            type="number"
            className="input text-xs w-20"
            placeholder="hrs"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            title="Job duration (hours)"
          />
        </div>
      )}

      {scenarioType === 'inventory_reduction' && (
        <div className="flex gap-2">
          <select
            className="input text-xs"
            value={productId}
            onChange={e => setProductId(e.target.value)}
          >
            <option value="">Pick material</option>
            {inventory.map(inv => (
              <option key={inv.product_id} value={inv.product_id ?? ''}>
                {inv.material_name ?? inv.product_id}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input text-xs w-20"
            placeholder="reduce"
            value={reduction}
            onChange={e => setReduction(e.target.value)}
            title="Reduce stock by this amount"
          />
        </div>
      )}

      <button onClick={handleRun} disabled={loading} className="btn btn-primary w-full">
        {loading ? 'Running…' : '▶ Run Simulation'}
      </button>

      {/* Result */}
      {whatIfResult && whatIfResult.status === 'success' && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          <div className="flex gap-3 text-xs">
            <div className="flex-1 panel p-2 text-center">
              <div className="text-slate-400">Current</div>
              <div className="text-lg font-bold text-green-400">{summary.on_track} on-track</div>
            </div>
            <div className="flex items-center text-slate-500 text-lg">→</div>
            <div className="flex-1 panel p-2 text-center">
              <div className="text-slate-400">Simulated</div>
              <div className="text-lg font-bold text-orange-400">{simOnTrack} on-track</div>
            </div>
          </div>

          {delayedCount > 0 && (
            <div className="text-xs text-orange-300 bg-orange-900/20 rounded p-2">
              <div className="font-semibold mb-1">Affected orders:</div>
              <div className="font-mono">{impact?.delayed_orders.join(', ')}</div>
            </div>
          )}

          <div className="text-xs text-slate-300 bg-white/3 rounded p-2 leading-relaxed">
            <div className="text-nvidia-400 font-semibold mb-1 text-xs uppercase tracking-wide">AI Recommendation</div>
            {buildRecommendation(
              scenarioType,
              machineId || (machines[0]?.machine_id ?? 'Unknown'),
              impact?.delayed_orders ?? [],
              impact?.schedule_changes ?? [],
            )}
          </div>

          <div className="flex gap-2">
            {whatIfResult?.impact?.new_schedule && whatIfResult.impact.new_schedule.length > 0 && (
              <button
                onClick={applyWhatIf}
                className="btn btn-primary btn-sm flex-1"
                title="Replace the current schedule with this simulation result"
              >
                ✓ Apply to Schedule
              </button>
            )}
            <button onClick={clearWhatIf} className="btn btn-ghost btn-sm flex-1">
              Clear
            </button>
          </div>
        </div>
      )}

      {whatIfResult && whatIfResult.status === 'error' && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded p-2">
          Error: {whatIfResult.errors.join(', ')}
        </div>
      )}
    </div>
  )
}
