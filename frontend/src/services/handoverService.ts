import type { Machine, InventoryItem, Order, ScheduleItem } from '../types'

export interface CriticalIssue {
  machineId:      string
  machineType:    string
  status:         string
  affectedOrders: string[]
}

export interface InventoryAlert {
  materialCode:   string
  materialName:   string
  current:        number
  minimum:        number
  unit:           string
  severity:       'critical' | 'warning'
  recommendation: string
}

export interface PriorityTask {
  rank:      number
  orderCode: string
  label:     string
  reason:    string
  priority:  string
  deadline:  string | null
}

export interface SuggestedAction {
  icon:     string
  action:   string
  category: 'maintenance' | 'inventory' | 'order' | 'general'
}

export function generateCriticalIssues(
  machines: Machine[],
  orders:   Order[],
  schedule: ScheduleItem[],
): CriticalIssue[] {
  const issues: CriticalIssue[] = []

  for (const machine of machines) {
    if (machine.status !== 'down' && machine.status !== 'maintenance') continue

    const mType = (machine.machine_type ?? '').toLowerCase().trim()

    // Orders that need this machine type and aren't completed
    const fromOrders = orders
      .filter(o =>
        o.status !== 'completed' &&
        (o.required_machine_type ?? '').toLowerCase().trim() === mType
      )
      .map(o => o.order_code)

    // Orders already scheduled on this machine
    const fromSchedule = schedule
      .filter(s => s.machine === machine.machine_id)
      .map(s => s.order)

    issues.push({
      machineId:      machine.machine_id,
      machineType:    machine.machine_type ?? machine.machine_id,
      status:         machine.status,
      affectedOrders: [...new Set([...fromOrders, ...fromSchedule])],
    })
  }

  return issues
}

export function generateInventoryAlerts(inventory: InventoryItem[]): InventoryAlert[] {
  const alerts: InventoryAlert[] = []

  for (const item of inventory) {
    if (!item.reorder_level || item.reorder_level <= 0) continue
    const ratio = item.quantity_on_hand / item.reorder_level
    if (ratio >= 1.5) continue  // healthy

    const severity: 'critical' | 'warning' = ratio < 0.5 ? 'critical' : 'warning'
    alerts.push({
      materialCode:   item.product_id ?? '',
      materialName:   item.material_name ?? item.product_id ?? 'Unknown',
      current:        item.quantity_on_hand,
      minimum:        item.reorder_level,
      unit:           item.unit ?? 'units',
      severity,
      recommendation: severity === 'critical'
        ? 'Place emergency order immediately.'
        : 'Schedule replenishment order within 2 days.',
    })
  }

  return alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1))
}

export function generatePriorityTasks(orders: Order[], schedule: ScheduleItem[]): PriorityTask[] {
  const PORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  const blocked = new Set(schedule.filter(s => s.status === 'blocked').map(s => s.order))

  const active = orders
    .filter(o => o.status !== 'completed')
    .sort((a, b) => {
      const pa = PORDER[a.priority] ?? 2
      const pb = PORDER[b.priority] ?? 2
      if (pa !== pb) return pa - pb
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      }
      return 0
    })

  return active.slice(0, 8).map((order, i) => {
    const reasons: string[] = []
    if (order.priority === 'urgent' || order.priority === 'high') reasons.push(`${order.priority} priority`)
    if (blocked.has(order.order_code)) reasons.push('needs machine reassignment')
    if (order.deadline) reasons.push(`due ${new Date(order.deadline).toLocaleDateString()}`)

    return {
      rank:      i + 1,
      orderCode: order.order_code,
      label:     order.product_name ? `${order.order_code} — ${order.product_name}` : order.order_code,
      reason:    reasons.join(' · ') || 'standard priority',
      priority:  order.priority,
      deadline:  order.deadline,
    }
  })
}

export function generateSuggestedActions(
  issues:  CriticalIssue[],
  alerts:  InventoryAlert[],
  tasks:   PriorityTask[],
): SuggestedAction[] {
  const actions: SuggestedAction[] = []

  for (const issue of issues) {
    actions.push({
      icon:     '🔧',
      action:   `Contact maintenance for ${issue.machineId} (${issue.machineType} — ${issue.status})`,
      category: 'maintenance',
    })
    if (issue.affectedOrders.length > 0) {
      actions.push({
        icon:     '🔄',
        action:   `Reschedule ${issue.affectedOrders.slice(0, 3).join(', ')} to an alternative ${issue.machineType}`,
        category: 'order',
      })
    }
  }

  for (const alert of alerts) {
    actions.push({
      icon:     alert.severity === 'critical' ? '🚨' : '📦',
      action:   `${alert.severity === 'critical' ? 'Emergency order' : 'Replenish'}: ${alert.materialName} (${alert.current} / ${alert.minimum} ${alert.unit})`,
      category: 'inventory',
    })
  }

  if (tasks.length > 0 && (tasks[0].priority === 'urgent' || tasks[0].priority === 'high')) {
    actions.push({
      icon:     '⚡',
      action:   `Prioritize: ${tasks[0].label}`,
      category: 'order',
    })
  }

  return actions
}

// Returns null if the question isn't matched locally — caller should try NIM
export function answerQuestion(
  question: string,
  context: {
    machines:    Machine[]
    inventory:   InventoryItem[]
    orders:      Order[]
    schedule:    ScheduleItem[]
    shiftNotes?: string
  },
): string | null {
  const q = question.toLowerCase()
  const { machines, inventory, orders, schedule, shiftNotes } = context

  // Machine ID lookup (e.g. MC003, MC-003)
  const mMatch = question.match(/\bMC[\-]?\w+/i)
  if (mMatch) {
    const mId  = mMatch[0].toUpperCase().replace('-', '')
    const mach = machines.find(m => m.machine_id.toUpperCase().replace('-', '') === mId)
    if (mach) {
      const scheduled = schedule.filter(s => s.machine === mach.machine_id).map(s => s.order)
      const needing   = orders
        .filter(o =>
          o.required_machine_type?.toLowerCase().trim() === (mach.machine_type ?? '').toLowerCase().trim() &&
          o.status !== 'completed'
        )
        .map(o => o.order_code)

      const lines = [
        `${mach.machine_id} (${mach.machine_type ?? 'Unknown'}) — ${(mach.status ?? 'unknown').toUpperCase()}`,
        mach.status === 'maintenance' || mach.status === 'down'
          ? '⚠️ Unavailable — orders cannot be assigned.'
          : '',
        scheduled.length ? `Scheduled orders: ${scheduled.join(', ')}` : '',
        needing.length   ? `Orders needing this type: ${needing.join(', ')}` : '',
      ]
      return lines.filter(Boolean).join('\n')
    }
  }

  // Order ID lookup (e.g. ORD008, ORD-008)
  const oMatch = question.match(/\bORD[\-]?\w+/i)
  if (oMatch) {
    const oCode = oMatch[0].toUpperCase().replace('-', '')
    const order = orders.find(o => o.order_code.toUpperCase().replace('-', '') === oCode)
    if (order) {
      const s    = schedule.find(i => i.order.toUpperCase().replace('-', '') === oCode)
      const mach = s?.machine ? machines.find(m => m.machine_id === s.machine) : null

      const lines = [
        `${order.order_code} — ${order.product_name ?? 'No name'}`,
        `Customer: ${order.customer_name ?? '—'}  |  Priority: ${order.priority}  |  Status: ${order.status.replace('_', ' ')}`,
        order.deadline ? `Deadline: ${new Date(order.deadline).toLocaleDateString()}` : '',
        s ? [
          '',
          `Schedule: ${s.machine ?? 'unassigned'}${s.start && s.end ? ` · ${s.start} – ${s.end}` : ''}`,
          s.status === 'delayed' ? `⚠️ Delayed — ${s.reason ?? 'past workday end'}` : '',
          s.status === 'blocked' ? `🔴 Blocked — ${s.reason ?? 'no machine available'}` : '',
        ].filter(x => x !== '').join('\n') : '',
        mach && (mach.status === 'maintenance' || mach.status === 'down') ? [
          '',
          `${mach.machine_id} is currently ${(mach.status ?? '').toUpperCase()}.`,
          `Suggested action: Reschedule or assign to alternative ${mach.machine_type ?? 'machine'}.`,
        ].join('\n') : '',
      ]
      return lines.filter(Boolean).join('\n')
    }
  }

  // Inventory / stock
  if (q.includes('inventory') || q.includes('stock') || q.includes('material') ||
      q.includes('supply') || q.includes('low stock') || q.includes('reorder')) {
    const low = inventory.filter(i => i.reorder_level > 0 && i.quantity_on_hand < i.reorder_level * 1.5)
    if (!low.length) return 'All inventory levels are currently healthy — no items at or near minimum.'
    return (
      'Low / near-minimum inventory:\n' +
      low.map(i => {
        const name   = i.material_name ?? i.product_id
        const status = i.quantity_on_hand < i.reorder_level ? '🔴 BELOW MIN' : '🟡 Near min'
        return `• ${name}: ${i.quantity_on_hand} / ${i.reorder_level} ${i.unit ?? ''} ${status}`
      }).join('\n')
    )
  }

  // Machine status overview
  if (q.includes('machine') || q.includes('down') || q.includes('maintenance')) {
    const prob = machines.filter(m => m.status === 'down' || m.status === 'maintenance')
    if (!prob.length) return 'All machines are operational — none are down or under maintenance.'
    return (
      'Machines with issues:\n' +
      prob.map(m => {
        const aff = schedule.filter(s => s.machine === m.machine_id).map(s => s.order)
        return `• ${m.machine_id} (${m.machine_type ?? '?'}) — ${(m.status ?? '').toUpperCase()}${aff.length ? `\n  Affects: ${aff.join(', ')}` : ''}`
      }).join('\n')
    )
  }

  // Urgent / priority
  if (q.includes('urgent') || q.includes('critical') || q.includes('priority') || q.includes('high')) {
    const high = orders.filter(o =>
      (o.priority === 'urgent' || o.priority === 'high') && o.status !== 'completed'
    )
    if (!high.length) return 'No urgent or high-priority orders are currently pending.'
    return (
      'Urgent / High-priority orders:\n' +
      high.map(o => {
        const s    = schedule.find(i => i.order === o.order_code)
        let line   = `• ${o.order_code} [${o.priority.toUpperCase()}] ${o.product_name ?? ''}`
        if (o.deadline) line += ` · due ${new Date(o.deadline).toLocaleDateString()}`
        if (s?.status === 'blocked') line += ' — 🔴 BLOCKED'
        else if (s?.status === 'delayed') line += ' — ⚠️ DELAYED'
        return line
      }).join('\n')
    )
  }

  // Delayed
  if (q.includes('delay') || q.includes('behind') || q.includes('late')) {
    const delayed = schedule.filter(s => s.status === 'delayed' || s.delay)
    if (!delayed.length) return 'No orders are currently delayed in the schedule.'
    return 'Delayed orders:\n' + delayed.map(s => `• ${s.order} — ${s.reason ?? 'past workday end'}`).join('\n')
  }

  // Blocked
  if (q.includes('block')) {
    const blocked = schedule.filter(s => s.status === 'blocked')
    if (!blocked.length) return 'No orders are currently blocked.'
    return 'Blocked orders:\n' + blocked.map(s => `• ${s.order} — ${s.reason ?? 'no machine available'}`).join('\n')
  }

  // Overview / summary
  if (q.includes('summary') || q.includes('overview') || q.includes('status') || q.includes('today') || q.includes('what happened')) {
    const completed = orders.filter(o => o.status === 'completed').length
    const inProg    = orders.filter(o => o.status === 'in_progress').length
    const pending   = orders.filter(o => o.status === 'pending').length
    const blocked   = schedule.filter(s => s.status === 'blocked').length
    const delayed   = schedule.filter(s => s.status === 'delayed' || s.delay).length
    const down      = machines.filter(m => m.status === 'down' || m.status === 'maintenance').length
    const lowInv    = inventory.filter(i => i.reorder_level > 0 && i.quantity_on_hand < i.reorder_level).length

    return [
      'Factory status:',
      `• Orders: ${orders.length} total — ${completed} completed, ${inProg} in progress, ${pending} pending`,
      `• Schedule: ${blocked} blocked, ${delayed} delayed`,
      `• Machines: ${down}/${machines.length} down or in maintenance`,
      `• Inventory: ${lowInv} item(s) below minimum stock`,
      shiftNotes ? `\nShift notes:\n${shiftNotes.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n')
  }

  return null  // couldn't answer locally — caller should try NIM
}
