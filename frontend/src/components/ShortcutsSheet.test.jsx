// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutsSheet } from './ShortcutsSheet.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
afterEach(() => { act(() => root?.unmount()); host?.remove() })

describe('ShortcutsSheet', () => {
  it('lists the workout and app keys and closes', () => {
    const close = vi.fn()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<ShortcutsSheet close={close} />))
    expect(host.textContent).toContain('Keyboard shortcuts')
    for (const text of ['Tick the next set', 'Previous or next exercise', 'Close a sheet', 'Search this screen', 'Show this list']) {
      expect(host.textContent).toContain(text)
    }
    expect([...host.querySelectorAll('kbd')].map(k => k.textContent)).toEqual(['Space', 'Enter', '←', '→', 'Esc', '/', '?'])
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Close')).click())
    expect(close).toHaveBeenCalled()
  })
})
