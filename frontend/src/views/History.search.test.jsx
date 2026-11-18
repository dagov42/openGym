// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
let DEF, useStore

const clone = v => JSON.parse(JSON.stringify(v))
let observers = []
class FakeIO {
  constructor(cb) { this.cb = cb; this.els = []; observers.push(this) }
  observe(el) { this.els.push(el) }
  disconnect() { this.els = []; observers = observers.filter(o => o !== this) }
}
const reachEnd = () => act(() => { for (const o of [...observers]) o.cb(o.els.map(target => ({ target, isIntersecting: true }))) })

function install(over = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    routines: [{ id: 'r1', name: 'Push Day' }],
    week: {}, dayPlan: {}, active: null,
    workouts: [
      { id: 'w1', d: '2026-11-10', start: Date.parse('2026-11-10T10:00:00Z'), name: 'Bench day', note: 'Elbows in', routineIds: ['r1'], prs: [{ id: 'p1' }], entries: [{ id: '0025', sets: [{ note: 'Paused rep' }] }] },
      { id: 'w2', d: '2026-10-05', start: Date.parse('2026-10-05T10:00:00Z'), name: 'Squat day', entries: [], prs: [] },
    ],
    dayNotes: { '2026-09-01': { tag: 'sick', text: 'Flu', _ts: 1 } },
    recoverySessions: { r1: { d: '2026-08-01', kind: 'sauna', min: 20, note: 'Hot room', _ts: 1 } },
    activities: { a1: { d: '2026-07-01', sport: 'run', min: 30, title: 'Morning run', note: 'Rain', _ts: 1 } },
    ...over,
  })
  useStore.setState({ S: st, user: null })
}

const roots = []
function mount(History) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  act(() => root.render(<MemoryRouter><History /></MemoryRouter>))
  return host
}
const rows = host => host.querySelectorAll('.list .item').length
const input = host => host.querySelector('.searchf input')
const type = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
const clickText = (host, text) => act(() => {
  const b = [...host.querySelectorAll('button')].find(x => x.textContent.includes(text))
  if (!b) throw new Error('no button: ' + text)
  b.click()
})

describe('History search', () => {
  let History, PAGE
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.resetModules()
    observers = []
    window.IntersectionObserver = FakeIO
    ;({ DEF, useStore } = await import('../store/useStore.js'))
    ;({ default: History, HISTORY_PAGE: PAGE } = await import('./History.jsx'))
  }, 30000)
  afterEach(() => {
    for (const r of roots.splice(0)) act(() => r.unmount())
    document.body.innerHTML = ''
    delete window.IntersectionObserver
  })

  it('filters by every term and says how many matched', () => {
    install()
    const host = mount(History)
    expect(rows(host)).toBe(5)
    expect(input(host).hasAttribute('data-search')).toBe(true)
    type(input(host), 'bench')
    expect(rows(host)).toBe(1)
    expect(host.querySelector('[aria-live="polite"]').textContent).toBe('1 match')
    type(input(host), 'bench elbows')
    expect(rows(host)).toBe(1)
    type(input(host), 'bench rain')
    expect(rows(host)).toBe(0)
    expect(host.textContent).toContain('No matches for “bench rain”')
  })

  it('filters by type, PR and clears back to the full list', () => {
    install()
    const host = mount(History)
    clickText(host, 'Notes')
    expect(rows(host)).toBe(1)
    expect(host.textContent).toContain('Flu')
    clickText(host, 'All')
    clickText(host, 'PRs')
    expect(rows(host)).toBe(1)
    expect(host.textContent).toContain('Bench day')
    clickText(host, 'PRs')
    expect(rows(host)).toBe(5)
  })

  it('keeps a query when the clear button and Escape reset it', () => {
    install()
    const host = mount(History)
    type(input(host), 'sauna')
    expect(rows(host)).toBe(1)
    act(() => host.querySelector('.searchf .clear').click())
    expect(rows(host)).toBe(5)
    type(input(host), 'sauna')
    act(() => input(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(rows(host)).toBe(5)
  })

  it('clear all in the empty state restores every row', () => {
    install()
    const host = mount(History)
    type(input(host), 'nothing-matches-this')
    expect(rows(host)).toBe(0)
    clickText(host, 'Clear all')
    expect(rows(host)).toBe(5)
  })

  it('pages a filtered list with the same observer', () => {
    const workouts = Array.from({ length: 150 }, (_, i) => ({ id: 'w' + i, d: '2026-11-' + String((i % 28) + 1).padStart(2, '0'), start: i, name: 'Push ' + i, entries: [], prs: [] }))
    install({ workouts, dayNotes: {}, recoverySessions: {}, activities: {} })
    const host = mount(History)
    type(input(host), 'push')
    expect(rows(host)).toBe(PAGE)
    reachEnd()
    expect(rows(host)).toBe(2 * PAGE)
  })
})
