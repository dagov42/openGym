// @vitest-environment happy-dom
// Swap from a live session: the config sheet can replace today's occurrence and the routine slot
// in one action, seeded from the slot's plan, without touching history or a saved-workout editor.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { swapActiveWorkoutExercise } from './sheets.jsx'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const clone = value => JSON.parse(JSON.stringify(value))
const ids = EXDB.slice(0, 4).map(e => e.id)
const mounted = []

function entry(id, done = false, extra = {}) {
  return {
    id, rid: 'r', target: { mode: 'reps', sets: 4, reps: 8, weight: 60, sg: 'g1', sgName: 'Pair', sgRest: 75, sgCircuit: true },
    sets: [{ w: 40, r: 5, done }], ...extra,
  }
}
const slot = {
  id: ids[0], sg: 'g1', sgName: 'Pair', sgRest: 75, sgCircuit: true,
  sets: 4, reps: 8, weight: 60, note: 'old note',
}

function install({ rid = 'r', editing = false, backfill = false } = {}) {
  const S = clone(DEF)
  S.routines = [{ id: 'r', name: 'Push day', ex: [{ ...slot }] }]
  S.active = {
    id: 'swap-routine', d: '2026-11-18', start: Date.now(), routineId: rid,
    name: 'Push day', bw: null, cur: 0,
    entries: [entry(ids[0], false, { rid })],
    ...(editing ? { editingWorkoutId: 'w1' } : {}),
    ...(backfill ? { backfill: true } : {}),
  }
  useStore.setState({ S, user: null })
}

function openConfig() {
  swapActiveWorkoutExercise(0)
  const picker = useUI.getState().sheets.at(-1)
  const pickerEl = picker.render(picker.close)
  act(() => pickerEl.props.onPick(EXDB[2]))
  return useUI.getState().sheets.at(-1).render(() => {})
}

beforeEach(() => {
  vi.useFakeTimers()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.clearAllTimers()
})

describe('Replace in routine from a swap', () => {
  it('seeds the sheet with the slot plan and writes today and the routine in one action', () => {
    const view = openConfig()
    expect(view.props.initial).toMatchObject({ sets: 4, reps: 8, weight: 60, note: 'old note' })
    const cfg = { id: EXDB[2].id, sets: 2, reps: 5, weight: 30, mode: 'reps' }
    act(() => view.props.onReplaceInRoutine(cfg))
    const S = useStore.getState().S
    expect(S.active.entries[0].id).toBe(EXDB[2].id)
    expect(S.routines[0].ex[0]).toMatchObject({
      id: EXDB[2].id, sets: 2, reps: 5, weight: 30,
      sg: 'g1', sgName: 'Pair', sgRest: 75, sgCircuit: true,
    })
    expect(S.routines[0].ex[0].note).toBeUndefined()
    expect(useUI.getState().toastMsg).toContain('from next time')
  })

  it('keeps the button out of freestyle, editor and backfill swaps', () => {
    for (const opts of [{ rid: null }, { editing: true }, { backfill: true }]) {
      useUI.setState({ sheets: [], toastMsg: '' })
      install(opts)
      const view = openConfig()
      expect(view.props.onReplaceInRoutine, JSON.stringify(opts)).toBeUndefined()
    }
  })

  it('leaves the routine alone when its slot changed while the sheet was open, but still swaps today', () => {
    const view = openConfig()
    // Another tab renamed/replaced the slot: the guard must fail closed.
    act(() => useStore.getState().update(s => { s.routines[0].ex[0].id = ids[1] }))
    act(() => view.props.onReplaceInRoutine({ id: EXDB[2].id, sets: 2, reps: 5, weight: 30, mode: 'reps' }))
    const S = useStore.getState().S
    expect(S.active.entries[0].id).toBe(EXDB[2].id)
    expect(S.routines[0].ex[0].id).toBe(ids[1])
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('does not write the routine when the logged-set confirmation is cancelled', () => {
    install()
    act(() => useStore.getState().update(s => { s.active.entries[0].sets[0].done = true }))
    const view = openConfig()
    act(() => view.props.onReplaceInRoutine({ id: EXDB[2].id, sets: 2, reps: 5, weight: 30, mode: 'reps' }))
    expect(useStore.getState().S.active.entries[0].id).toBe(ids[0])
    expect(useStore.getState().S.routines[0].ex[0].id).toBe(ids[0])
  })
})
