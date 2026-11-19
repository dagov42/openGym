// @vitest-environment happy-dom
// Collapse sets folds the set rows, not the exercise: its media, description and menu stay open,
// so a finished exercise can still be read or discussed while its numbers are put away.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout, { _resetFoldedUnits } from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))
vi.mock('../components/Media.jsx', () => ({ default: () => <div data-testid="exercise-media" /> }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
let root, container

function mount(entries, view = 'cards') {
  const S = clone(DEF)
  S.hints = { ...S.hints, swipeSets: false }
  S.active = {
    id: 'collapse-test', d: '2026-11-19', start: Date.now(), routineId: null,
    name: 'Collapse test', bw: null, cur: 0, workoutView: view, entries,
  }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

const click = target => act(() => target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text)

beforeEach(() => {
  _resetFoldedUnits()
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null, swipeHint: null, setFlash: null })
  useStore.setState({ S: clone(DEF), user: null })
  root = null
  container = null
})

afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  root = container = null
})

describe('Collapse sets', () => {
  it('hides only the set rows; media and description stay open', () => {
    mount([{
      id: '0025',
      target: { sets: 2, reps: 8 },
      note: 'Straight back, slow down.',
      sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: true }],
    }])
    expect(container.querySelectorAll('.setrow')).toHaveLength(2)
    expect(container.querySelector('[data-testid="exercise-media"]')).toBeTruthy()

    click(button('Collapse sets'))

    expect(container.querySelector('.setrow')).toBeNull()
    expect(container.querySelector('.sethead')).toBeNull()
    expect(container.querySelector('[data-testid="exercise-media"]')).toBeTruthy()
    expect(container.textContent).toContain('Straight back, slow down.')
    expect(button('Show the sets')).toBeTruthy()

    click(button('Show the sets'))
    expect(container.querySelectorAll('.setrow')).toHaveLength(2)
  })

  it('keeps the exercise heading visible in a superset too', () => {
    mount([
      { id: '0025', target: { sets: 1, reps: 8 }, sets: [{ w: 60, r: 8, done: true }], sg: 'sg-0' },
      { id: '0007', target: { sets: 1, reps: 8 }, sets: [{ w: 20, r: 8, done: true }], sg: 'sg-0' },
    ])
    click(button('Collapse sets'))
    expect(container.querySelectorAll('.setrow')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="exercise-media"]')).toHaveLength(2)
    expect(container.textContent.toLowerCase()).toContain('barbell bench press')
  })
})
