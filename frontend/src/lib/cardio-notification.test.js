import { afterEach, describe, expect, it, vi } from 'vitest'

// A Capacitor plugin proxy is thenable enough that returning it from an async loader used to
// make Promise resolution call `.then()` on it. The loader must wrap it, never return it raw.
describe('cardio notification bridge', () => {
  afterEach(() => { vi.resetModules(); vi.restoreAllMocks() })

  it('resolves a wrapped plugin and starts it without treating the proxy as a promise', async () => {
    const start = vi.fn(async () => {})
    const stop = vi.fn(async () => {})
    const consumeStop = vi.fn(async () => ({ startedAt: 10, stopAt: 20, label: 'Run' }))
    const proxy = {
      start, stop, consumeStop,
      then() { throw new Error('the plugin proxy must not be awaited') },
    }
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
      registerPlugin: () => proxy,
    }))
    const mod = await import('./cardio-notification.js')
    expect(await mod.startCardioNotification({ startedAt: 10, label: 'Run' })).toBe(true)
    expect(start).toHaveBeenCalledWith({ startedAt: 10, label: 'Run' })
    expect(await mod.consumeCardioStop()).toEqual({ startedAt: 10, stopAt: 20, label: 'Run' })
  })

  it('is a no-op on the web', async () => {
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
      registerPlugin: () => { throw new Error('must not register') },
    }))
    const mod = await import('./cardio-notification.js')
    expect(await mod.startCardioNotification({ startedAt: 10 })).toBe(false)
    expect(await mod.consumeCardioStop()).toBe(null)
  })
})
