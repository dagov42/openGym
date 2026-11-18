// Read-only sync helpers: what this device still owes, and the copies a forced sign-out or
// disconnect kept. The push/pull state machine stays in useStore.js; these only read state.
import { pendingRefCount } from '../../lib/media-owed.js'
import { countChanges } from '../../lib/sync-changes.js'
import { keptHashes } from '../../lib/media-refs.js'

export function syncReadActions({ get, owes, readFingerprint, readStashes, stashKey }) {
  return {
    // What this device holds that the server has not seen: `owed` when anything would be lost by
    // wiping the copy now, `count` how many workouts, weigh-ins, routines and custom exercises
    // differ from the last copy the two agreed on (plus one for settings and the plan) — null
    // when the device has no record of that copy (it last agreed with the server under an older
    // version), and then only `owed` is known.
    //
    // `media` counts the custom exercises whose photo or video the server has not confirmed
    // (lib/media-owed.js); present only when there are any, and they are owed on their own.
    unsyncedChanges() {
      if (!get().user) return { owed: false, count: 0 }
      const media = pendingRefCount(get().S)
      const withMedia = media ? { media } : {}
      if (!owes()) return { owed: media > 0, count: 0, ...withMedia }
      const count = countChanges(get().S, readFingerprint())
      return { owed: count !== 0 || media > 0, count, ...withMedia }
    },
    // The changes a forced sign-out or disconnect kept on this device, waiting for their server
    // and account: [{ server, uid, name, at }] — server null for a phone whose pairing was lost
    // with its address. The copies themselves stay inside the store. `keptRev` moves whenever
    // they change, for a screen listing them to ask again.
    async keptChanges() {
      const all = await readStashes()
      return Object.values(all).map(({ server, uid, name, at }) => ({ server: server || null, uid, name, at }))
    },
    // The copy kept for one account (keptChanges' server and uid), to save as a backup file.
    async keptState(server, uid) {
      const all = await readStashes()
      return all[stashKey(server, uid)]?.state || null
    },
    // Every photo and video file the stashes refer to: they are kept on this device for as long
    // as the stash is (lib/media-sync.js localMediaGc, Reset everything).
    async stashedMediaHashes() {
      const all = await readStashes()
      return new Set(Object.values(all).flatMap(e => [...keptHashes(e?.state)]))
    },
  }
}
