# Feature specs, 2026-11-16

Status: index for the fork's planned work (`FORK_CHANGELOG.md` → "План фич"). **Nothing in this folder is
implemented by these files.** Six specs are agreed and ready for an implementation plan; the rest are
candidates or tasks with a proposed design and explicit open questions. A candidate is not a promise: read its
"Open questions" before starting, and get the same sign-off the agreed ones got.

Written for the fork (`dagov42/openGym`) but shaped to be upstreamable: pure logic in `frontend/src/lib`
with tests beside it, no new dependency, no telemetry, no server call unless the feature is about the
server, strings through `t()`/`tn()`, and new profile fields only where the value cannot be derived.

## The set

The UX candidates found in the closed-issue analysis (trash / recently deleted, setup doctor, diagnostics
bundle, duplicate review after import, weekly plan balance, bulk history actions, command palette) are listed
in `FORK_CHANGELOG.md` and do not have a spec yet. Pick one and it gets the same treatment as the files below.
Gesture settings were dropped: #897 and #921 are already fixed in code.

| Spec | Feature | Status | Order |
|---|---|---|---|
| [`2026-11-16-history-search-design.md`](2026-11-16-history-search-design.md) | Search and filter History by text, type, month and PR | **Agreed** | 1 |
| [`2026-11-16-session-length-design.md`](2026-11-16-session-length-design.md) | "≈55 min" on routines and the start preview | **Agreed** | 2 |
| [`2026-11-16-plan-pause-design.md`](2026-11-16-plan-pause-design.md) | A holiday/illness pause that nags nobody and keeps the streak | **Agreed** | 3 |
| [`2026-11-16-whats-new-design.md`](2026-11-16-whats-new-design.md) | A "What's new" sheet once per version, plus a Settings row | **Agreed** | 4 |
| [`2026-11-16-recent-routines-design.md`](2026-11-16-recent-routines-design.md) | Recent routines at the top of the start picker | **Agreed** | 5 |
| [`2026-11-16-keyboard-shortcuts-design.md`](2026-11-16-keyboard-shortcuts-design.md) | A shortcuts sheet, `?` and `/` for desktop users | **Agreed** | 6 |
| [`2026-11-16-lr-asymmetry-design.md`](2026-11-16-lr-asymmetry-design.md) | Left/right difference from the per-side data already logged | Candidate | 7 |
| [`2026-11-16-rest-hint-design.md`](2026-11-16-rest-hint-design.md) | A rest suggestion read from logged RIR/RPE | Candidate | 8 |
| [`2026-11-16-checkin-locker-design.md`](2026-11-16-checkin-locker-design.md) | Locker number on the gym check-in card (#1096) | Candidate | 9 |
| [`2026-11-16-single-set-weight-design.md`](2026-11-16-single-set-weight-design.md) | Change one working set's weight without the cascade (#1166) | Candidate | 10 |
| [`2026-11-16-injury-mode-design.md`](2026-11-16-injury-mode-design.md) | Flag an exercise that hurts, warn, offer the backup, pause progression | Candidate | 11 |
| [`2026-11-16-backup-preview-design.md`](2026-11-16-backup-preview-design.md) | Say what is inside a backup before it replaces the profile, plus a data health report | Candidate | 12 |
| [`2026-11-16-sync-merge-log-design.md`](2026-11-16-sync-merge-log-design.md) | A device-local log of what the sync merged, for trust and debugging | Candidate | 13 |
| [`2026-11-16-cardio-records-design.md`](2026-11-16-cardio-records-design.md) | Cardio records and pace trends from the data already stored | Candidate | 14 |
| [`2026-11-16-csv-mapper-design.md`](2026-11-16-csv-mapper-design.md) | Map an unknown CSV's columns once, then import it | Candidate | 15 |
| [`2026-11-16-catalogue-quality-design.md`](2026-11-16-catalogue-quality-design.md) | A semantic catalogue audit, Russian name casing, and regression invariants | Candidate | 16 |
| [`2026-11-16-fork-operations-design.md`](2026-11-16-fork-operations-design.md) | Test hygiene, a fork-status script, and a sync checklist | Task | 17 |
| [`2026-11-16-native-backlog-design.md`](2026-11-16-native-backlog-design.md) | Triage of the device-dependent issues (#1255, #1294/#1295, #1264, #1263) | Task | 18 |

## Decisions already made (do not re-open without a reason)

- **History search:** deep text search (workout name, routine names, exercise names in both languages,
  workout/entry/set notes, gym, day-note tags and text, recovery, activities); filters are type, month and PR
  only; routine and gym are found through the text; the month filters the list rather than scrolling to it; no
  new `S` field.
- **What's new:** an automatic sheet once per version (3–5 in-app items plus a changelog link) and a permanent
  Settings row; first install is silent; no network, no `S` field.
- **Recent routines:** the start picker only (five routines, 90 days); no second "recent" mode in the exercise
  picker, where "Chosen" already sorts by frequency.
- **Keyboard shortcuts:** the minimum — `?` for the list, `/` for the current screen's search, Escape for a
  sheet, and the existing workout keys; no single-letter navigation or command palette.
- **Session length:** a passive label only. No "fits in N minutes" in v1. History first (median of the last
  five sessions of that exact routine set, at least two), plan-based estimate until then. Shown in Plan and
  the start preview; not on Home, not in print, not on the watch.
- **Plan pause:** no catching up. Paused days are excused, not owed. The streak is preserved without spending
  a freeze or the sick/travel allowance. A running programme's week is held only when the sheet's switch is
  on (default on). Only the workout reminder and the missed-workout nudge go quiet; check-in/weight
  reminders stay. The app never blocks a workout during a pause; finishing one offers to end the pause.

## How to use a candidate spec

1. Read "Why", "Goals", "Non-goals" and "Open questions".
2. Answer the open questions (or delete the ones that no longer apply).
3. Only then write an implementation plan and touch code.
4. If the design changes while implementing, update the spec in the same PR: these files are the record of
   the decision, not a snapshot of an idea.
