# Upstream P1 batch: specs for the next upstream ports

Status: planned 2026-11-19, not all implemented. This is a planning pack, not a promise that every
item lands. Each section records the upstream PR, the behaviour worth porting to this fork, the files
it touches and the tests that must exist before it is merged. P0 work is separate: share-link origin,
the wake-lock hold count and the calorie estimate.

Current status, checked against the fork on 2026-11-19:

- already present and verified: #1293, #1092, #1226, #1211, #1095, #1156, #1091, #1191;
- implemented in this batch: #1157 (main muscles only), #1377 (profile rest between sides),
  #1374 (effort on warm-ups), #1317 (ask for effort before ticking), #1379 (move to the next
  exercise), #1164 (full-screen rest), #1375 (cardio count-up), #1193 (Coach pyramids).

Source: the open-PR/issue triage of `DuarteSantos8/openGym` on 2026-11-19. The PRs are open, so none
of this is in `FORK_CHANGELOG.md` yet. A PR that is `dirty` or `unstable` must be rebased and reviewed
against our own changes first; it is not a cherry-pick.

## 1. A calendar day trains the routine it was planned for (#1293)

**Upstream:** [#1293](https://github.com/DuarteSantos8/openGym/pull/1293), clean, 17 files.
**Problem:** a day planned in the calendar can read as Rest, or vanish after `refillAfter`, when the
chosen rotation session was already done in that rotation round.
**Worth porting:** the plan pin is fulfilled only by that routine in the planned day's own week (the
profile's week start), on or before the day. `refillAfter` must not sweep a future pin that names a
session of the rotation.
**Files:** the rotation/calendar helpers and their tests; the day sheet needs no redesign.
**Tests:** a session already done earlier in the round, a pin for the day itself, a future pin after
the current round completes, and a stale/removed routine.
**Risk:** this is schedule logic with history; keep it in pure helpers and add a regression case for
each of the two symptoms in the PR body.

## 2. Android Back follows the app's own history (#1092)

**Upstream:** [#1092](https://github.com/DuarteSantos8/openGym/pull/1092), clean, 2 files.
**Problem:** on Android 16 the WebView can report `canGoBack: false` on a page opened by the app, so
Back offers to exit instead of going up.
**Worth porting:** treat react-router's `history.state.idx > 0` as a page to go back to, while the
root-tab exit rule and the first app entry stay as they are.
**Files:** the back handler and its tests.
**Tests:** a pushed page goes up even when the WebView says no; index 0 still arms Exit; a root tab
still asks to exit.
**Risk:** Android-only behavior; needs a device/emulator check as well as the unit cases.

## 3. Saturday as the third week start (#1226)

**Upstream:** [#1226](https://github.com/DuarteSantos8/openGym/pull/1226), 18 files.
**Problem:** the helpers already accept any weekday, but several copies normalise anything except
Sunday to Monday, so Saturday is not a real choice.
**Worth porting:** a third option in Plan → schedule; Plan, Home, streak calendar, programmes, the API
streak core and trainer projections all use the same start.
**Files:** `format.js` week helpers and the copies named in the PR; settings row and tests.
**Tests:** Friday/Saturday belong to different weeks, a week with no training, a programme, and a
trainer projection.
**Risk:** the API and frontend copies must change together; add a parity regression test.

## 4. Move to the next exercise: off / when rest ends / right away (#1379)

**Upstream:** [#1379](https://github.com/DuarteSantos8/openGym/pull/1379), 33 files.
**Supersedes:** #1167, which only makes “when the rest ends” the default.
**Worth porting:** one three-way choice instead of the old switch. “Right away” moves the marker on
the last tick but leaves the rest timer running against the exercise that started it; Skip and ±15 s
still target that exercise.
**Files:** the setting and its labels, workout marker/rest handling, the existing next-exercise
tests.
**Tests:** each of the three choices, the rest keeps running, a superset, the last exercise, a timed
hold, and a rest that is already running.
**Risk:** this overlaps our superset and rest work; port after P0 and keep the setting absent-as-off
until the new key is written.

## 5. Full-screen rest timer (#1164)

**Upstream:** [#1164](https://github.com/DuarteSantos8/openGym/pull/1164), 23 files.
**Worth porting:** tapping the rest clock opens a thumb-sized ring with −15 s, pause, +15 s and Skip.
The sheet closes on Skip, end of rest and the 0:00 wheel; a running hold stays visible.
**Files:** the rest timer components and their tests; no new storage.
**Tests:** open/close, the four controls, the sheet closes at zero, a timed set starts, and reduced
motion.
**Risk:** our rest bar has its own history; keep the docked bar and make this a viewer on top of it.

## 6. Cardio set with a count-up clock (#1375)

**Upstream:** [#1375](https://github.com/DuarteSantos8/openGym/pull/1375), 33 files.
**Worth porting:** an unticked cardio row gets ▶; it counts up in the minutes cell, and ■ or a tick
writes the rounded minutes. Under 30 seconds writes nothing. Pauses do not count; a watch/Lock Screen
tick stops it at that tap's time.
**Files:** the live timer state, cardio row/set writing, the existing timed-workout paths.
**Tests:** start/stop, rounding, under-30 seconds, pause, finish, watch tick, reload.
**Risk:** one timer at a time; do not let it fight the hold timer or a rest timer.

## 7. A profile rest between sides for reps (#1377)

**Upstream:** [#1377](https://github.com/DuarteSantos8/openGym/pull/1377), 34 files.
**Worth porting:** Settings → Rest gets an optional break for per-side reps sets, off by default.
The precedence is the set's own rest, the exercise's `sideRestOff`, its `sideRestSec`, then this
profile default. A hold keeps its existing switch pause.
**Files:** the settings row, the side-rest resolver, the rest timer.
**Tests:** off (today), profile default, exercise override, no timer, a hold, a set that is already
running.
**Risk:** our per-side rest work in #853/#636 must remain authoritative.

## 8. Leave warm-ups unrated (#1374)

**Upstream:** [#1374](https://github.com/DuarteSantos8/openGym/pull/1374), 33 files.
**Worth porting:** when effort per set is RIR or RPE, a switch hides the effort cell/button on warm-up
rows in Cards, List, Compact and Focus; already stored ratings stay. It is on by default (a profile
without the key keeps today's behaviour); only the boolean false hides it.
**Files:** settings, the set row and Focus view, the effort helpers.
**Tests:** each layout, per-side warm-ups, a stored rating survives, work sets unchanged.
**Risk:** keep the column geometry when the cell is hidden.

## 9. Ask for effort before ticking (#1317)

**Upstream:** [#1317](https://github.com/DuarteSantos8/openGym/pull/1317), 34 files.
**Worth porting:** with effort on, ticking an unrated work set opens the effort picker first; choosing
a value ticks it, closing leaves it unticked. Warm-ups, holds, cardio, per-side ticks, untick and an
already-rated set never ask. The watch gets the same setting.
**Files:** pure `askEffortFirst`, workout toggle, Focus, watch settings.
**Tests:** yes/no matrix, close/choose, per-side, warm-up/cardio/hold, untick.
**Risk:** the Watch half can wait; keep the phone rule pure so the watch can follow.

## 10. Coach payload: custom names and pyramids (#1191, #1193)

**Upstream:** [#1191](https://github.com/DuarteSantos8/openGym/pull/1191) (4 files), [#1193](https://github.com/DuarteSantos8/openGym/pull/1193) (15 files, stacked).
**Worth porting:** `cleanEx` resolves `customEx` names and body parts from the profile; pyramid,
per-set rest and per-set load survive the payload and fingerprint in both client and server copies.
**Files:** `api/coach/core/payload.js`, plan fingerprint, client copies, tests.
**Tests:** a custom exercise in a plan/workout/history, a pyramid slot, an unsupported id, server/client
fingerprint parity.
**Risk:** two copies of the payload/fingerprint must change together; add parity tests.

## 11. Search exercises by machine brand (#1211)

**Upstream:** [#1211](https://github.com/DuarteSantos8/openGym/pull/1211), 4 files.
**Worth porting:** typed brand words find exercises labelled with that brand at any gym; spaces,
punctuation and case are ignored; other words still narrow by name. Brand hits come first within the
current muscle/type/gym/equipment filters, never as a new stored field.
**Files:** the exercise picker/search helper and its tests.
**Tests:** “Life Fitness”, “lifefitness”, “life fit”, “life fitness press”, a single letter, no brand.
**Risk:** only brands already set in `S.exGym` or kept on logged entries are searched.

## 12. Timer wheels step by five (#1156)

**Upstream:** [#1156](https://github.com/DuarteSantos8/openGym/pull/1156), 33 files.
**Worth porting:** a Settings choice 1 s (default) or 5 s; every duration wheel gets 00–55 seconds.
A saved off-grid value opens on the row below and Done saves the shown value. Store only 5, so an
unset profile stays 1.
**Files:** duration wheel helpers, settings, the wheel components.
**Tests:** row maths, snap, off-grid opening, keyboard page, a minute boundary.
**Risk:** many callers share the wheel; keep the default exact.

## 13. Auto-backup copies to keep (#1091)

**Upstream:** [#1091](https://github.com/DuarteSantos8/openGym/pull/1091), 30 files.
**Worth porting:** Settings → Data & backup gets 5, 14 (default), 30 or 60 copies; both the Documents
folder and the Android picked folder prune to that number. Unknown values read as 14.
**Files:** backup pruning helper, Settings row, native backup paths.
**Tests:** each choice, unknown value, no auto-backup, a folder with fewer/more files.
**Risk:** both backup destinations must agree; do not delete files outside the dated backups.

## 14. Weekly sets: main muscles only (#1157)

**Upstream:** [#1157](https://github.com/DuarteSantos8/openGym/pull/1157), 33 files.
**Worth porting:** a switch on the ranges sheet counts a set 1.0 for primary muscles and 0 for
supporting ones; the Home line and Stats bars/ticks follow. Muscle maps, balance, fatigue and PDF keep
the supporting share.
**Files:** the weekly sets helper, settings, Stats card/line.
**Tests:** a bench set, a mixed exercise, off (today), the Home line, the Stats labels.
**Risk:** do not change the stored history or the existing muscle map.

## 15. Plan line joins the pill row (#1095)

**Upstream:** [#1095](https://github.com/DuarteSantos8/openGym/pull/1095), clean, 3 files.
**Worth porting:** the exercise header's “Plan: 3 × 12” becomes the first item of the wrapping muscle
and equipment pill row; compact view keeps its own line; Focus unchanged. The tempo pill gets a
44 px tap area.
**Files:** Workout header markup/CSS and its test.
**Tests:** plan is first, wraps without clipping, compact unchanged, 44 px target.
**Risk:** visual only; take it only after the P0 header work is stable.

## P2, not specced yet

These stay in `FORK_ROADMAP.md` under the upstream P2 table: rest-pause rebuild (#1253), fixed
warm-up weights (#1259), lift goals (#1265), skills/ladders (#1245), module parts (#1235/#1237),
Hevy API import (#1158), slim APK (#773), RENPHO (#722), guided warm-up (#706), exercise goals
(#702), Explorer grouping (#901), finish encouragement (#879), and Japanese/Chinese catalogue
coverage (#1026/#1008). They are useful but larger, blocked, or need a product decision.
