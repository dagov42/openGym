# Cardio as one block, controlled from the workout card

Status: agreed 2026-11-26. A1 only: one cardio block per exercise. A2 (multiple
intervals for new cardio entries) is explicitly rejected for now. Not implemented yet.

Supersedes: `2026-11-25-cardio-lockscreen-stop-design.md` (the separate cardio
notification).

## Decision

A cardio exercise is one visible block, not a sequence of sets. Internally it keeps one
compatible `sets[0]` row, because history, challenges, calories, exports, Health Connect and
old backups already read `min` from that row. The row is an implementation detail; the UI and
the notification never call it a set or a approach.

The separate cardio notification is removed. The existing workout notification, id
`RestAlert.COUNTDOWN_ID`, becomes the only workout block. While the current exercise is cardio
it shows the elapsed time and the controls for that one block.

## Goals

1. One cardio block per cardio exercise; no "Set 1 of 1", no "Add set", no separate widget.
2. Start, pause, resume and finish from the workout notification, with a live elapsed time.
3. The timer keeps running while the phone is locked, and pause/resume survives a killed
   process.
4. The exact stop instant is written to the existing `min`, so history and stats do not change.
5. The block is excluded from the workout's set count and set progress.
6. No new `S` field and no change to the synced document shape.
7. Existing cardio entries with several rows remain readable and editable; they are not
   silently migrated or dropped.
8. The language is the page language: "Пауза", "Продолжить", "Завершить", "1 мин", never a
   hardcoded English `min`.

## Non-goals

- New cardio entries with multiple intervals (A2).
- Moving cardio out of a workout into `activities`.
- Changing the semantics of cardio minutes, calories, challenges or PRs.
- Lock-screen controls on iOS or the web; those keep the in-app controls only.
- Automatic interval splitting, laps, distance auto-pause or GPS.
- Rewriting the workout notification for strength exercises.

## Data

New cardio entry:

```js
active.entries[idx] = {
  id: '3666',
  target: { mode: 'cardio', min: 23, speed: 10.5 },
  sets: [
    { min: 23, speed: 10.5, done: false, at? }
  ]
}
```

- Exactly one work row (`sets[0]`) for a new cardio entry. No warm-up rows.
- `min` is the actual duration after Finish. The planned `target.min` stays separate.
- On Finish: `min = minutesFor(elapsedSec)`, the same rounding as today (30 s and up makes
  1 minute; below 30 s writes nothing). `done = true`, `at` is the stop time.
- No `S.cardio`, `entry.cardio` or other synced field. The native run state is device-only.
- `speed`, `km`, incline, level and effort remain the existing row fields.

Native run state, in device preferences only:

```text
cardio_run = {
  wid, entryId, entryIdx,
  startedAt,       // wall clock when the block first started
  pausedAt,        // wall clock when the current pause began, 0 when running
  pausedTotalMs,   // already accumulated pauses
  finishedAt       // 0 while running/paused, the stop instant after Finish
}
```

`startedAt` is wall-clock so it survives a process kill. The card's `Chronometer` is based on
`elapsedRealtime` while running; after a reboot it is rebuilt from the stored wall-clock values.
The run is not synced.

## The block state machine

```text
idle ── Start ──> running ── Pause ──> paused
                    │                  │
                    ├── Finish ────────┤
                    v                  v
                 finished <────────────┘
```

- `idle`: no cardio timer. The card shows the one block, its planned duration and `Начать`.
- `running`: elapsed counts up. Actions: `Пауза`, `Завершить`.
- `paused`: elapsed is frozen. Actions: `Продолжить`, `Завершить`.
- `finished`: `min` already written, row done. No Start for the same block. The card shows the
  recorded duration. A later manual edit may change the duration; it does not reopen the timer.
- Only one cardio run exists at a time. Starting another cardio block finishes the previous one
  at the start instant (writing `min` and marking it done), so no second timer can run
  invisibly. If the previous block was under 30 s, no time is written and it remains idle.
- `Finish` ends the block. It is not a pause. After it, the only way to continue running is a
  new workout or a new cardio exercise; A1 has no "add interval".
- `Finish` when paused uses the frozen elapsed time.
- `Finish` under 30 s writes no `min` and leaves the row with its previous value; the card says
  the block was too short rather than saving 0.

### Workout pause

- Pausing the whole workout pauses the cardio run and freezes its elapsed time.
- Resuming the workout resumes the cardio run only if it was running before the workout pause.
  A cardio run the user paused by itself stays paused.
- The existing workout pause and cardio pause are separate reasons; the card says which one is
  active, and one resume does not silently undo the other.

### Finish workout and Discard

- Finish workout with a running cardio block writes the elapsed time as if the block's
  `Завершить` was tapped at the workout end, then finishes the workout.
- Finish workout with a paused block writes the frozen elapsed time.
- Discard workout drops the run and does not write a duration.
- If the block is already finished, Finish workout leaves its `min` as it is.

## UI

### Workout screen, cardio entry

- Header: exercise name and one line "Кардио".
- The block shows `Время`, `Скорость`/`Дистанция`, incline/level and effort as today.
- Buttons: `Начать` when idle; `Пауза` and `Завершить` while running; `Продолжить` and
  `Завершить` while paused.
- No "Подход 1 из 1", no `+ Добавить подход`, no warm-up rows for a new cardio entry.
- The workout header's set count excludes cardio blocks. A workout with only cardio shows no
  `0/0`; it shows the cardio block and the Finish action.
- Manual editing of `min` and speed remains available. Typing a duration does not start the
  timer.

### Existing cardio entries with several rows

- Keep every row and every `min`. Do not merge, delete or rewrite them.
- Show them as `Интервалы` (not "sets"). The timer controls are offered only for a one-row
  cardio entry; a legacy multi-row entry stays manually editable and its rows are read-only for
  the block timer. This is the price of not implementing A2.
- A new cardio routine slot is created with one row. Existing routines with several rows keep
  them until the user changes the routine.
- History, CSV, Health and stats continue to read the rows as before.

### History and stats

- A cardio entry reads as `Кардио · 23 мин · 10,5 км/ч`, not as a set count.
- `cardioMinOf`, `entryCardio`, `activeKcal`, challenges, weekly goals, CSV, backup and
  Health keep reading completed `min` rows; no new code path.
- The workout's `done/total` counts only lifts, holds and carries. Cardio completion is shown
  by the cardio block itself.

## Notification

One notification, the existing workout card. No `cardio-timer-v2` channel and no second id.

- While the current entry is cardio and the block is `idle`, the card shows the exercise, the
  one-block wording and `Начать`.
- `running`: the card shows a live `Chronometer` and two actions, `Пауза` and `Завершить`.
- `paused`: the card shows the frozen time and two actions, `Продолжить` and `Завершить`.
- `finished`: the card shows the recorded minutes and no cardio timer actions.
- Tapping the body opens the workout. Actions never open the app.
- The card uses the same `WorkoutCardReceiver` broadcast path and the same native queue. No new
  notification id, no custom RemoteViews card, no extra block, no third action.
- The native side owns the run state while the page is asleep. Actions update the native state,
  redraw the card and queue one event for the page. The page applies the same event through its
  normal tick once it is on screen.
- On returning to the app, JS reads the native run snapshot and reconciles. A native run with no
  matching active workout is cleared after it is consumed; it must not leak into another
  workout.
- The labels and the `min`/`s` text use `t()`; no hardcoded English.
- Android 16 Live Update and older Android use the same existing workout card. If notifications
  are disabled, the in-app controls are the fallback.

## Corner cases

- App killed, phone locked, process death: the native run survives.
- Phone reboot: the card is rebuilt from wall-clock fields; elapsedRealtime is not trusted across
  a reboot.
- Clock moved backwards/forwards: elapsed never goes below 0; a clock change does not create
  negative minutes.
- Two cardio exercises: only one run; the card follows the active workout's current entry.
- Cardio in a superset or a combined session: the block belongs to its entry; the card shows
  that entry, and moving to another unit pauses/finishes it by the same rule.
- Workout pause plus cardio pause: separate, as above.
- Finish workout, Discard, backfill, imported workout, restored backup: no native run is
  created for a past workout; only a live session can start one.
- Notification action from a stale card (workout ended, set moved): ignore if `wid`/`entryId`
  does not match.
- Language changes while running: labels are rebuilt from the current page language on the next
  draw.
- Page reload with local run and native run: native wins for the Android card; JS discards a
  local run that does not match the native `wid/entryId`.
- Under 30 s: no minutes written; the block is marked finished with no time and can be edited
  manually.
- Manual duration and timer: a manual edit while running is overwritten at Finish by the timer
  time; a manual edit while idle is kept unless the timer is started.
- Old multi-row cardio: no timer, no migration; the rows remain in history and stats.
- Empty/unknown routine or deleted exercise: the native run is cleared, the queued event is
  ignored.
- Existing separate cardio notification preference/channel: on upgrade, cancel its id and remove
  its preferences; the workout card is the only visible block.

## Tests

Pure JS (`frontend/src/lib`):

- one-block state: idle, running, paused, resumed, finished;
- elapsed excludes pause spans and workout pauses;
- minutes rounding, under 30 s, clock skew;
- Finish writes `min` and `done`;
- workout Finish/Discard;
- legacy multi-row cardio stays unchanged and is not offered a timer;
- `done/total` excludes cardio;
- `min` and `s` are translated (`ru` "мин", "с") and not hardcoded.

Native (`android` unit/instrumentation where practical):

- run preferences survive process kill and a simulated reboot;
- pause freezes the chronometer base, resume restarts it;
- Finish stores `stopAt`, queues the event and removes the run;
- stale card action is ignored;
- only workout id is posted; the old cardio notification id is not posted;
- notification actions and text are localized.

Integration:

- current cardio block in the workout card shows `Пауза/Завершить`, not `Записать подход`;
- Finish on the Lock Screen writes the exact stop time, and the row shows that time on return;
- workout pause pauses the card; resume restores it;
- old data and a backup round-trip are unchanged;
- no duplicate notification, no clipped extra widget;
- a workout with only cardio can be finished.

## Rollout

- Spec first, then implementation in one PR.
- Remove the old `CardioTimer` notification and channel, but keep the native timer storage
  refactored into the workout-card state.
- Keep the old `sets` shape in the synced document. No migration script.
- Update `FORK_CHANGELOG.md`, the feature index, and the old cardio spec status when implemented.
