# Plan pause

Status: agreed 2026-11-16, implemented 2026-11-25 (the lifter's calls: no catching up; the streak is preserved without spending
anything; a running programme is held only when the sheet's switch is on; workout reminder and nudge go
quiet, nothing else; the pause may be open-ended; a workout during the pause is allowed and offers to end it).
Implemented: `S.planPauses`, `api/coach/core/plan-pause.js`, Plan/Home/Settings sheet. The post-workout
offer to end the pause is still a follow-up; the pause itself never blocks a workout.

## Why

Life interrupts training: a holiday, a flu, a week where the gym is shut. Today the app has three partial
answers and no single one:

- `S.dayNotes` (`frontend/src/lib/day-notes.js`) excuses a **past or present** day from the nudge and the
  reminder, and `api/coach/core/streak.js` excuses a sick/travel/injured **week** up to a yearly cap. It cannot
  be set for next week: "a note on a future day reads as permission to skip it", which the issue behind it
  deliberately avoided.
- A programme has its own Pause (`programmeStatus`, `run.pausedOn`), but a weekday or rotation plan has none.
- The nudge stops after three missed days but the workout reminder keeps coming, and "2 of 4 left this week"
  keeps counting days you never intended to train.

The result is that a planned two-week holiday either breaks the streak or is met with a daily reminder, and
there is no way to say "I am away until the 27th" in advance.

## Goals

1. A pause is a date range with a reason (holiday / sick / other) and an optional note, set from Plan.
2. During it: no workout-day reminder, no missed-workout nudge. Nothing else changes.
3. The streak neither adds nor breaks on paused weeks, spends no freeze and no sick/travel allowance.
4. A running programme's week is held when the sheet's "Hold the programme's week" switch is on (default on);
   the block does not advance while you are away.
5. No "left this week" countdown for a week the pause touched; no sense of being behind on return.
6. On return: today's plan, the rotation's next undone session, or the held programme week. No catching up.
7. The app never blocks a workout. Finishing one during a pause offers to end the pause, and does nothing if
   the answer is no.
8. An open-ended pause ("until I'm back") and a pause that starts in the future both work.

## Non-goals

- Shifting the weekday schedule by the pause length, making up missed sessions, or rewriting routines.
- Pausing check-in/weight reminders, challenges, recaps, or the Coach's scheduled reviews. Only the workout
  reminder and the nudge are silenced.
- A pause that also pauses the measurement/weight streak or the activity streak (the shared streak walk
  treats every kind of trained week the same; a paused week is paused for all of them).
- A global "vacation mode" that changes units, language or the Home layout.

## Anti-goals

- A pause that hides a workout already logged on a paused day or rewrites its week.
- A pause that silently mutates `S.programme.pausedOn` (the programme's own Pause must stay the user's).
- A second source of truth for "is the plan paused today" in the client and the server.
- A paused week that spends a freeze, consumes the sick/travel cap, or breaks the streak.
- A pause that is impossible to remove or edit after it starts.

## Data

`S.planPauses`, a stamped map keyed by the start date:

```js
S.planPauses = {
  '2026-12-20': {
    to: '2026-12-27',        // inclusive; null = open-ended, until resumed
    reason: 'holiday',       // 'holiday' | 'sick' | 'other'
    note?: 'Lanzarote',      // optional, free text, same bound as a day note
    holdProgramme?: true,    // only written when the sheet's switch was on
    _ts: 1763...             // the write stamp, as every stamped map has
  }
}
```

- One entry per start date. Overlaps are allowed and unioned on read; the UI edits the entry whose `from`
  matches.
- An entry with only `_ts` is a tombstone: the pause was removed. Same rule as `dayNotes`, so a delete does not
  come back from another device's copy.
- `to` inclusive. Resume now writes `to = yesterday`, or the tombstone when `from` is today.
- Validation on read: ISO dates, `to >= from`, reason in the allowed set, note capped like `NOTE_MAX`, known
  keys only; invalid entries are dropped. At most 50 entries are read (older ones beyond that are ignored);
  the UI writes one at a time, so this is only a guard against a hostile file.
- Past pauses are kept. They are what makes a streak read correctly months later, and they are tiny.
- Backdated pauses are allowed: setting one for last week re-reads the streak and excuses those weeks. A nudge
  already sent cannot be unsent, and the spec says so in the sheet.

## Shared reader

New pure `api/coach/core/plan-pause.js`, in the folder the frontend and the server both import (the way
`streak.js` is shared):

- `pausesOf(S)` → the cleaned, sorted periods.
- `pausedOn(S, iso)` → the period covering that day, or `null` (open-ended: `iso >= from` and `to == null`).
- `pausedWeekKeys(S, ws)` → a `Set` of week keys (`weekKey`/`weekKeyOf`) with at least one paused day.
- `heldWeeksBetween(S, from, to, ws)` → whole week boundaries crossed between `from` and `to` by periods with
  `holdProgramme === true`, clamped to `to >= from`. Used by the programme maths only; a pause with the switch
  off is not held.
- No DOM, no node, no i18n. The frontend wrapper (if any) imports it exactly like `frontend/src/lib/streak.js`
  imports the shared streak walk.

## Effects

### Reminders and nudge

- Frontend, `frontend/src/lib/nudge.js`: `nudgeFor` returns `null` when `pausedOn(S, iso)` (the same early
  return `excusedOn` gets today).
- Frontend, `frontend/src/lib/mobile.js`: `buildReminderNotifications` skips a paused date next to
  `excusedOn(S, iso)` (`:174`); `buildNudgeNotifications` inherits the `nudgeFor` change.
- Frontend, `frontend/src/lib/nudge-check.js`: the background check returns `nudge: false` for a paused date.
- Server, `api/nudge.js`: the hand copy of `nudgeFor` gets the same pause check, importing the shared reader.
- Server, `api/server.js`: the reminder tick skips a paused date next to its `excusedOn` check (`:683`),
  settling the date so it does not retry.
- Server, the `GET /api/nudge-check` route (`:3162`): `nudge: false` when paused.
- Tests: `frontend/src/lib/nudge.test.js`, `mobile` tests, `api/test/nudge.test.js`,
  `api/test/server-reminder.test.js`, `api/test/server-nudge*.test.js` mirror the cases (the two sides are
  hand copies, and the tests are the contract).

### Streak

The walk lives in `api/coach/core/streak.js` and is imported by `frontend/src/lib/streak.js` and the trainers'
projections. Add paused weeks to the walk:

- Build `pausedWeeks = pausedWeekKeys(S, ws)` (or an equivalent set built in the walk, without a frontend
  import).
- In the week loop, before the missed-week branch: a paused week that is not `cur` and has no workout is
  `s: 'paused'`; it adds nothing, spends nothing, consumes no `excuseCap`, and leaves `run`/freezes as they
  were. A paused week that does have a workout is `s: 'on'` like any trained week.
- The result gains `paused: string[]` (the week keys) beside `frozen`/`excused`; `log` entries get the same
  tag so the calendar can draw it later.
- The current week stays `open` whether paused or not; `thisWeekDone` is unchanged.
- Tests in `api/coach/core/streak.test.js` (or wherever the walk is tested) and the frontend streak tests:
  one paused week, several, a paused week with a workout, a pause longer than the sick/travel cap, a pause
  before the first workout, a backdated pause.

### Programme

No mutation of `S.programme`. In `frontend/src/lib/programmes.js`:

- `programmeStatus` subtracts the plan-held weeks from the calendar week:
  `week = max(1, weeksBetween(run.startedOn, at, ws) + 1 - heldWeeksBetween(S, run.startedOn, at, ws))`,
  where `at` is the existing stop (`pausedOn` if earlier than today, else today).
- If the programme has its own `pausedOn`, its pause wins: do not subtract plan pauses, because the clock is
  already stopped.
- The returned status gains `heldByPlanPause: boolean` for the UI; `paused` keeps its old meaning (the
  programme's own pause).
- `current` remains the held week's targets, so a voluntary workout during the pause still gets its programme
  prescription. `programmeSlot` is untouched.
- The switch is stored on the pause (`holdProgramme: true`), not on the programme. Turning it off later
  changes the maths on the next read, as a date change would.
- Tests: hold one week, hold two, a pause starting mid-week, a programme paused by its own button, a pause
  before the programme started, the block ending inside a pause.

### Countdown and Plan

- `frontend/src/lib/queue.js` `weekTally` / `frontend/src/lib/week-left.js`: for a fixed week, subtract a
  paused date that had a planned routine and no workout, so the streak card's `done / planned` fraction does
  not count a day nobody intended to train. For a queue/rotation, a pause does not skip a session; it delays
  it, so the count is unchanged.
- `workoutsLeft` returns `null` when any day of the current week is paused (the Home line disappears for that
  week); the next week starts normally. This avoids a false "2 left" on return. The two rules together: the
  fraction stays honest where it can be computed, and the countdown is not shown for a touched week.
- `Plan.jsx`: the weekday rows stay as they are (they are a template, not dates); a banner says the plan is
  paused and until when.

### Coach context

- `frontend/src/lib/coach-context.js` includes the active/upcoming pause (dates and reason) in the profile
  facts the Coach receives, so it does not propose a session for a paused day. No new MCP tool and no server
  prompt change beyond the existing context payload.
- Scheduled Coach reviews are **not** silenced (the lifter's call). They may still arrive; the context tells
  the model not to plan training on paused days.

## UI

- **Sheet** (`frontend/src/sheets.jsx` or a small co-located component): start date (default today, using
  `DateField`), "until" (a date or "Until I'm back"), reason as a segmented control, an optional note, and —
  only when a programme is running — the "Hold the programme's week" switch, default on. The same sheet edits
  and extends an existing pause.
- **Plan**: a row "Pause the plan" under "How you train", or a banner while a pause is active with the range,
  **Edit** and **Resume now**. A future pause shows a calm line "Paused from 20 Dec".
- **Home**: while today is paused, a calm card instead of the Start row: "Plan paused until 27 Dec" (or "Plan
  paused"), with **Resume now**. The Start button from the tab bar stays available; the pause does not block
  training.
- **Settings**: a row under Plan & schedule for discoverability (`settings-pages.js`), opening the same sheet.
- **Finish during a pause**: after a workout finishes with a pause active today, a toast "Nice. End the
  pause?" with an **End** action; it sets `to = yesterday` (or the tombstone for a same-day pause). "Keep" is
  the absence of a tap. The normal finish summary is untouched.
- **Programmes**: while held, the programme screen says "Held by the plan pause" next to the week, and its own
  Pause/Resume remains as it was.
- **Journal / calendar**: no day notes are written; the pause is its own thing. Drawing paused weeks in the
  streak calendar is phase 2.
- Strings through `t()`/`tn()`: "Pause the plan", "Plan paused", "Plan paused until {0}", "Paused from {0}",
  "Until I'm back", "Hold the programme's week", "Resume now", "Edit pause", "Holiday", "Sick", "Other",
  "You trained during the pause. End it?" and the action "End". No locale edits in the PR.
- Accessibility: every icon has a name, the banner is a text first, the date fields are labelled, and paused
  state is never colour alone.

## Sync, tokens, backup

- `frontend/src/lib/sync-merge.js`: add `planPauses` to the stamped maps and the per-key set, exactly like
  `dayNotes` (a tombstone is a stamped entry; two devices keep different pauses).
- `api/sync-stamps.js`: the same two lists.
- `api/tokens.js` `KEY_CATEGORY`: `planPauses: ['plans']`; not in `NEVER`. A plans-only token may read and
  write the pause, which is what a planner should be allowed to do.
- Backup/export/import and the mobile state file carry the field automatically once it is in `S`; no extra
  code.
- `api/openapi.yaml` mentions the state document generically; no new route.

## Edge cases

- Pause starts today and ends today: valid; it covers one day.
- Open-ended pause plus a later dated pause: union; the later start is the visible one in the UI, both are
  read. Resume ends the covering period.
- Pause covers a day with a workout already logged: the workout still counts (the streak sees a trained
  week), and the finish prompt only appears after a workout finished while paused.
- Workout started before the pause and finished after it: the finish prompt checks `pausedOn(today)`, not the
  start.
- Programme already paused by its own button: the switch is still stored, but the hold maths is skipped.
- Pause before the first workout or before the profile existed: harmless; it makes no week trained.
- A pause in a week that also has a sick day note: both are excused; the streak does not double-count.
- Deleted routine or programme: the pause is about dates, not routines; it stays.
- DST and time zones: civil dates throughout (`todayISO`, `weekKey`), as the rest of the plan uses.
- A second device writes another pause while the first edits one: per-key merge keeps both; the same `from`
  keeps the later `_ts`.
- A pause that covers the whole 1500-week streak walk window: the walk is bounded already; no new loop.
- A state file from a hostile source with 10,000 periods: `pausesOf` caps at 50 and drops invalid entries.

## Tests

- Shared core: parse/clean/union/tombstone, inclusive `to`, open-ended, backdated, `pausedWeekKeys` across
  week starts (Monday and Sunday), `heldWeeksBetween` boundaries.
- Frontend: nudge and mobile scheduling skip paused dates; `nudge-check`; `weekTally`/`workoutsLeft` for a
  fixed week with paused dates; programme hold maths; streak paused weeks.
- Server: `api/nudge.js`, the reminder tick, the nudge-check route, the stamped-map sync and token scoping.
  The server tests mirror the frontend cases, as the existing duplicates do.
- Views: the sheet creates/edits/resumes; Home shows the banner and no Start row; Plan shows the active pause;
  the finish toast action ends the pause.
- A test that an older app (no knowledge of `planPauses`) still syncs the field through untouched.

## Phase 2 (not this spec)

- Mark paused weeks in the streak calendar and paused days in the heatmap/day strip.
- Shift the deload-cycle anchor by paused weeks (today a scheduled deload can land right after a pause).
- `preview_session` / `get_plan` and the MCP read side expose the pause.
- A "pause ends tomorrow" notification (opt-in).
- Offer a pause after N missed days, never automatically.
- Silence scheduled Coach reviews if the lifter later wants that.

## Open questions

1. Should `workoutsLeft` hide for the whole current week when any of its days is paused, or compute a reduced
   count? Proposal: hide for v1 (simple, never wrong), revisit if it feels like missing information.
2. Should a pause be capped in the UI (a warning past 12 weeks) or entirely free? Proposal: free; the streak
   simply holds, and a permanent pause is the user's choice.
3. Backdated pauses: allowed, as proposed above. Confirm the sheet's wording makes it clear that a nudge
   already sent stays sent.
4. Where exactly the pause lives in Settings: under Plan & schedule, or under Data & backup. Proposal: Plan &
   schedule, with the Plan screen as the primary entry.
