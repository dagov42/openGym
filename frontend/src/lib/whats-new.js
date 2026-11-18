// What's new after an update: a small in-app map of recent release highlights, plus the device's
// last-seen version. No network, no server, no S field.
import { updateRepo } from './update.js'

export const SEEN_KEY = 'whats_new_seen'

export const RELEASES = {
  '1.4.8.1': [
    'Check for updates asks GitHub again instead of repeating the cached answer',
    'A four-number patch like 1.4.8.1 is correctly newer than 1.4.8',
  ],
  '1.4.8': [
    'The Coach retries a long answer once after a dropped connection',
    'Some iPhone photos are accepted again',
    'Assisted machines count progress the right way round',
    'A workout logged from text keeps the meaning it had',
  ],
  '1.4.7': [
    'Programmes: routines as a block of weeks',
    'Circuits, AMRAP, EMOM and Tabata',
    'The live widget on the Lock Screen and the Home Screen',
    'Recent routines at the top of the start picker',
  ],
}

/** Drop semver build metadata: 1.4.6+2026-11-16 -> 1.4.6. */
export const normalizeVersion = v => String(v ?? '').split('+')[0].trim()

/** The highlights for a version, or null when this build has no notes. */
export function itemsFor(version) {
  const items = RELEASES[normalizeVersion(version)]
  return Array.isArray(items) && items.length ? items : null
}

const partsOf = v => normalizeVersion(v).split('.').map(n => parseInt(n, 10) || 0)
const isNewer = (a, b) => {
  const x = partsOf(a), y = partsOf(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  }
  return false
}

/**
 * 'show' | 'wait' | 'no'. First install and a device with no seen version show nothing; a
 * downgrade shows nothing; a busy moment waits for the workout or sheet to end.
 */
export function shouldShow(seen, current, { firstRun = false, busy = false } = {}) {
  if (firstRun) return 'no'
  if (!itemsFor(current)) return 'no'
  const v = normalizeVersion(current)
  if (!seen) return 'no'
  if (seen === v) return 'no'
  if (isNewer(seen, v)) return 'no'
  return busy ? 'wait' : 'show'
}

export const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) || '' } catch { return '' } }
export const writeSeen = v => { try { localStorage.setItem(SEEN_KEY, v) } catch { /* private mode: may ask again */ } }

export const changelogUrl = () => `https://github.com/${updateRepo()}/blob/main/CHANGELOG.md`
