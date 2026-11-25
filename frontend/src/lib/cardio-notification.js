// The Android Lock Screen Stop action for a running cardio set (android/.../CardioTimer.java).
// The page starts a small ongoing notification with one Stop button. Tapping it while the phone is
// locked records the instant without opening the app; consumeStop() is read when the page comes
// back, and the minutes are written then. No-op outside the phone build or when the plugin is
// missing, so the web and older shells keep the existing clock.
import { Capacitor, registerPlugin } from '@capacitor/core'

let pluginP = null
const plugin = () => pluginP || (pluginP = (async () => {
  if (!Capacitor.isNativePlatform()) return null
  if (Capacitor.getPlatform() !== 'android') return null
  return registerPlugin('CardioTimer')
})().catch(() => null))

export async function startCardioNotification({ startedAt, label = '' } = {}) {
  if (!(Number(startedAt) > 0)) return false
  try {
    const p = await plugin()
    if (!p) return false
    await p.start({ startedAt: Number(startedAt), label: String(label || '').slice(0, 80) })
    return true
  } catch { return false }
}

export async function stopCardioNotification() {
  try { await (await plugin())?.stop() } catch { /* no notification to clear */ }
}

/** A stop tapped while the app was in the background, or null. Consumes it on the native side. */
export async function consumeCardioStop() {
  try {
    const p = await plugin()
    if (!p) return null
    const r = await p.consumeStop()
    return r && Number(r.stopAt) > 0 ? { startedAt: Number(r.startedAt), stopAt: Number(r.stopAt), label: r.label || '' } : null
  } catch { return null }
}
