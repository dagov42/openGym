// Screen Wake Lock — keeps the display on while a workout is running, so nobody has to
// unlock their phone between sets.
//
// The browser drops the lock on its own whenever the document stops being visible (tab
// switch, app backgrounded, screen locked by hand). A one-shot request therefore works
// exactly once and then silently dies, which is why `holds` is kept as our own intent
// and the lock is re-acquired on every visibilitychange for as long as it holds.
import { useEffect } from 'react'

export const wakeLockSupported = () => 'wakeLock' in navigator

let sentinel = null       // the live WakeLockSentinel, null when we hold nothing
let holds = 0             // request() calls that have not been released yet
let pending = false       // a request() is in flight — don't stack a second one

async function acquire() {
  if (!holds || sentinel || pending || !wakeLockSupported()) return
  if (document.visibilityState !== 'visible') return   // request() rejects on a hidden document
  pending = true
  try {
    const s = await navigator.wakeLock.request('screen')
    if (!holds) { s.release().catch(() => {}); return }   // released while we were awaiting
    sentinel = s
    s.addEventListener('release', () => { if (sentinel === s) sentinel = null })
  } catch (e) {
    // iOS refuses in Low Power Mode, and some browsers refuse on low battery. Nothing to
    // do about it and nothing the user could act on — stay quiet and try again next time
    // the document becomes visible.
    sentinel = null
  } finally { pending = false }
}

const onVisible = () => { if (document.visibilityState === 'visible') acquire() }

/**
 * One hold on the screen lock. Callers pair every call with releaseWakeLock(): the workout and
 * the circuit player can both hold it, and the last release is the one that lets the screen sleep.
 */
export function requestWakeLock() {
  holds++
  if (holds > 1) return
  document.addEventListener('visibilitychange', onVisible)
  acquire()
}

export function releaseWakeLock() {
  if (!holds) return
  holds--
  if (holds) return
  document.removeEventListener('visibilitychange', onVisible)
  const s = sentinel
  sentinel = null
  if (s) s.release().catch(() => {})
}

// Holds the lock for as long as `enabled` stays true.
export function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled) return
    requestWakeLock()
    return releaseWakeLock
  }, [enabled])
}

/**
 * Whether this profile wants the screen kept on right now: a workout is running (not the editor of
 * a saved one), the setting is on, and the workout is not paused. A paused workout waits for you,
 * possibly for hours, and used to hold the screen awake the whole time (QA 1.4.5).
 */
export const wantsWakeLock = S => !!S?.active && !S.active.editingWorkoutId && !S.active.pausedAt && S.keepAwake !== false
