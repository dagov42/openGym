// Settings → Workout → "Move to the next exercise" (#1017, #1360): when Cards bring the next
// exercise up by themselves. 'rest' waits for the rest after the last set to run out; 'now' moves
// on the moment that set is ticked and lets the rest keep counting underneath it.
//
// A pure reader, because the screen that shows the choice and the screen that acts on it are not
// the same file. The switch this fork shipped was on by default, so an absent key keeps meaning
// "when the rest ends"; only an explicit off, or the old false, turns the move off.
export const AUTO_NEXT = ['off', 'rest', 'now']

export function autoNextMode(value) {
  if (value === 'now') return 'now'
  if (value === 'rest' || value === true || value === undefined || value === null) return 'rest'
  return 'off'
}
