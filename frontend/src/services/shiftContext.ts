import { supabase } from './supabase'
import { api } from '../api'
import type { ShiftContext } from '../types'
import type { ShiftLogRow, ShiftContextRow } from './supabase'

/**
 * Fetch the N most recent shift logs for a company and send them to the
 * backend LLM endpoint for summarization. The summary is stored in the
 * shift_context table and returned.
 */
export async function generateAndStoreShiftSummary(companyId: string): Promise<ShiftContext> {
  // 1. Fetch recent shift logs (last 24h or last 20 entries)
  const { data: logData, error: logErr } = await supabase
    .from('shift_logs')
    .select('shift, notes, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (logErr) throw new Error(logErr.message)

  const logs = (logData ?? []) as Pick<ShiftLogRow, 'shift' | 'notes' | 'created_at'>[]

  if (logs.length === 0) {
    // Nothing to summarize — return a placeholder
    return {
      id:           '',
      company_id:   companyId,
      summary:      'No shift notes have been submitted yet.',
      generated_at: new Date().toISOString(),
    }
  }

  // 2. Call backend LLM to summarize
  let summary: string
  try {
    const resp = await api.generateShiftSummary(companyId, logs)
    summary = resp.data.summary
  } catch {
    // Fall back to a simple client-side concatenation if backend unavailable
    summary = logs
      .map(l => `[${l.shift ?? 'Shift'}] ${l.notes}`)
      .join('\n')
  }

  // 3. Store in Supabase
  const { data: stored, error: storeErr } = await supabase
    .from('shift_context')
    .insert({ company_id: companyId, summary })
    .select()
    .single()

  if (storeErr) throw new Error(storeErr.message)

  return stored as unknown as ShiftContext
}

/**
 * Retrieve the most recent shift summary for a company.
 */
export async function getLatestShiftContext(companyId: string): Promise<ShiftContext | null> {
  const { data, error } = await supabase
    .from('shift_context')
    .select('*')
    .eq('company_id', companyId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as ShiftContext
}

/**
 * Build a mock AI response for the shift assistant when no backend is available.
 * Real NVIDIA NIM integration is wired through /copilot/chat on the backend.
 */
export function getMockShiftAssistantResponse(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('noise') || lower.includes('vibrat') || lower.includes('sound')) {
    return `Possible causes:\n1. Bearing wear\n2. Belt misalignment\n3. Loose fasteners\n\nRecommended actions:\n• Inspect bearings for wear\n• Check belt tension and alignment\n• Reduce machine load temporarily\n• Schedule preventive maintenance`
  }
  if (lower.includes('slow') || lower.includes('speed') || lower.includes('throughput')) {
    return `Production slowdown may be caused by:\n1. Tool wear or dull cutting edges\n2. Material feed rate issue\n3. Coolant system blockage\n\nRecommended actions:\n• Check and replace worn tooling\n• Verify feed rate settings\n• Inspect coolant lines`
  }
  if (lower.includes('heat') || lower.includes('overheat') || lower.includes('temperature')) {
    return `Overheating indicators:\n1. Coolant flow insufficient\n2. Lubrication failure\n3. Bearing degradation\n\nImmediate actions:\n• Reduce operating load\n• Check coolant levels and flow\n• Inspect lubrication system\n• Consider scheduling maintenance`
  }
  if (lower.includes('jam') || lower.includes('stuck') || lower.includes('block')) {
    return `Machine jam detected. Steps to resolve:\n1. Emergency stop if not already done\n2. Clear obstruction safely\n3. Inspect feed mechanism\n4. Check for material defects\n5. Restart with reduced speed`
  }

  return `I've noted your observation. For best results:\n• Document the issue in shift notes\n• Assign a maintenance ticket if symptoms persist\n• Monitor for recurrence over the next 30 minutes\n\nIf the issue worsens, escalate to your shift manager.`
}
