// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GymPaste } from './GymPasteSheet.jsx'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host

const mount = props => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<GymPaste {...props} />))
}

const type = text => {
  const area = host.querySelector('textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  act(() => {
    setter.call(area, text)
    area.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text))

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('GymPaste', () => {
  it('shows a parsed Yandex card and continues with its point', () => {
    const onUse = vi.fn()
    mount({ close: vi.fn(), onUse, near: null })
    type('DDX Fitness Шараповский пр., вл2с3 https://yandex.ru/maps/org/ddx-fitness/123/?ll=37.6,55.7')
    expect(host.textContent).toContain('DDX Fitness')
    expect(host.textContent).toContain('Шараповский пр., вл2с3')
    act(() => button('Continue').click())
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ name: 'DDX Fitness', address: 'Шараповский пр., вл2с3', lat: 55.7, lng: 37.6 }))
  })

  it('uses the current area when a 2GIS card has no point, and still keeps its name', () => {
    const onUse = vi.fn()
    mount({ close: vi.fn(), onUse, near: { lat: 55.75, lng: 37.62 } })
    type('DDX Fitness https://2gis.ru/moscow/geo/70000001000000000')
    act(() => button('Continue').click())
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ name: 'DDX Fitness', lat: 55.75, lng: 37.62 }))
  })

  it('refuses a card with no point and no current area', () => {
    const onUse = vi.fn()
    mount({ close: vi.fn(), onUse, near: null })
    type('DDX Fitness https://2gis.ru/moscow/geo/70000001000000000')
    act(() => button('Continue').click())
    expect(onUse).not.toHaveBeenCalled()
    expect(host.textContent).toContain('no coordinates')
  })

  it('reads the clipboard on request', async () => {
    const onUse = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => 'DDX Fitness https://2gis.ru/moscow/geo/70000001000000000' } })
    mount({ close: vi.fn(), onUse, near: null })
    await act(async () => { button('Paste from clipboard').click() })
    expect(host.querySelector('textarea').value).toContain('DDX Fitness')
  })
})
