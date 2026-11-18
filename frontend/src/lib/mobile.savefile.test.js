import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  write: vi.fn(async () => ({ uri: 'file:///cache/opengym-backup.json' })),
  append: vi.fn(async () => ({})),
  getUri: vi.fn(async () => ({ uri: 'file:///cache/opengym-backup.zip' })),
}))
const native = vi.hoisted(() => ({ save: vi.fn(async () => ({ saved: true })) }))

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: fs.write, appendFile: fs.append, getUri: fs.getUri },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ save: native.save }) }))

const { saveExport, saveExportBlob } = await import('./mobile.js')

beforeEach(() => {
  for (const f of [fs.write, fs.append, fs.getUri, native.save]) f.mockClear()
  native.save.mockResolvedValue({ saved: true })
  fs.write.mockResolvedValue({ uri: 'file:///cache/opengym-backup.json' })
  fs.getUri.mockResolvedValue({ uri: 'file:///cache/opengym-backup.zip' })
})

describe('saveExport', () => {
  it('writes the text to the cache and asks the native picker for a destination', async () => {
    await expect(saveExport('{"a":1}', 'opengym-backup.json', 'application/json')).resolves.toBe('saved')
    expect(fs.write).toHaveBeenCalledWith({ path: 'opengym-backup.json', directory: 'CACHE', data: '{"a":1}', encoding: 'utf8' })
    expect(native.save).toHaveBeenCalledWith({
      path: 'file:///cache/opengym-backup.json',
      filename: 'opengym-backup.json',
      mime: 'application/json',
    })
  })

  it('tells cancellation apart from a save', async () => {
    native.save.mockResolvedValueOnce({ cancelled: true })
    await expect(saveExport('x', 'x.json', 'application/json')).resolves.toBe('cancelled')
  })

  it('writes a blob to the cache and uses the zip MIME', async () => {
    await expect(saveExportBlob(new Blob(['abc']), 'opengym-backup.zip', 'application/zip')).resolves.toBe('saved')
    expect(fs.write).toHaveBeenCalled()
    expect(native.save).toHaveBeenCalledWith({
      path: 'file:///cache/opengym-backup.zip',
      filename: 'opengym-backup.zip',
      mime: 'application/zip',
    })
  })
})
