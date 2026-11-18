// Edits of saved history, the profile's unit and the automatic backup, kept out of useStore.js.
// Each action receives the store's `get` and the two local helpers it needs; the state shape and
// persist/push behaviour stay in the store.
import { saveWorkoutEdit, deleteEditedWorkout } from '../../lib/session-edit.js'
import { convertStateUnit } from '../../lib/units.js'
import { highestStamp } from '../../lib/sync-merge.js'
import { MOBILE, writeAutoBackup } from '../../lib/mobile.js'

export function dataActions({ get, persist, clone }) {
  return {
    // An edit of a saved workout (lib/session-edit.js) is saved or dropped like any other change:
    // the store's own sync takes it to the server, and a conflict on the way is settled by
    // mergeStates like one between two devices. A save that cannot happen throws before anything
    // is written, and the editor stays open with the edits.
    saveHistoryEdit() {
      let saved = null
      get().update(S => { saved = saveWorkoutEdit(S) })
      return saved
    },
    discardHistoryEdit() { get().update(S => { S.active = null }) },
    // An edit that took out every set deletes the workout rather than saving it empty.
    deleteHistoryEdit() {
      let removed = false
      get().update(S => { removed = deleteEditedWorkout(S) })
      return removed
    },
    // Settings → unit. `convert` walks every stored weight into the new unit (lib/units.js); off,
    // only the label changes. Either way the choice is stamped (`unitSet`), so a merge with a
    // copy still in the old unit brings that copy over rather than mixing the two (lib/sync-merge.js),
    // and a conversion goes to the server at once, as an ordinary conditional push: another device
    // still logging in the old unit meets it on its very next push, and a copy it pushed first is
    // converted before it is merged in.
    setUnit(to, { convert = true } = {}) {
      const S0 = get().S
      if ((S0.unit || 'kg') === to) return null
      const S = clone(convert ? convertStateUnit(S0, to) : { ...S0, unit: to })
      S.unitSet = { at: Math.max(Date.now(), highestStamp(S0) + 1), convert }
      persist(S, true)
      return convert && get().ready ? get().pushState() : null
    },
    // Fires after the moments where losing local data would actually hurt — a workout just
    // logged, a routine just edited — not on every keystroke. No-op off mobile or with the
    // setting off; the private file mirror (nativePersist) already covers every change.
    autoBackupNow() {
      const S = get().S
      if (MOBILE && S.autoBackup) writeAutoBackup(S)
    },
  }
}
