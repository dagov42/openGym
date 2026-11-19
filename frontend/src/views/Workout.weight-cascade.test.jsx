// @vitest-environment happy-dom
// Weight cascade (issue #1166): the default carries an edited work-set weight into the following
// inherited sets; the Settings switch off keeps it on the edited row only.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { closeOpenRow } from '../lib/use-swipe-row.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const row = w => ({ w, r: 8, done: false })
const entry = () => ({
  id: '0025',
  target: { sets: 3, reps: 8, weight: 60, mode: 'reps' },
  sets: [row(60), row(60), row(60)],
})
let root, container
function setActive(cascade) {
  const S = clone(DEF)
  S.weightCascade = cascade
  S.wc = { ...S.wc, steppers: true }
  S.active = {
    id: 'cascade-test', d: '2026-11-19', start: Date.now(), routineId: null,
    name: 'Cascade test', bw: null, cur: 0, entries: [entry()],
  }
  useStore.setState({ S, user: null })
}
function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}
const click = target => act(() => target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
const increase = () => [...container.querySelectorAll('button')].find(b => /Weight.*Increase/.test(b.getAttribute('aria-label') || ''))
const weights = () => useStore.getState().S.active.entries[0].sets.map(s => s.w)

beforeEach(() => {
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null, toastMsg: '', toastAction: null })
  root = null
  container = null
})
afterEach(() => {
  closeOpenRow(true)
  if (root) act(() => root.unmount())
  if (container) container.remove()
  vi.clearAllTimers()
})

describe('one working set without the cascade', () => {
  it('keeps following sets when the switch is off, and the edited row is manual', () => {
    setActive(false)
    render()
    const btn = increase()
    expect(btn).toBeTruthy()
    for (let i = 0; i < 8; i++) click(btn)
    expect(weights()).toEqual([80, 60, 60])
    expect(useStore.getState().S.active.entries[0].sets[0].weightOrigin).toBe('manual')
  })

  it('still carries the edit to following sets by default', () => {
    setActive(true)
    render()
    const btn = increase()
    for (let i = 0; i < 8; i++) click(btn)
    expect(weights()).toEqual([80, 80, 80])
    expect(useStore.getState().S.active.entries[0].sets[0].weightOrigin).toBe('manual')
  })
})

