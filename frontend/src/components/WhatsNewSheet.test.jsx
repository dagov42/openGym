// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { WhatsNewSheet, openWhatsNew } from './WhatsNewSheet.jsx'
import { itemsFor, readSeen, SEEN_KEY } from '../lib/whats-new.js'
import { useUI } from '../store/useUI.js'

const roots = []
function mount(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  act(() => root.render(node))
  return host
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  try { localStorage.removeItem(SEEN_KEY) } catch { /* no storage */ }
})
afterEach(() => {
  for (const r of roots.splice(0)) act(() => r.unmount())
  document.body.innerHTML = ''
})

describe('WhatsNewSheet', () => {
  it('renders the items and the changelog link, and Got it closes it', () => {
    const close = vi.fn()
    const host = mount(<WhatsNewSheet version="1.4.8" items={itemsFor('1.4.8')} close={close} />)
    expect(host.textContent).toContain('What’s new in v1.4.8')
    expect(host.textContent).toContain('The Coach retries a long answer once after a dropped connection')
    expect(host.querySelector('a[href*="CHANGELOG.md"]')).not.toBeNull()
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Got it')).click())
    expect(close).toHaveBeenCalled()
  })

  it('marks the version as seen when the sheet is dismissed', () => {
    const host = mount(<WhatsNewSheet version="1.4.8" items={itemsFor('1.4.8')} close={() => {}} />)
    act(() => roots.pop().unmount())
    expect(readSeen()).toBe('1.4.8')
    document.body.removeChild(host)
  })
})

describe('openWhatsNew', () => {
  it('opens a sheet for a version with notes', () => {
    act(() => openWhatsNew('1.4.8'))
    expect(useUI.getState().sheets.at(-1)).toBeTruthy()
  })

  it('sends an unknown build to the changelog instead', () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      openWhatsNew('9.9.9')
      expect(opened).toHaveBeenCalledWith(expect.stringContaining('CHANGELOG.md'), '_blank', 'noopener')
    } finally { opened.mockRestore() }
  })
})
