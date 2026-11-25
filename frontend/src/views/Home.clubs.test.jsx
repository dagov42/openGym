// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '',
}))
vi.mock('../lib/gym-reminder.js', () => ({
  loadGymConfig: async () => ({ config: { on: false, gyms: [], window: null } }),
  saveGymConfig: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  useStore.setState(s => ({
    S: { ...s.S, routines: [], workouts: [], bodyweight: [], dayPlan: {}, week: {}, active: null, gymCards: [] },
    user: null,
  }))
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Home clubs', () => {
  it('offers Add a club when no club is saved', async () => {
    await act(async () => { root.render(<Home />) })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(host.textContent).toContain('Your gyms')
    expect(host.textContent).toContain('Add a club')
  })
})
