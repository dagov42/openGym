// Locker numbers on a gym card are a small, optional label: trimmed, capped and free of control
// characters. They are profile data only (S.gymCards), never a token or a new sync key.

export const LOCKER_MAX = 12

export function cleanLocker(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LOCKER_MAX).trim()
}

/** The stored locker for a card, read safely even from an older or hostile backup. */
export function lockerOf(card) {
  return cleanLocker(card?.locker)
}
