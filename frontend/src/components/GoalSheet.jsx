// The target weight, drawn as the goal line on the weight charts.
import { useState } from 'react'
import { Button } from './ui.jsx'
import WeightInput from './WeightInput.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { lastBW } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwTooHeavy } from './weightLimits.js'

const S = () => useStore.getState().S
const update = (...a) => useStore.getState().update(...a)
const toast = m => useUI.getState().toast(m)

export function GoalSheet({ close }) {
  const st = S()
  const bw = lastBW(st)
  const [v, setV] = useState(st.targetW || (bw ? bw.w : 70))
  return <>
    <h3>{t('Target weight')}</h3>
    <div className="muted small">{t('Your goal is drawn as a line through the weight charts, and gains/losses are colored by whether they move toward it.')}</div>
    <WeightInput value={v} setValue={setV} unit={st.unit} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={() => {
      const n = Math.round((v || 0) * 10) / 10
      if (!n || n <= 0) { toast(t('Enter a valid weight')); return }
      if (bwTooHeavy(n, st.unit)) return
      update(s => { s.targetW = n }); close()
      const b = lastBW(S()); toast(t('Goal set: {0}', fmtNum(n) + ' ' + st.unit) + (b ? ' (' + t('{0} to go', fmtNum(Math.abs(n - b.w))) + ')' : ''))
    }}>{t('Save goal')}</Button>
    {st.targetW && <><div style={{ height: 8 }} /><Button variant="danger" onClick={() => { update(s => { s.targetW = null }); close(); toast(t('Goal removed')) }}>{t('Remove goal')}</Button></>}
  </>
}

export const goalSheet = () => useUI.getState().openSheet(close => <GoalSheet close={close} />)
