# History search

Status: implemented 2026-11-18 (`lib/history-rows.js`, `lib/history-search.js`, `fmtMonth`,
`History.jsx`; tests: `history-search.test.js`, `History.search.test.jsx`, `format-month.test.js`).
The lifter's calls stand: deep search through workout, exercise and set notes; filters
are type, month and PR only; routine and gym are found through the text; the month filters the list rather
than scrolling to it.

## Why

`History` is an infinite list of every workout, day note, recovery session and activity, newest first
(`frontend/src/views/History.jsx`, `historyRows`). It has sorting and paging and no search. A profile with
hundreds of workouts cannot answer "when did I last do Romanian deadlifts", "which session was the one where
my shoulder hurt", or "show me March" without scrolling and opening rows. The data is all there; the screen
only lacks a way in.

Closed issues show people already go back to old sessions for a reason: #770 (last time per exercise), #842
(plan from the last session across routines), #907 (compare a set with the same set last time). Those open
from an exercise or a workout; History has no way to find the workout in the first place.

## Goals

1. A search field in History that matches workout names, routine names, exercise names (localized and
   English), workout/entry/set notes, the gym, day-note tags and text, recovery kinds and notes, and activity
   names/notes.
2. Type chips: All, Workouts, Notes, Recovery, Activities.
3. A month filter built from the months that actually have rows, newest first, plus "All months".
4. A PR-only switch for workouts (`w.prs` non-empty).
5. Results keep the existing newest-first order and the existing infinite scroll; the full list's scroll
   depth is not lost when a filter is cleared.
6. No new profile field, no sync change, no server call. Pure functions with tests beside them.

## Non-goals

- Ranking, relevance scores, typo tolerance or fuzzy matching. Every word of the query must appear.
- Searching settings, routines, the exercise library or the plan. Those are their own searches (and a later
  command palette, a different spec).
- Saved searches, search history, or a search button on other screens.
- Matching formatted dates ("12 Nov"); the month filter is the date tool.
- A calendar grid; the month is a filter, not a view.

## Anti-goals

- Slower first paint of History on a profile with thousands of workouts: the index is built only while a
  search or filter is active.
- Losing the search when a workout sheet opens and closes: the sheet sits over History, so the view keeps its
  state.
- A filter that changes the order of the list or the meaning of "newest first".
- Hiding the total count or showing "no workouts" when the real state is "no matches".

## Data and index

`historyRows` moves from `History.jsx` to a new pure `frontend/src/lib/history-rows.js`, unchanged. The view
re-exports/imports it so any existing test or import keeps working. This keeps the search module out of a
view.

New pure `frontend/src/lib/history-search.js`:

- `normalize(text)`: `String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`, whitespace
  collapsed. This makes `Жим`/`жим` and `Café`/`cafe` match; it does not transliterate Cyrillic/Latin.
- `rowHaystack(S, row)`: the normalized text of one history row:
  - workout: `w.name`; routine names from `w.routineIds`/`w.routineId` against `S.routines`; `w.note`; the
    gym label (`workoutGymLabel`); each entry's localized name (`exerciseNameFor(exOr(e.id))`), the
    catalogue's English `ex.n` when different, a custom exercise's own name, `e.note`, and every set's
    `s.note`;
  - day note: the localized tag label (`DAY_NOTE_LABEL`) and `note.text`;
  - recovery: `RECOVERY_LABEL[kind]` and `note`;
  - activity: `activityName(a, t)`, the sport label and `note`;
  - the date is not in the haystack; month is a filter.
- `buildHistoryIndex(S, rows)`: one pass, `[{ row, hay }]`; exported so a test can assert a row's haystack.
- `filterHistoryIndex(index, { query, type, month, pr })`: every whitespace-separated term of `query` must be
  a substring of `hay` (AND). `type` is `all | workout | note | recovery | activity`; `month` is `YYYY-MM`
  or null; `pr` keeps workouts with `w.prs?.length > 0`. Inactive filters return the index rows unchanged.
- `monthsOf(index)`: distinct `row.d.slice(0, 7)`, newest first, with a label through `fmtMonth`.
- Empty/whitespace query and `type: 'all'`, no month, `pr: false` means "not active".

`frontend/src/lib/format.js` gains `fmtMonth(ym)` → the localized long month and year ("November 2026"),
using the same `dateLocale()` formatter cache as `fmtDate`. `ym` is validated as `YYYY-MM`; anything else
returns the input.

### Performance

The index is memoised over `S` and built only when the query or a filter is active. A 10,000-workout profile
is a single pass over entries and sets, then a substring test per term per row; the view already caps renders
at `HISTORY_PAGE`. If profiling shows a problem, the next step is a prebuilt index for the search session,
not a server call.

## UI and behaviour

- Search row under the header: a magnifier, a labelled input ("Search history"), a clear button when
  non-empty. `type="search"`, `enterKeyHint="search"`, `autoCorrect="off"`, `autoCapitalize="none"`; no
  autofocus (the keyboard must not open on arrival).
- Chip row under it, horizontally scrollable: All, Workouts, Notes, Recovery, Activities; then a month
  button (label "All months" or "November 2026") and a PR chip with a trophy. Use the existing chip styling;
  `aria-pressed` on every toggle.
- Month picker: a `menuSheet`/`SelectSheet` with the months from `monthsOf` and an "All months" item. No new
  date wheel.
- When active: a result line `12 matches` (`aria-live="polite"`), the list is the filtered index, and the
  empty state is `No matches for “…”` with a **Clear** action.
- Paging: the filtered list starts at `HISTORY_PAGE` rows and grows by `HISTORY_PAGE` with the same
  `IntersectionObserver`. `grownTo` is only updated while inactive; on clear, the full list restores its
  previous depth. A change of query, type, month or PR resets `shown` to `HISTORY_PAGE` and scrolls the page
  to the top.
- Escape in the search field clears the query. The clear buttons reset the matching dimension; a "Clear all"
  in the empty state resets everything.
- `WorkoutRow`, `DayNoteRow`, `RecoveryRow` and `ActivityRow` are unchanged; their tapping and sheets keep
  working against the filtered rows.
- The header keeps the total workout count; when a filter is active the result line is the count that
  matters, and the total stays visible in the header.

## Strings

Through `t()`/`tn()`: `Search history`, `Search workouts, exercises and notes`, `Search`, `Clear search`,
`All`, `Workouts`, `Notes`, `Recovery`, `Activities`, `PRs`, `All months`, `Month`, `{0} match` / `{0} matches`,
`No matches for “{0}”`, `Clear filters`, `Clear all`. No locale edits in the PR; packs fall back to English.

## Edge cases

- A day note on a day that also has a workout is not a separate History row today; search does not invent
  one. The workout's own note and the day sheet remain the way to read it.
- A workout saved without a name: its exercises and notes still match.
- A custom exercise with no catalogue id: its own name is in the haystack.
- English name equal to the localized name: the duplicate is harmless.
- Imported workouts with no `w.name` and no notes: found by exercise names.
- An activity's title may be empty: the sport label is the name.
- A one-character query is allowed; it simply matches a lot. No minimum-length rule.
- Diacritics and case are ignored; script transliteration is not attempted.
- RTL and long translations: the search row and chips use logical properties and scroll; the input has no
  fixed width.
- A profile with no workouts: the existing empty state, no search row (nothing to search).
- A filter combination with zero rows: the no-matches state, not the empty-profile state.
- Switching profile with History open: the store re-renders; local search state may survive a profile change
  until the view unmounts, and the new profile's rows are what get filtered. Acceptable; the query matches
  nothing if it named the old profile's exercises. No persistence to clear.

## Tests

- `normalize`: case, diacritics, multiple spaces, Cyrillic, Latin.
- `rowHaystack`: each row kind; workout name, routine name, localized and English exercise name, entry note,
  set note, gym; day-note tag and text; recovery kind and note; activity title/sport/note.
- `filterHistoryIndex`: single term, multiple terms (AND), no match, type filter per kind, month inclusive of
  its days, PR-only, inactive returns the same order.
- `monthsOf`: distinct, newest first, no empty months; `fmtMonth` labels.
- View: typing filters; chips toggle; month picks; PR toggles; result count; empty state; clear restores the
  full list; paging still works on a filtered list; opening a workout sheet and closing keeps the query;
  Escape clears.
- Performance sanity: a fixture with a few thousand workouts does not block the first render (index built
  only when active).

## Where the logic lives

- `frontend/src/lib/history-rows.js` (moved from `History.jsx`).
- `frontend/src/lib/history-search.js` + `history-search.test.js`.
- `frontend/src/lib/format.js` `fmtMonth` + test.
- `frontend/src/views/History.jsx`: state, index memo, chips, month sheet, result line.
- No API, no `S` field, no sync.

## Phase 2 (not this spec)

- Typo/fuzzy matching, reusing the catalogue search's approach.
- Per-chip counts ("Workouts 120") when the list is large.
- A search entry point on Stats/Home (the same component, not a new search).
- A global command palette (separate spec) that also searches screens and routines.
- Saved searches or recent queries.

## Open questions

1. **Month picker control:** a menu sheet (proposed) or a native `<select>`? Proposal: the menu sheet, which
   matches the app's other pickers and handles long month lists on a phone.
2. **Set notes in the haystack:** included (proposed, the deep-search choice). If it makes results noisy,
   drop them in a follow-up rather than adding a toggle.
3. **Query persistence:** none beyond the mounted view (proposed). The workout detail is a sheet over
   History, so the common open-and-return path keeps the query; leaving History resets it.
