# Keyboard shortcuts and the help sheet

Status: implemented 2026-11-18 (`lib/app-keys.js`, `components/ShortcutsSheet.jsx`, the App key
listener, `data-search` on the screen searches, and the Settings → About row; tests:
`app-keys.test.js`, `ShortcutsSheet.test.jsx`). The lifter's calls stand: the minimum, `?` for the
list, the existing workout keys, Escape for a sheet, `/` for the current screen's search, no
single-letter navigation.

## Why

The app is used on a laptop and on a Raspberry Pi on the gym wall; `frontend/src/lib/workout-keys.js` already
drives a session with Space/Enter and the arrows, and closed #133 asked for exactly that. But nothing lists
the keys, and outside the workout there are none: a desktop user cannot focus the search field without the
mouse, and a new user cannot discover the workout keys at all.

## Goals

1. `?` opens a **Keyboard shortcuts** sheet from any screen that is not a text field and has no sheet open.
2. `/` focuses the current screen's search field when it has one, selecting the text; otherwise it does
   nothing.
3. The sheet lists the existing workout keys (Space/Enter, ←/→), Escape, `/` and `?`, grouped as Workout and
   App, with the platform's key names.
4. A permanent Settings row opens the same sheet.
5. No new profile field, no sync, no mobile-only code path.

## Non-goals

- Single-letter navigation (H/P/Y/S), multi-key sequences (`g` then `h`), or a command palette.
- Remapping keys, custom shortcuts, or a "vim mode".
- A shortcut for every action; only the ones above in v1.
- A printed shortcut card, or a hint on every screen.

## Implementation

### Pure decision

New `frontend/src/lib/app-keys.js`:

```js
appKeyAction(event, { inField, sheetOpen, hasSearch }) -> 'help' | 'search' | null
```

- `null` for a repeat, an IME composition, `altKey`/`ctrlKey`/`metaKey`, or a focused text field
  (`input`, `textarea`, `select`, `contenteditable`, `role="textbox"`). Shift is allowed only for `?`.
- `?` → `'help'` when no sheet is open. A sheet owns the keyboard: Escape closes it, Enter confirms, and `?`
  is not stolen from a field inside it.
- `/` → `'search'` when `hasSearch`; otherwise `null` so the browser's own quick-find is not swallowed.
- Escape is not handled here: sheets already close on it (`components/Modals.jsx`; the workout screen defers
  to the sheet on top). The sheet only documents it.

### Wiring

- `frontend/src/App.jsx`: one `window.addEventListener('keydown', ...)` using the pure decision. On `help`,
  open the shortcuts sheet; on `search`, focus the element with `[data-search]` on the current screen,
  `select()` its text and `preventDefault()`. The listener never runs for events already default-prevented.
- Mark the existing search inputs with `data-search`: History (the new search), Library, Settings search,
  Journal (if it has one), and the exercise picker's search. This is an attribute, not a new component.
- Workout keys keep their own handler (`Workout.jsx` listens and calls `workoutKeyAction`); the new listener
  does not duplicate or shadow them. The `?` handler is outside the workout's key map, so Space/Enter/arrows
  are untouched.
- The sheet: `frontend/src/components/ShortcutsSheet.jsx`, opened from `sheets.jsx` and from Settings → About
  & updates (or a new **Keyboard** row under Look & Home). Groups:
  - Workout: Space/Enter — tick the next set; ← / → — previous/next exercise.
  - App: Esc — close a sheet; / — search this screen; ? — this list.
  - A short line: "On a phone with a keyboard, the same keys work."
- Platform labels: "Space", "Enter", "← →", "Esc", "/", "?" (no macOS-specific glyphs are needed for these).
  RTL: the labels stay logical; the workout's own arrows already mirror.
- Strings through `t()`; no locale edits in the PR.

### Settings

- A row **Keyboard shortcuts** in Settings → About & updates (or Look & Home) opens the sheet. It is the
  discoverable path for someone who never presses `?`.
- No toggle: the keys are always available when they do not conflict with a field.

## Edge cases

- Focus in any input or a contenteditable: `?` and `/` type normally; the handler is a no-op.
- A sheet open: `/` and `?` do nothing; Escape closes it, as today. A field inside a sheet keeps its keys.
- IME composition (Cyrillic, CJK): no shortcut fires mid-composition.
- A keyboard layout where `?` is not Shift+/: `event.key === '?'` is what matters; if the layout produces
  another character, the key does nothing (correct).
- `/` on a screen without a search field: no preventDefault; the browser may do its own quick find.
- The workout screen's Space on a focused button after Tab keeps pressing the button (`workoutKeyAction`
  already distinguishes tabbed focus); the new listener does not interfere.
- A modal dialog or a native picker: the handler still checks `sheetOpen`; if a new overlay type appears, it
  must set the same flag.
- Holding a key: `event.repeat` filtered.
- Accessibility: every action remains reachable by tab and tap; the sheet is a convenience, not the only path.
  The `kbd` elements are text, not images, and the sheet is focus-trapped like other sheets.

## Tests

- Pure: `?` opens with no field/sheet; `?` in a field is null; `/` with and without a search field; modifiers;
  repeat; composition; sheet open.
- App: `/` focuses and selects the History search; the Library and Settings searches too; a screen without a
  search does nothing; `?` opens the sheet; Escape still closes a sheet; the workout keys still tick/move.
- Settings row opens the sheet.
- The sheet lists every shortcut the code implements (a test that the strings and the keys do not drift).

## Where the logic lives

- `frontend/src/lib/app-keys.js` + `app-keys.test.js`.
- `frontend/src/components/ShortcutsSheet.jsx`, opened from `sheets.jsx`.
- `frontend/src/App.jsx` (the listener), `frontend/src/views/Settings.jsx` / `settings-pages.js` (the row),
  and the `data-search` attributes on the existing search inputs.
- No `S`, no API.

## Open questions

1. **`?` while a sheet is open:** do nothing (proposed) or open help over the sheet? Proposal: do nothing;
   the sheet's own keys are the priority, and the Settings row is always one tap away.
2. **Settings placement:** About & updates (proposed, next to the changelog) or Look & Home? Proposal: About &
   updates; it is help, not appearance.
3. **A hint:** no on-screen hint in v1 (proposed). If discoverability is still poor, a one-line "Press ? for
   shortcuts" under Settings is the next step.
