// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { registerCustom } from '../lib/exercises.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({
  glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn(),
  supersetSheet: vi.fn(), printPlanSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const custom = id => ({ id, n: id, bp: 'chest', eq: 'body weight', tg: 'chest', custom: true })
const entry = (id, setup, sg, circuit) => ({
  id, sets: 3, reps: 5, weight: setup, note: `setup-${setup}`,
  ...(sg ? { sg } : {}),
  ...(circuit ? { sgCircuit: circuit } : {}),
})
let root, container
function setRoutine(ex) {
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Superset test', emoji: 'dumbbell', ex }]
  S.customEx = ['c1', 'c2', 'c3', 'c4'].map(custom)
  registerCustom(S.customEx)
  useStore.setState({ S, user: null })
}
function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/routine/r1']}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}
const item = note => [...container.querySelectorAll('.item')].find(el => el.textContent.includes(note))
const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
const link = note => item(note).querySelector('button.re-link')
const groups = () => useStore.getState().S.routines[0].ex.map(e => e.sg || null)

beforeEach(() => {
  localStorage.clear()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  root = null
  container = null
})
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  vi.clearAllMocks()
})

describe('routine superset links', () => {
  it('links to four, numbers A1-A4, and refuses the fifth with a toast', () => {
    setRoutine([
      entry('c1', 10), entry('c2', 20), entry('c3', 30), entry('c4', 40), entry('c1', 50),
    ])
    render()
    click(link('setup-20'))
    click(link('setup-30'))
    click(link('setup-40'))
    expect(groups()).toEqual(['sg-0-1', 'sg-0-1', 'sg-0-1', 'sg-0-1', null])
    expect([...container.querySelectorAll('.ss-pos')].map(el => el.textContent)).toEqual(['A1', 'A2', 'A3', 'A4'])
    click(link('setup-50'))
    expect(groups()).toEqual(['sg-0-1', 'sg-0-1', 'sg-0-1', 'sg-0-1', null])
    expect(useUI.getState().toastMsg).toBe('A superset holds up to 4 exercises')
  })

  it('a circuit row has no link button', () => {
    const circuit = { mode: 'circuit', rounds: 3 }
    setRoutine([entry('c1', 10, 'c', circuit), entry('c2', 20, 'c', circuit)])
    render()
    expect(link('setup-20')).toBeNull()
  })
})
