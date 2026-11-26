// The Android Lock Screen Stop action for a running cardio set (android/.../CardioTimer.java).
// The page starts a small ongoing notification with one Stop button. Tapping it while the phone is
// locked records the instant without opening the app; consumeStop() is read when the page comes
// back, and the minutes are written then. No-op outside the phone build or when the plugin is
// missing, so the web and older shells keep the existing clock.
import { Capacitor, registerPlugin } from '@capacitor/core'

let pluginP = null
const plugin = () => {
  if (pluginP) return pluginP
  pluginP = (async () => {
    if (!Capacitor.isNativePlatform()) return null
    if (Capacitor.getPlatform() !== 'android') return null
    // Do not return the proxy itself from this async function: a Capacitor plugin proxy is
    // thenable enough for Promise resolution to ask it for `.then()`, which it does not implement.
    return { instance: registerPlugin('CardioTimer') }
  })().catch(() => {
    // The bridge may not have registered the plugin yet when the first call races app startup.
    // Do not cache that miss: the next start/stop tries again.
    pluginP = null
    return null
  })
  return pluginP
}

export async function startCardioNotification({ startedAt, label = '' } = {}) {
  if (!(Number(startedAt) > 0)) return false
  try {
    const loaded = await plugin()
    if (!loaded) return false
    await loaded.instance.start({ startedAt: Number(startedAt), label: String(label || '').slice(0, 80) })
    return true
  } catch {
    pluginP = null
    return false
  }
}

export async function stopCardioNotification() {
  try {
    const loaded = await plugin()
    if (!loaded) return
    await loaded.instance.stop()
  } catch {
    pluginP = null
  }
}

/** A stop tapped while the app was in the background, or null. Consumes it on the native side. */
export async function consumeCardioStop() {
  try {
    const loaded = await plugin()
    if (!loaded) return null
    const r = await loaded.instance.consumeStop()
    return r && Number(r.stopAt) > 0 ? { startedAt: Number(r.startedAt), stopAt: Number(r.stopAt), label: r.label || '' } : null
  } catch {
    pluginP = null
    return null
  }
}
