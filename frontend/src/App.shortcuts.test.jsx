// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

vi.mock('./lib/sound.js', async importOriginal => ({ ...(await importOriginal()), setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn(), setNativeBuzzer: vi.fn() }))
vi.mock('./lib/api.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const press = (key, extra = {}) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
})
const appear = async find => {
  for (let i = 0; i < 300 && !find(); i++) await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  return find()
}

beforeEach(async () => {
  localStorage.setItem('gym_guest', '1')
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) })
  window.location.hash = '#/library'
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<App />) })
})
afterEach(() => {
  act(() => root.unmount())
  useUI.getState().closeAll?.()
  host.remove()
  localStorage.removeItem('gym_guest')
})

describe('app-wide keyboard shortcuts', () => {
  it('/ focuses and selects the current screen search', async () => {
    const input = await appear(() => document.querySelector('[data-search]'))
    expect(input).toBeTruthy()
    input.value = 'bench'
    press('/')
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(5)
  })

  it('? opens the shortcuts sheet', async () => {
    await appear(() => document.querySelector('[data-search]'))
    press('?', { shiftKey: true })
    expect(document.body.textContent).toContain('Keyboard shortcuts')
    expect(useUI.getState().sheets.length).toBeGreaterThan(0)
  })
})
