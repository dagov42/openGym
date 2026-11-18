// @vitest-environment happy-dom
// The update download is a background job now: its sheet can be hidden, and a finished download
// asks before opening the installer (or leaves a toast with Install while a workout is running).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const HEX = 'a'.repeat(64)
const m = vi.hoisted(() => ({
  S: {}, sheets: [], confirm: vi.fn(), toast: vi.fn(), install: vi.fn(),
  release: null, download: vi.fn(), fetch: vi.fn(),
}))
const makeStore = get => {
  const u = () => get()
  u.getState = get
  return u
}
vi.mock('../lib/i18n.js', () => ({ t: (s, ...a) => a.reduce((out, v, i) => out.replace(`{${i}}`, v), s) }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: true, isAndroid: async () => true }))
vi.mock('../lib/channel.js', () => ({ getChannel: async () => 'sideload' }))
vi.mock('../lib/update.js', () => ({
  checkForUpdate: vi.fn(),
  fetchChecksum: (...a) => m.fetch(...a),
  downloadUpdate: (...a) => m.download(...a),
  installDownloadedUpdate: (...a) => m.install(...a),
}))
vi.mock('../store/useStore.js', () => ({ useStore: makeStore(() => ({ S: m.S })) }))
vi.mock('../store/useUI.js', () => ({
  useUI: Object.assign(() => ({ sheets: m.sheets, toast: m.toast }), {
    getState: () => ({
      sheets: m.sheets,
      toast: m.toast,
      openSheet: (render, opts) => {
        const id = m.sheets.length + 1
        const close = () => { m.sheets = m.sheets.filter(x => x.id !== id) }
        m.sheets.push({ id, render, opts, close })
        return { id, close }
      },
    }),
  }),
}))
vi.mock('../sheets.jsx', () => ({ confirmSheet: (...a) => m.confirm(...a) }))

const { installUpdate } = await import('./UpdateNotice.jsx')

beforeEach(() => {
  m.S = {}
  m.sheets = []
  for (const f of [m.confirm, m.toast, m.install, m.fetch]) f.mockReset()
  m.fetch.mockResolvedValue(HEX)
  m.install.mockResolvedValue()
  m.download.mockImplementation(() => new Promise(resolve => { m.release = resolve }))
  localStorage.clear()
})
afterEach(() => { document.body.innerHTML = '' })

const info = { latestVersion: '9.9.9', apkUrl: 'https://x/a.apk', hashUrl: 'https://x/a.sha256' }
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

describe('installUpdate', () => {
  it('opens an unlocked progress sheet, hides it, and asks before installing', async () => {
    const run = installUpdate(info)
    await vi.waitFor(() => expect(m.sheets).toHaveLength(1))
    expect(m.sheets[0].opts).toEqual({ locked: false })
    m.release()
    await run
    expect(m.sheets).toHaveLength(0)
    expect(m.install).not.toHaveBeenCalled()
    expect(m.confirm).toHaveBeenCalledTimes(1)
    expect(m.confirm.mock.calls[0][0].title).toBe('Update downloaded')
    m.confirm.mock.calls[0][0].onConfirm()
    expect(m.install).toHaveBeenCalledWith(HEX)
  })

  it('during a workout it leaves a non-blocking toast instead of a modal', async () => {
    m.S = { active: { id: 'w' } }
    const run = installUpdate(info)
    await vi.waitFor(() => expect(m.sheets).toHaveLength(1))
    m.release()
    await run
    expect(m.confirm).not.toHaveBeenCalled()
    expect(m.toast).toHaveBeenCalledTimes(1)
    const [, opts] = m.toast.mock.calls[0]
    expect(opts.action).toBe('Install')
    opts.onAction()
    expect(m.install).toHaveBeenCalledWith(HEX)
  })

  it('the progress sheet has a hide control that does not cancel the download', async () => {
    const run = installUpdate(info)
    await vi.waitFor(() => expect(m.sheets).toHaveLength(1))
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(m.sheets[0].render(m.sheets[0].close)))
    const hide = host.querySelector('button[aria-label="Hide"]')
    expect(hide).toBeTruthy()
    act(() => hide.click())
    expect(m.sheets).toHaveLength(0)
    expect(m.release).toBeTruthy()   // still waiting: the download is not cancelled
    m.release()
    await run
    act(() => root.unmount())
  })
})
