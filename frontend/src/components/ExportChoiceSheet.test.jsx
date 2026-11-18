// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ save: vi.fn(), saveBlob: vi.fn(), share: vi.fn(), shareBlob: vi.fn(), toast: vi.fn() }))
vi.mock('../store/useUI.js', () => {
  const snap = { toast: (...a) => mocks.toast(...a), openSheet: vi.fn() }
  const useUI = selector => (selector ? selector(snap) : snap)
  useUI.getState = () => snap
  return { useUI }
})
vi.mock('../lib/mobile.js', () => ({
  MOBILE: false,
  saveExport: (...a) => mocks.save(...a),
  saveExportBlob: (...a) => mocks.saveBlob(...a),
  shareExport: (...a) => mocks.share(...a),
  shareExportBlob: (...a) => mocks.shareBlob(...a),
}))
const { ExportChoiceSheet } = await import('./ExportChoiceSheet.jsx')

let root, host, close
const button = text => [...host.querySelectorAll('.lrow-t')].find(e => e.textContent === text)?.closest('button')
const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  for (const f of Object.values(mocks)) f.mockReset()
  mocks.save.mockResolvedValue('saved')
  mocks.saveBlob.mockResolvedValue('saved')
  close = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = props => act(() => root.render(<ExportChoiceSheet close={close} {...props} />))

describe('ExportChoiceSheet', () => {
  it('saves text to the place the system picker returns', async () => {
    render({ text: '{"a":1}', filename: 'backup.json', mime: 'application/json' })
    act(() => button('Save to device').click())
    await flush()
    expect(mocks.save).toHaveBeenCalledWith('{"a":1}', 'backup.json', 'application/json')
    expect(close).toHaveBeenCalled()
  })

  it('saves a zip through the blob path', async () => {
    const blob = new Blob(['x'])
    render({ blob, filename: 'backup.zip', mime: 'application/zip' })
    act(() => button('Save to device').click())
    await flush()
    expect(mocks.saveBlob).toHaveBeenCalledWith(blob, 'backup.zip', 'application/zip')
  })

  it('offers the share sheet as the other way out', async () => {
    render({ text: 'x', filename: 'plan.json', mime: 'application/json' })
    act(() => button('Share').click())
    await flush()
    expect(mocks.share).toHaveBeenCalledWith('x', 'plan.json')
    expect(close).toHaveBeenCalled()
  })
})
