// The ceiling a body weight may be typed at. A typed body weight may sit past the slider (a
// 320 kg lifter is real), but not past any person: 9999 saved, drew the chart from 0 to 10,000
// and set a goal 9,922 kg away.
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'

export const bwMax = unit => (unit === 'lb' ? 1500 : 700)

export const bwTooHeavy = (n, unit) => {
  if (n <= bwMax(unit)) return false
  useUI.getState().toast(t('That looks too heavy. Keep it at {0} or less.', fmtNum(bwMax(unit)) + ' ' + unit))
  return true
}
