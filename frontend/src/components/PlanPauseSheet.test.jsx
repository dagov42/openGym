// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanPause } from './PlanPauseSheet.jsx'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
const mount = close => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<PlanPause close={close} />))
}
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text))

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: { weekStart: 1, routines: [], workouts: [], planPauses: {} } })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('PlanPause', () => {
  it('saves a holiday pause and closes', () => {
    const close = vi.fn()
    mount(close)
    act(() => button('Save').click())
    const p = useStore.getState().S.planPauses[todayISO()]
    expect(p).toMatchObject({ reason: 'holiday' })
    expect(p.to).toBeTruthy()
    expect(close).toHaveBeenCalled()
  })

  it('shows Resume now for a pause covering today and ends it', () => {
    useStore.setState({ S: { weekStart: 1, routines: [], workouts: [], planPauses: { [todayISO()]: { to: null, reason: 'sick', _ts: 1 } } } })
    const close = vi.fn()
    mount(close)
    act(() => button('Resume now').click())
    expect(useStore.getState().S.planPauses[todayISO()]).toEqual({ _ts: expect.any(Number) })
    expect(close).toHaveBeenCalled()
  })
})
