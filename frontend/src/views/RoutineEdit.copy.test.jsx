// @vitest-environment happy-dom
// Copy an exercise into another routine (#1466): the exercise sheet's Copy action lists the other
// routines; choosing one appends the slot there and leaves the source untouched.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sheets = vi.hoisted(() => ({
  exConfigSheet: vi.fn(), exercisePicker: vi.fn(), glyphPicker: vi.fn(), confirmSheet: vi.fn(), menuSheet: vi.fn(),
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => sheets)
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const bench = { id: '0025', sets: 4, reps: 6, weight: 80, note: 'touch and go' }
let root, host

function mount() {
  const S = clone(DEF)
  S.routines = [
    { id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [clone(bench)] },
    { id: 'r2', name: 'Pull', emoji: 'dumbbell', ex: [] },
  ]
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/plan/r/r1']}><Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes></MemoryRouter>))
}

beforeEach(() => {
  localStorage.clear()
  Object.values(sheets).forEach(mock => mock.mockReset())
  useUI.setState({ toastMsg: '' })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('RoutineEdit — Copy exercise to another routine', () => {
  it('lists the other routines and appends the slot to the chosen one', () => {
    mount()
    act(() => host.querySelector('[data-routine-row] .item .tap-main').click())
    const opts = sheets.exConfigSheet.mock.calls[0][8]
    expect(opts.onCopy).toBeTypeOf('function')
    act(() => opts.onCopy())
    expect(sheets.menuSheet).toHaveBeenCalledOnce()
    const menu = sheets.menuSheet.mock.calls[0][0]
    expect(menu.items.map(i => i.label)).toEqual(['Pull'])
    act(() => menu.items[0].onClick())
    expect(useStore.getState().S.routines[1].ex).toEqual([bench])
    expect(useStore.getState().S.routines[0].ex).toEqual([bench])
    expect(useUI.getState().toastMsg).toBe('Copied as “Pull”.')
  })
})
