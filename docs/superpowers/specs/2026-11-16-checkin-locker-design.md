# Locker number on the check-in card

Status: candidate, designed 2026-11-16 (issue #1096). Open questions at the end must be answered before an
implementation plan. Nothing implemented.

## Why

You open the check-in screen at the turnstile, scan the membership code, walk in — and then have to remember
the locker number the front desk gave you. Two gyms, two different locker areas, one more thing to hold in
your head. The card is already on screen; a number typed once next to it costs nothing.

## Goals

1. An optional locker number on each saved gym card (`S.gymCards[i]`), editable in the card sheet.
2. Shown big enough to read at arm's length on the check-in screen, next to or under the code.
3. Shown on the Home check-in card for the last-used card, so it is visible before opening the screen.
4. Synced and backed up with `gymCards`; no new top-level field.
5. Any short string: digits, letters, "B-42", "12A".

## Non-goals

- Locker occupancy, booking, or a locker reminder.
- Per-visit locker history.
- A barcode or QR for the locker.
- Showing it anywhere else (workout, history, share card).

## Data

- Add `locker?: string` to each `gymCards` entry: trimmed, `LOCKER_MAX` (12) characters, no control
  characters. Absent means none.
- `gymCards` already syncs and backs up as profile data; it is in the token `NEVER` set (the code opens a
  turnstile), and the locker rides with it. No new sync key and no token category.
- Editing a card on one device and the number on another: `gymCards` is a whole-field sync like the rest of
  the card list; the later edit wins. That is the existing behaviour and is acceptable for a small list.

## Where it shows

- `frontend/src/views/CheckIn.jsx` `CardFace` (`:127`): under the label or beside the code, `Locker 42`,
  with a `nameIn` accessible name. A card without a locker shows nothing (no empty label).
- `frontend/src/views/Home.jsx`, the inline check-in card (`:257`): a small `Locker 42` line under "Check
  in", for the card `lastGymCardId` points at.
- `CardSheet` (`:163`): a `TextField` "Locker number (optional)" below the label, with `LOCKER_MAX` and the
  same trim rules. No numeric keyboard: "B-42" is valid.
- `t('Locker {0}', value)` for the display; the field label and placeholder through `t()`. No locale edits.

## Edge cases

- No card: no field, nothing on Home.
- A card removed while its locker was shown: it disappears with the card.
- Same locker number at two gyms: allowed; it is per card.
- Empty string: stored as absent (delete the key), so the card reads exactly as before.
- A hostile backup with a 10,000-character locker: `locker` is read back capped at 12 characters.
- Accessibility: the number is read as text, not merged into the card's code label; the field has a label.

## Tests

- Card sheet: add/edit/clear the locker; trim and cap; non-numeric values survive a round trip.
- `CardFace` and Home card: shown when set, absent when not; the accessible name includes the number.
- Backup/export round-trip and the whole-array sync merge (later edit wins).

## Open questions

1. **Placement on the card:** under the gym's label (proposed) or below the code, larger? Proposal: under the
   label; the code stays the biggest thing on the screen.
2. **Home card:** show the locker there too (proposed) or only on the check-in screen? Proposal: show it; the
   Home card exists exactly for the arrival moment.
3. **Per-profile default:** a single "my locker" setting instead of per card? Proposal: per card; two gyms
   rarely share a locker.
