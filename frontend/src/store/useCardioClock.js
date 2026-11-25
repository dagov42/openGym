// The count-up clock on a cardio set (lib/cardio-clock.js decides, this runs it): one at a time.
// Its own store, like the circuit player's, since it is neither a rest nor a hold: it stops
// neither, and neither stops it. The run is only where it started and for which set, kept in
// localStorage and never on the set or in the synced state, so it counts on in the background
// and across a reload, and the row's face reads the time off Date.now().
import { create } from 'zustand'
import { useStore } from './useStore.js'
import { minutesFor, parseRun, runAt, runSec } from '../lib/cardio-clock.js'
import { settleSpeed } from '../lib/distance.js'
import { startCardioNotification, stopCardioNotification, consumeCardioStop } from '../lib/cardio-notification.js'

export const CARDIO_CLOCK_KEY = 'gym_cardio_clock'
const store = () => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
const save = run => { try { if (run) store()?.setItem(CARDIO_CLOCK_KEY, JSON.stringify(run)); else store()?.removeItem(CARDIO_CLOCK_KEY) } catch { /* the clock just does not outlive a reload */ } }
const load = () => { try { return parseRun(store()?.getItem(CARDIO_CLOCK_KEY) || 'null') } catch { return null } }

export const useCardioClock = create((set, get) => ({
  run: null,   // { wid, idx, i, id, startedAt }: the workout, entry and set being timed
  // Starting one stops the one running, which writes its time to its own row.
  start(idx, i, now = Date.now()) {
    const A = useStore.getState().S?.active
    const e = A?.entries?.[idx]
    if (!e || !e.sets?.[i] || e.sets[i].done) return
    get().stop(now)
    set({ run: { wid: A.id, idx, i, id: e.id, startedAt: now } })
    void startCardioNotification({ startedAt: now, label: e.name || '' })
  },
  // Stopped (■, a tick, Finish): the minutes go to the row, as if typed there. `now` is when it
  // stopped, for a stop heard of late (a Log set on the Lock Screen, a Finish on the watch).
  // Returns that time when minutes were written, else null: Finish ends the workout no earlier.
  stop(now = Date.now()) {
    const run = get().run
    if (!run) return null
    set({ run: null })
    void stopCardioNotification()
    const min = minutesFor(runSec(run, useStore.getState().S?.active, now))
    if (min == null) return null
    let wrote = false
    useStore.getState().update(s => {
      const at = runAt(s.active, run)
      if (!at) return
      const st = s.active.entries[at.idx].sets[at.i]
      st.min = min
      // A row logged by distance keeps its speed in step with the minutes (Workout setField).
      if (Number(st.km) > 0) settleSpeed(st)
      wrote = true
    }, true)
    return wrote ? now : null
  },
  // Gone with its set, its exercise or its workout: nothing to write.
  drop() { if (get().run) { set({ run: null }); void stopCardioNotification() } },
}))

/** Apply a Stop tapped from the Lock Screen notification. The native side stores the exact
 *  instant, so the minutes match when the finger stopped, not when the phone was unlocked. */
export async function applyNativeCardioStop() {
  const run = useCardioClock.getState().run
  if (!run || !useStore.getState().S?.active) return false
  const stop = await consumeCardioStop()
  if (!stop || Number(stop.startedAt) !== Number(run.startedAt)) return false
  useCardioClock.getState().stop(stop.stopAt)
  return true
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void applyNativeCardioStop() })
  void applyNativeCardioStop()
}
useCardioClock.subscribe((s, prev) => { if (s.run !== prev.run) save(s.run) })

/** The run kept from before a reload. Whether it still belongs to the workout on screen is the
 *  screen's to check (runAt), since the workout may load after this. */
export function restoreCardioClock() {
  const run = load()
  if (run) useCardioClock.setState({ run })
  return !!run
}
restoreCardioClock()
