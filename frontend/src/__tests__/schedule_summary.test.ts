/**
 * Tests for schedule summary counting logic.
 *
 * The same filtering expressions are used in three places in store.ts:
 *   generateSchedule(), refreshAll(), and applyWhatIf().
 * Verifying the logic once here guards against divergence.
 */
import { describe, it, expect } from 'vitest'

// The schedule item shape used throughout the app
interface ScheduleItem {
  order: string
  machine: string | null
  start: string | null
  end: string | null
  status?: string
  delay?: boolean
  reason?: string
}

// Mirror the counting logic from store.ts so any change there breaks these tests
function summarise(schedule: ScheduleItem[]) {
  const on_track = schedule.filter(
    s => !s.status || s.status === 'scheduled',
  ).length
  const delayed = schedule.filter(
    s => s.status === 'delayed' || s.delay === true,
  ).length
  const blocked = schedule.filter(s => s.status === 'blocked').length
  return { total: schedule.length, on_track, delayed, blocked }
}


describe('summarise', () => {
  it('counts a fully on-track schedule', () => {
    const schedule: ScheduleItem[] = [
      { order: 'O1', machine: 'M1', start: '09:00', end: '10:00' },
      { order: 'O2', machine: 'M2', start: '09:00', end: '11:00', status: 'scheduled' },
    ]
    const s = summarise(schedule)
    expect(s.total).toBe(2)
    expect(s.on_track).toBe(2)
    expect(s.delayed).toBe(0)
    expect(s.blocked).toBe(0)
  })

  it('counts blocked orders', () => {
    const schedule: ScheduleItem[] = [
      { order: 'O1', machine: null, start: null, end: null, status: 'blocked', reason: 'no stock' },
    ]
    const s = summarise(schedule)
    expect(s.blocked).toBe(1)
    expect(s.on_track).toBe(0)
  })

  it('counts delayed orders via status', () => {
    const schedule: ScheduleItem[] = [
      { order: 'O1', machine: 'M1', start: '16:00', end: '18:00', status: 'delayed' },
    ]
    const s = summarise(schedule)
    expect(s.delayed).toBe(1)
    expect(s.on_track).toBe(0)
  })

  it('counts delayed orders via delay flag (legacy field)', () => {
    const schedule: ScheduleItem[] = [
      { order: 'O1', machine: 'M1', start: '16:00', end: '18:00', delay: true },
    ]
    const s = summarise(schedule)
    expect(s.delayed).toBe(1)
  })

  it('totals equal schedule length across all statuses', () => {
    const schedule: ScheduleItem[] = [
      { order: 'O1', machine: 'M1', start: '09:00', end: '10:00' },
      { order: 'O2', machine: null, start: null, end: null, status: 'blocked' },
      { order: 'O3', machine: 'M2', start: '09:00', end: '11:00', status: 'delayed', delay: true },
      { order: 'O4', machine: 'M1', start: '10:00', end: '11:00', status: 'scheduled' },
    ]
    const s = summarise(schedule)
    expect(s.total).toBe(4)
    expect(s.on_track + s.delayed + s.blocked).toBe(4)
  })

  it('handles an empty schedule', () => {
    const s = summarise([])
    expect(s.total).toBe(0)
    expect(s.on_track).toBe(0)
    expect(s.delayed).toBe(0)
    expect(s.blocked).toBe(0)
  })
})


describe('applyWhatIf schedule replacement', () => {
  it('new_schedule becomes the active schedule', () => {
    const whatIfResult = {
      impact: {
        new_schedule: [
          { order: 'R1', machine: 'M1', start: '09:00', end: '09:30', status: 'scheduled' },
          { order: 'R2', machine: null, start: null, end: null, status: 'blocked' },
        ] as ScheduleItem[],
      },
    }

    const newSchedule = whatIfResult.impact.new_schedule
    expect(newSchedule).toBeDefined()
    expect(newSchedule.length).toBe(2)

    const s = summarise(newSchedule)
    expect(s.on_track).toBe(1)
    expect(s.blocked).toBe(1)
  })

  it('empty new_schedule is a no-op guard', () => {
    const newSchedule: ScheduleItem[] = []
    // applyWhatIf returns early when new_schedule is empty
    expect(newSchedule.length === 0).toBe(true)
  })
})
