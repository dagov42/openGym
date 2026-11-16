# What's new after an update

Status: agreed 2026-11-16 (the lifter's calls: an automatic sheet once per version with 3–5 short items and a
changelog link, plus a permanent Settings row). Nothing implemented yet.

## Why

Releases land every one to two weeks, and the changelog is long. The app offers a newer APK when it opens
(`frontend/src/lib/update-notice.js`) but says nothing about what changed after it installs. People miss whole
features — Modules, programmes, circuits, the watch pages — because nothing told them. The version is already
in the build (`__APP_VERSION__`, read by `lib/update.js`), so the app can say "here is what is new" without a
network call.

## Goals

1. After the app version changes, show a sheet once per version with 3–5 short highlights and a link to the
   changelog.
2. Never show it on a first install, during an active workout, or over an open sheet; if the moment is busy,
   show it at the next quiet moment or next launch.
3. A permanent **What's new** row under Settings → About & updates, with a dot while the current version has
   not been read.
4. The highlights are English source strings in a small in-app map, passed through `t()` like any other
   string, so a locale pack can translate them; untranslated items fall back to English.
5. No network request, no server storage, no new `S` field.

## Non-goals

- Reading the full `CHANGELOG.md` in the app.
- Release notes from the GitHub API, a push notification, or an email.
- Per-profile "seen" state; this is a device/browser thing.
- A forced tour of the new feature, or deep-linking into it (the item can name it; the sheet does not drive
  the user there).
- Automatic translation of the changelog.

## Data

- `__APP_VERSION__` is the version the build carries (Vite `define`; `lib/update.js` already compares it with
  the latest release). Normalise it by dropping semver build metadata (`1.4.6+2026-11-16` → `1.4.6`).
- `localStorage['whats_new_seen']` holds the last version whose sheet was shown or dismissed. A missing key
  is a first install: write the current version and show nothing.
- `frontend/src/lib/whats-new.js`:
  ```js
  export const RELEASES = {
    '1.4.6': [
      'Programmes: routines as a block of weeks',
      'The live widget on the Lock Screen and the Home Screen',
      'Circuits, AMRAP, EMOM and Tabata',
    ],
  }
  ```
  `itemsFor(version)` returns the array or null; `shouldShow(seen, current, { firstRun, busy })` is the pure
  decision (`'show' | 'wait' | 'no'`), the same shape `update-notice.js` uses for its offer.
- Keep only the last few releases in the map; older entries are pruned, not archived in the app.
- No `S` field, no sync, no API.

## Where it shows

- A sheet after boot when the decision is `show`: title **What's new in {version}**, the items as a short
  list (icon optional), a **Read the changelog** link built from the update repository
  (`updateRepo()` from `lib/update.js`, so a fork links to its own changelog), and **Got it**.
- Dismissing by the button, the backdrop or Escape sets `whats_new_seen` to the current version. There is no
  "remind me later" for a version that is already installed; the Settings row remains.
- Settings → About & updates → **What's new**, with a dot while `seen !== current`; it opens the same sheet
  even after it was seen. If the current version is not in `RELEASES`, the row opens the changelog instead and
  says there are no notes for this build.
- Boot timing: after the profile is ready and no workout is active and no sheet is open. If busy, `wait`: the
  caller retries when the workout ends or the sheet closes, and the next launch covers the rest.
- First install after this feature ships: no sheet for that version; future versions show normally.

## Edge cases

- A version not in the map: no automatic sheet; the Settings row links to the changelog.
- A downgrade: `seen` is newer than the current version; no sheet (do not show old notes).
- `localStorage` unavailable (private mode): the sheet may show again after a reload; acceptable, and the
  code must not throw.
- Two tabs open: the first to show writes `seen`; the second reads it and does not show again.
- A build with metadata (`1.4.6+...`) maps to `1.4.6`; an unknown suffix still normalises to the base.
- A locale with no translations: English items; the sheet's own strings go through `t()`.
- A long item: the sheet wraps; no item is taller than the sheet on a small phone (cap text, like the Coach
  cards).
- A version with no items (an empty array): treated as no notes.

## Tests

- `itemsFor`: exact version, metadata stripped, unknown version, empty list.
- `shouldShow`: first install, same version, newer version with items, downgrade, busy (wait), no items.
- `localStorage` failure: no throw, sheet may repeat.
- View: the sheet renders items and the link; Got it/backdrop/Escape writes `seen`; the Settings row shows a
  dot and opens the sheet; unknown version opens the changelog.
- Boot: no sheet during an active workout; it appears after finishing (or next launch).

## Where the logic lives

- `frontend/src/lib/whats-new.js` + tests.
- `frontend/src/components/WhatsNewSheet.jsx` (or a co-located sheet in `sheets.jsx`).
- `frontend/src/App.jsx` (the idle trigger, next to the update notice) and `frontend/src/views/Settings.jsx`
  (the About & updates row); `settings-pages.js` for the search entry.
- Strings through `t()`; no locale edits in the PR.

## Open questions

1. **When exactly to show:** after boot when idle (proposed) or the first time Home is opened after the
   update? Proposal: boot, idle, once; the same wait rule as the update offer.
2. **How many releases in the map:** the last three (proposed). The app does not need a full history; the
   changelog has it.
3. **The dot:** a dot on the Settings row until seen (proposed) or no dot at all? Proposal: dot; it is the
   only passive signal that notes exist.
