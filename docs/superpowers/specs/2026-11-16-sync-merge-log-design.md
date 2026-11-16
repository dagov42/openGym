# Recent sync activity

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented.

## Why

The sync contract is deliberately complex: per-field stamps, a server revision, a 409 that returns the current
document, merges that keep the newest edit of each field, and deletions that stay deleted (`sync-merge.js`,
`sync-stamps.js`). It works, and when it works nobody notices. When something looks wrong — "my routine edit
came back", "the phone and laptop disagree" — there is nothing to look at: the merge leaves no trace, and the
only answer is "it should have merged".

A short, device-local log of what was merged turns a mystery into a fact. It is not a new sync mechanism; it
is a receipt.

## Goals

1. A "Recent sync activity" list in Settings → Data & backup: the last N (50) merges this device did.
2. One line per event: when, what kind (pull, push, conflict), how many fields/changes were merged, and which
   fields differed.
3. Conflicts name the field and which side won ("restSec — kept this device"), never the values.
4. Device-local only: not synced, not in the backup, not on the server.
5. A **Clear** action, and no automatic upload of the log anywhere.

## Non-goals

- A server-side merge log or an admin view of other devices' merges.
- Changing the merge rules, adding a "resolve manually" UI, or undoing a merge.
- Logging every poll: only merges that actually changed something (or a conflict) are interesting.
- Values, workout contents, names or free text in the log.

## Data

`localStorage['gym_sync_log_v1']`, a ring buffer of 50 entries:

```js
{ at: 1763..., kind: 'pull' | 'push' | 'conflict',
  rev: 12,                 // the server revision the merge ended on, when known
  changed: ['workouts', 'routines'],   // top-level fields that changed
  conflicts: [{ key: 'restSec', winner: 'local' | 'server' }] }
```

- Written after `mergeStates` resolves a pull or a push, from the store's sync path. `mergeStates` itself stays
  pure: give it an optional `log` array (the same pattern `streakWalk` uses) or return a summary that the
  caller records. Do not change its return shape in a way every caller has to chase.
- `changed`/`conflicts` are top-level field names and, for stamped maps, the specific key (`exNotes:0025`).
  This is the minimum needed to answer "what moved".
- No values, no titles, no notes: field names only, so a log is safe to screenshot.
- The log is pruned to 50 entries; a corrupt log reads as empty and is overwritten on the next write.

## Where it shows

- Settings → Data & backup, a row **Recent sync activity** with the last event's time as its subtitle; the
  sheet lists the entries newest first, grouped by day, with a **Clear** button.
- Empty state: "Nothing synced yet. The log keeps the last 50 merges on this device."
- A conflict line reads `restSec — kept this device` or `edited — kept the server`, using the existing words
  for the device/server in the sync UI.
- No Home card, no notification.

## Edge cases

- A pull that changes nothing: no entry (or an entry with `changed: []`? Proposal: no entry).
- A 409 retry: one entry for the merge that finally succeeded, plus the conflict fields; not one per retry.
- A first sign-in that adopts the server's profile: `kind: 'pull'` with a large `changed` list; useful.
- Sign-out and sign-in as another profile: the log is per device, not per profile. Proposal: clear it on
  sign-out, so the next profile does not inherit a stranger's history.
- A local-only profile: no entries.
- A log from an older app version: unknown keys are ignored; a missing log is empty.
- Two tabs writing: the last write wins; a 50-entry ring is not worth a merge.
- Privacy: a field name like `exNotes:0025` names an exercise id, not a note; acceptable. Do not log
  `coach` or anything under `NEVER` (tokens/photos) even as a name.

## Tests

- Pure: entries appended, ring caps at 50, clear, corrupt JSON reads empty.
- Merge summary: a clean pull, a field conflict, a stamped-map key conflict, a deletion (tombstone), a
  no-change case.
- Store integration: a pull and a push each write one entry; a retry writes one.
- UI: rows, empty state, clear, no values rendered.
- Sign-out clears the log (if that proposal is accepted).

## Open questions

1. **What counts as a conflict:** both sides changed the same field since the last common revision (proposed),
   or every field the merge had to choose? Proposal: both changed; a one-sided change is a normal merge, not a
   conflict.
2. **Log placement:** Settings → Data & backup (proposed) or the connection status sheet? Proposal: Data &
   backup; it is about the data, and the connection sheet is about the network.
3. **Sign-out policy:** clear (proposed) or keep a device-local journal across profiles? Proposal: clear; a
   stranger's merge history is not useful.
