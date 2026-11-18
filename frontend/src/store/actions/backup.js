// Reset and backup import: the two deliberate replacements of the whole profile. They stay out of
// useStore.js; the store passes the copy, persist and the import's one pending revision, and keeps
// replaceState itself because it arms the next push (replaceRev/forceNext).
import { api } from '../../lib/api.js'
import { entryKey, highestStamp, keepReset, mergeResetIds, resetIdsOf, stampRestore, stampReplace, mergeStates } from '../../lib/sync-merge.js'
import { sanitizeAccent } from '../../lib/accent.js'

export function backupActions(ctx) {
  const { get, persist, clone, restartedState, carryActive, currentSession, isCurrent, owes, readImportRead, writeImportRead, metaOf, writeSync, DEF } = ctx

  return {
    // Settings в†’ Reset everything: a new profile (restartedState), stamped with when (`resetAt`).
    // Pushed as a replace, and the stamp is what makes it hold: a device that has not seen the
    // reset and still pushes a change of its own gets the 409, and its merge keeps only what that
    // device made after the reset instead of bringing the whole profile back (lib/sync-merge.js).
    //
    // With it goes `resetIds`, the names of every entry the reset wiped: this copy's, the earlier
    // resets' (a copy older than those too is still judged right), and the server's once it
    // answers вЂ” it may hold entries this device never pulled. A device that has not seen the
    // reset loses exactly those, and keeps whatever else it holds, whatever its dates say.
    // Resolves once the server's names are in (or could not be had).
    resetEverything() {
      const cur = get().S
      const S = restartedState(cur)
      S.resetAt = Math.max(Date.now(), highestStamp(cur) + 1)
      S.resetIds = mergeResetIds(cur.resetIds, resetIdsOf(cur))
      get().replaceState(S, !!get().user)
      if (!get().user) return Promise.resolve()
      const tok = currentSession()
      return api('/api/data').then(res => {
        if (!isCurrent(tok)) return
        const now = get().S
        if (!res?.state || now.resetAt !== S.resetAt) return
        const ids = mergeResetIds(now.resetIds, mergeResetIds(res.state.resetIds, resetIdsOf(res.state)))
        if (JSON.stringify(ids) === JSON.stringify(now.resetIds)) return
        persist(Object.assign(clone(now), { resetIds: ids }), true)
      }).catch(() => {})
    },
    // Before a backup replaces this copy (Settings в†’ Import): the workouts the server holds that the
    // backup does not вЂ” logged since it was made, or on another device meanwhile. The import is a
    // deliberate replace and deletes them from the profile; the confirm says so and offers to merge
    // them in instead (importBackup). null when there are none, when nobody is signed in, or when
    // the server cannot be asked вЂ” the replace then goes as it always has.
    async importConflict(backup) {
      // No account (a phone in local mode, a guest): this copy is the only one there is, so the
      // workouts it holds that the backup lacks are asked about the same way, never just replaced.
      if (!get().user) {
        const key = w => entryKey('workouts', w)
        const inBackup = new Set((Array.isArray(backup?.workouts) ? backup.workouts : []).filter(Boolean).map(key))
        const here = (get().S.workouts || []).filter(w => w && !inBackup.has(key(w))).length
        return here ? { workouts: here, state: get().S, rev: null, device: true } : null
      }
      let res
      const tok = currentSession()
      try { res = await api('/api/data') } catch { return null }
      if (!isCurrent(tok)) return null
      const state = res?.state
      writeImportRead({ uid: get().user?.id, state: state || null, rev: res?.rev ?? null })
      if (!state) return null
      const key = w => entryKey('workouts', w)
      const inBackup = new Set((Array.isArray(backup?.workouts) ? backup.workouts : []).filter(Boolean).map(key))
      const server = (Array.isArray(state.workouts) ? state.workouts : []).filter(Boolean)
      const onServer = new Set(server.map(key))
      const workouts = server.filter(w => !inBackup.has(key(w))).length
      // This device's own workouts the server has not received yet go the same way, and count too.
      const mine = owes() ? (get().S.workouts || []).filter(w => w && !inBackup.has(key(w)) && !onServer.has(key(w))).length : 0
      return workouts + mine ? { workouts: workouts + mine, state, rev: res.rev, local: mine > 0 || owes() } : null
    },
    // A backup in place of this copy. With `mergeWith` вЂ” importConflict's answer вЂ” the server's copy
    // is merged in instead of replaced (with this device's changes not yet on it, when there are
    // any): the backup's settings and plan, every entry of all of them (mergeStates with the backup
    // preferred, in the backup's unit), pushed against that revision like any other change, so a
    // workout logged meanwhile elsewhere, or here, is not lost either.
    //
    // Either way the backup is a deliberate add-back (lib/sync-merge.js stampRestore): what it holds
    // stays, though this device or the server recorded it as deleted since, and its settings and
    // plan are the latest choice, on every device. The replace goes against the revision the check
    // read (or this copy's own): a change another device synced meanwhile is merged in, not wiped.
    importBackup(backup, { mergeWith } = {}) {
      const cur = get().S
      const uid = get().user?.id
      const stored = readImportRead()
      const read = mergeWith?.state ? mergeWith : stored && stored.uid === uid ? stored : null
      writeImportRead(null)
      const server = read?.state || null
      const now = Math.max(Date.now(), highestStamp(cur) + 1, highestStamp(server) + 1, highestStamp(backup) + 1)
      const next = sanitizeAccent(Object.assign(clone(DEF), backup))
      // A workout running here lives on this device only: no backup and no server copy holds it,
      // so the import keeps it (in the backup's unit). Only with none running does a backup taken
      // mid-workout bring its own session back. Both the replace and "Merge them in" dropped it.
      const running = carryActive(cur, next) || next.active || null
      // No account: "Merge them in" joins this copy's own entries into the backup's.
      if (mergeWith?.device && !uid) {
        const merged = keepReset(cur, Object.assign(clone(DEF), mergeStates(next, cur, { prefer: 'a' })))
        stampRestore(merged, [cur, next], now)
        merged._ts = now
        merged.active = carryActive({ unit: next.unit, active: running }, merged)
        persist(merged, false)
        return
      }
      if (!mergeWith?.state || !uid) {
        stampRestore(next, [cur, server], now)
        // вЂ¦and like a reset of what it replaces: an unsent change of another device from before it
        // no longer brings the replaced workouts back (lib/sync-merge.js stampReplace).
        stampReplace(next, [cur, server].filter(Boolean), now)
        next._ts = now
        next.active = running
        const at = read?.rev != null ? { rev: read.rev, wid: read.state?._wid } : metaOf().base
        get().replaceState(next, !!uid, { baseRev: at?.rev ?? null, baseWid: at?.wid })
        return
      }
      const others = mergeWith.local ? mergeStates(cur, mergeWith.state) : mergeWith.state
      // The merge keeps the backup's reset stamp (prefer); a later one this copy or the server's
      // holds stays, as it does on a replace.
      const merged = keepReset(others, keepReset(cur, Object.assign(clone(DEF), mergeStates(next, others, { prefer: 'a' }))))
      stampRestore(merged, [cur, mergeWith.state, next], now)
      merged._ts = now
      merged.active = carryActive({ unit: next.unit, active: running }, merged)
      persist(merged, true)
      if (mergeWith.rev != null) writeSync(mergeWith.rev, 0, mergeWith.state?._wid)
    },
  }
}

