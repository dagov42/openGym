# Native backlog: the device-dependent issues

Status: task spec, triaged 2026-11-16. These are bugs, not new features, and every one needs a device or a
native build. They cannot be finished in this repository alone; the spec records what is known and what the
next person needs. Nothing implemented.

## Why they are here

`FORK_CHANGELOG.md` leaves five issues untouched because they are native: #1255 (Apple Watch per-side rest),
#1294/#1295 (Garmin crash and long load), #1264 (Android print/PDF), #1263 (wrong body-part naming from a
screenshot). A triage note is better than a silent backlog entry: it says which app, which file, how to
reproduce, what "fixed" means, and what is still unknown.

## #1255 — Apple Watch uses the full set rest instead of the between-sides delay

- **Symptom:** for a per-side exercise with its own between-sides rest, the watch waits the full set rest after
  the first side instead of the shorter side rest.
- **Where:** the Apple Watch app (`frontend/ios/App/` watch target; the Swift watch logic, not the phone's
  `supersetFlow.js`, which already resolves `sideRestFor`). The phone sends the watch a snapshot
  (`frontend/src/lib/watch-sync.js`); the per-side timing must be in the snapshot or derived on the watch.
- **Repro:** an exercise marked per-side with `sideRestSec` set, started on the phone, a set ticked on the
  watch; compare the countdown with the phone.
- **Acceptance:** the watch shows and honours the side rest between L and R, and the full rest across sets;
  the same numbers as the phone. A watch-sync test (the repo already has watch-sync protocol tests) covers the
  snapshot field.
- **Needs:** a paired Apple Watch (or a simulator with the watch app), Xcode.
- **Risk:** low; the logic is small, but only a device proves it.

## #1294 / #1295 — Garmin: crash on an active workout, and a very long load

- **Symptom:** a Forerunner 255 crashes when interacting with an active workout; a Forerunner 955 waits a very
  long time when workouts load from the phone while a workout is in progress.
- **Where:** `frontend/garmin/` (Connect IQ project: `manifest.xml`, `source/`, `monkey.jungle`) and the phone
  side (`frontend/src/lib/garmin-*`, `watch-sync.garmin.test.js`).
- **Unknowns:** which screen/action crashes, the watch's error log (`CIQ_LOG`), the app version, the number of
  routines and their size. Both reports need a repro and a log before a fix.
- **Acceptance:** the 255 does not crash on the named interaction; the 955 loads a workout while one is
  running in the same time as from idle (or shows progress); a regression test on the phone-side payload size
  and a Connect IQ unit test where the logic allows it.
- **Needs:** a Forerunner 255 and a 955 (or a simulator for the load path), the Connect IQ SDK, the watcher's
  log.
- **Risk:** medium; a crash is often a null/edge case in the watch UI, but the load path may be a
  sync-protocol change.

## #1264 — Android: no PDF download or show option

- **Symptom:** on Android the PDF report/plan cannot be downloaded or opened; the WebView print path is
  missing.
- **Where:** `frontend/src/lib/print-doc.js` / `print-doc.native.test.js`, the Android Capacitor plugin set
  (`frontend/android/`), and the print/PDF buttons in `Report`/`Plan`.
- **Unknowns:** whether the button does nothing or shows an error, the Android version, the file manager
  permission model on the device.
- **Acceptance:** the print/PDF action on Android saves or shares a real PDF (or opens the system print
  dialog); the same document as the web path; a native test or a documented manual check per Android version.
- **Needs:** an Android device/emulator with a current WebView, `adb`, and the built APK.
- **Risk:** medium; the WebView API differs by version, and the fix may need a native bridge.

## #1263 — "wrong body parts naming"

- **Symptom:** the issue carries a screenshot and no text. The likely categories are a French/English label
  mismatch, a body-part translation, or a catalogue `bodyPart` value the UI renders with the wrong word.
- **Where:** `frontend/src/lib/exercises.js` / `muscles.js` / the locale packs; a catalogue file if the value
  itself is wrong.
- **Unknowns:** which screen, which exercise, which language, what it says vs what it should say.
- **Next action:** ask the reporter for the exercise name/id, the language and the expected wording; if it is
  a catalogue value, fix the file and the audit (catalogue-quality spec rule 4); if it is a UI string, fix the
  locale pack.
- **Needs:** no device; the screenshot plus one answer is enough.
- **Risk:** low once understood; currently blocked on information.

## How to use this file

- Do not start a native fix without the device/log listed under "Needs".
- When an issue is understood, replace its section with a real design (or a link to one) and a PR.
- When the upstream project fixes one, strike it here and record the PR in `FORK_CHANGELOG.md`.
