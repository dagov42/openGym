// @vitest-environment happy-dom
// A superset grows to four from the group header and a member's menu, refuses a fifth with a
// toast, dissolves from the header, and has no merge/unpair actions on a circuit.
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
const clone = value => JSON.parse(JSON.stringify(value))
const ids = ['0001', '0007', '0009', '0002', '0010']
const row = done => ({ w: 20, r: 8, done })
const entry = (id, extra = {}) => ({
  id, target: { sets: 1, reps: 8, ...(extra.target || {}) }, sets: [row(false)], ...extra,
})
let root, container
const roots = []
function setActive(entries, extra = {}) {
  const S = clone(DEF)
  S.wc = { ...S.wc, pairButtons: true }
  S.hints = { ...S.hints, swipeSets: false }
  S.active = {
    id: 'superset-four', d: '2026-11-19', start: Date.now(), routineId: null,
    name: 'Superset four', bw: null, cur: 0, entries, ...extra,
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
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const groups = () => useStore.getState().S.active.entries.map(e => e.sg || null)

function openMemberMenu(index) {
  const block = container.querySelectorAll('.ss-ex')[index]
  click(block.querySelector('button[aria-label^="More"]'))
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const menuRoot = createRoot(host)
  roots.push(menuRoot)
  act(() => menuRoot.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

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
  act(() => { roots.splice(0).forEach(r => r.unmount()) })
  vi.clearAllTimers()
})

describe('a superset of up to four', () => {
  it('grows 2 to 3 to 4 from the group header, then refuses a fifth with a toast', () => {
    setActive([entry(ids[0], { sg: 'g' }), entry(ids[1], { sg: 'g' }), entry(ids[2]), entry(ids[3]), entry(ids[4])])
    render()
    click(button('Add next exercise to this superset'))
    expect(groups()).toEqual(['g', 'g', 'g', null, null])
    click(button('Add next exercise to this superset'))
    expect(groups()).toEqual(['g', 'g', 'g', 'g', null])
    click(button('Add next exercise to this superset'))
    expect(groups()).toEqual(['g', 'g', 'g', 'g', null])
    expect(useUI.getState().toastMsg).toBe('A superset holds up to 4 exercises')
  })

  it('grows from a member menu too, not only from the header', () => {
    setActive([entry(ids[0], { sg: 'g' }), entry(ids[1], { sg: 'g' }), entry(ids[2]), entry(ids[3]),
      entry(ids[4])])
    render()
    for (const expected of [
      ['g', 'g', 'g', null, null],
      ['g', 'g', 'g', 'g', null],
    ]) {
      const menu = openMemberMenu(0)
      const fold = [...menu.querySelectorAll('.menu-more')].find(b => b.textContent.includes('Add next exercise to this superset'))
      click(fold)
      const grow = [...menu.querySelectorAll('.menu-item:not(.menu-more)')].find(b => b.textContent.includes('Add next exercise to this superset'))
      click(grow)
      expect(groups()).toEqual(expected)
    }
  })

  it('grows in Focus and keeps the group header controls there', () => {
    setActive([entry(ids[0], { sg: 'g' }), entry(ids[1], { sg: 'g' }), entry(ids[2])], { workoutView: 'focus' })
    render()
    expect(container.querySelector('[data-testid="focus-view"]')).toBeTruthy()
    click(button('Add next exercise to this superset'))
    expect(groups()).toEqual(['g', 'g', 'g'])
  })

  it('the list header names all three members and grows there', () => {
    const name = { sgName: 'Push pair' }
    setActive([
      entry(ids[0], { sg: 'g', target: name }), entry(ids[1], { sg: 'g', target: name }), entry(ids[2]),
    ], { workoutView: 'list' })
    render()
    expect(container.querySelector('[data-testid="workout-list"]')).toBeTruthy()
    const header = container.querySelector('.ss-hd')
    expect(header.textContent).toContain('Push pair')
    expect(container.querySelectorAll('.ss-ex')).toHaveLength(2)
    click(button('Add next exercise to this superset'))
    expect(groups()).toEqual(['g', 'g', 'g'])
    expect(container.querySelectorAll('.ss-ex')).toHaveLength(3)
  })

  it('the header Unpair dissolves all four', () => {
    setActive([entry(ids[0], { sg: 'g' }), entry(ids[1], { sg: 'g' }), entry(ids[2], { sg: 'g' }), entry(ids[3], { sg: 'g' })])
    render()
    click(button('Unpair'))
    expect(groups()).toEqual([null, null, null, null])
  })

  it('a member menu removes one and leaves the rest grouped', () => {
    setActive([entry(ids[0], { sg: 'g' }), entry(ids[1], { sg: 'g' }), entry(ids[2], { sg: 'g' }), entry(ids[3], { sg: 'g' })])
    render()
    const menu = openMemberMenu(3)
    // The member's menu folds its rarer actions under More; open it before choosing.
    const more = [...menu.querySelectorAll('.menu-more')].find(b => b.textContent.includes('Remove from superset'))
    click(more)
    const remove = [...menu.querySelectorAll('.menu-item:not(.menu-more)')].find(b => b.textContent.includes('Remove from superset'))
    expect(remove).toBeTruthy()
    click(remove)
    expect(groups()).toEqual(['g', 'g', 'g', null])
  })

  it('removing a member from a group of three leaves the other two grouped', () => {
    setActive([entry(ids[0], { sg: 'g' }), entry(ids[1], { sg: 'g' }), entry(ids[2], { sg: 'g' })])
    render()
    const menu = openMemberMenu(2)
    const more = [...menu.querySelectorAll('.menu-more')].find(b => b.textContent.includes('Remove from superset'))
    click(more)
    const remove = [...menu.querySelectorAll('.menu-item:not(.menu-more)')].find(b => b.textContent.includes('Remove from superset'))
    click(remove)
    expect(groups()).toEqual(['g', 'g', null])
  })

  it('a circuit unit offers neither merge buttons nor Unpair', () => {
    const circuit = { mode: 'circuit', rounds: 3 }
    setActive([
      entry(ids[0], { sg: 'c', target: { sgCircuit: circuit } }),
      entry(ids[1], { sg: 'c', target: { sgCircuit: circuit } }),
    ])
    render()
    expect(button('Add next exercise to this superset')).toBeUndefined()
    expect(button('Add previous exercise to this superset')).toBeUndefined()
    expect(button('Unpair')).toBeUndefined()
  })
})


