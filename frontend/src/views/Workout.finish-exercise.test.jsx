// @vitest-environment happy-dom
// Collapse sets: a finished unit folds to the List summary in Cards/Focus. The sets themselves
// are untouched and stay ticked; the fold survives leaving and returning to the workout screen.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout, { _resetFoldedUnits } from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { closeOpenRow } from '../lib/use-swipe-row.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const row = (done = true) => ({ w: 80, r: 8, done })
const entry = (id, sets, extra = {}) => ({ id, target: { sets: sets.length, reps: 8 }, sets, ...extra })

let root, container
function setActive(entries, extra = {}) {
  const S = clone(DEF)
  S.active = {
    id: 'fold-test', d: '2026-11-18', start: Date.now(), routineId: null,
    name: 'Fold test', bw: null, cur: 0, entries, ...extra,
  }
  useStore.setState({ S, user: null })
}
const sets = (i = 0) => useStore.getState().S.active.entries[i].sets
function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text))
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })

beforeEach(() => {
  _resetFoldedUnits()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, timer: null, work: null, swipeHint: null, setFlash: null })
  useStore.setState({ S: clone(DEF), user: null })
  root = null
  container = null
})
afterEach(() => {
  closeOpenRow(true)
  if (root) act(() => root.unmount())
  if (container) container.remove()
  vi.clearAllTimers()
})

describe('Collapse sets', () => {
  it('is disabled with an explanation until every set is ticked', () => {
    setActive([entry('1001', [row(true), row(false)])])
    render()
    const b = button('Collapse sets')
    expect(b.disabled).toBe(true)
    expect(container.textContent).toContain('Tick every set first')
  })

  it('folds to the one-line summary without changing the sets, and Show the sets unfolds', () => {
    setActive([entry('1001', [row(true), row(true)])])
    render()
    const before = sets().map(s => ({ ...s }))
    click(button('Collapse sets'))
    expect(container.querySelector('.wl-summary')).toBeTruthy()
    expect(container.textContent).toContain('2 sets')
    expect(sets()).toEqual(before)
    click(button('Show the sets'))
    expect(container.querySelector('.wl-summary')).toBeNull()
    expect(button('Collapse sets')).toBeTruthy()
    expect(sets()).toEqual(before)
  })

  it('stays folded after the workout screen is left and mounted again', () => {
    setActive([entry('1001', [row(true)])])
    render()
    click(button('Collapse sets'))
    act(() => root.unmount())
    container.remove()
    root = null
    render()
    expect(container.querySelector('.wl-summary')).toBeTruthy()
    expect(sets()).toEqual([row(true)])
  })

  it('folds a superset as one unit with one summary line per member', () => {
    setActive([entry('1001', [row(true)], { sg: 'g' }), entry('1002', [row(true)], { sg: 'g' })])
    render()
    click(button('Collapse sets'))
    const lines = [...container.querySelectorAll('.wl-summary .row.between')]
    expect(lines).toHaveLength(2)
    expect(container.textContent).toContain('1 set')
  })

  it('is absent in the editor of a saved workout', () => {
    setActive([entry('1001', [row(true)])], { editingWorkoutId: 'w1' })
    render()
    expect(button('Collapse sets')).toBeUndefined()
    expect(container.querySelector('.wl-summary')).toBeNull()
  })
})
