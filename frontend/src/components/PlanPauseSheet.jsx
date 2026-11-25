// Plan pause sheet (2026-11-25): a start date, an inclusive end date or "Until I'm back", a
// reason, an optional note and, while a programme runs, whether its week is held. The date rules
// and the stamped writes live in lib/plan-pause.js (shared core with the server).
import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { pauseOn, PLAN_PAUSE_REASON_LABEL, PLAN_PAUSE_REASON_ICON, withPlanPause, resumePlanPause } from '../lib/plan-pause.js'
import DateField from './DateField.jsx'
import Icon from './Icon.jsx'
import { Button, Row, Switch, Segmented } from './ui.jsx'

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function PlanPause({ from: initialFrom = null, close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const today = todayISO()
  const existing = useMemo(() => {
    const list = S?.planPauses && typeof S.planPauses === 'object' ? S.planPauses : {}
    const pick = initialFrom && list[initialFrom] ? initialFrom : Object.keys(list).sort().reverse().find(k => list[k] && list[k].reason && (list[k].to == null || list[k].to >= today)) || null
    if (!pick || !list[pick] || !list[pick].reason) return null
    return { from: pick, ...list[pick] }
  }, [S?.planPauses, initialFrom, today])
  const active = existing && existing.from <= today && (existing.to == null || existing.to >= today)
  const [from, setFrom] = useState(existing?.from || today)
  const [openEnded, setOpenEnded] = useState(existing ? existing.to == null : false)
  const [to, setTo] = useState(existing?.to || addDays(today, 7))
  const [reason, setReason] = useState(existing?.reason || 'holiday')
  const [note, setNote] = useState(existing?.note || '')
  const [hold, setHold] = useState(existing ? existing.holdProgramme !== false : true)
  const hasProgramme = !!S?.programme?.id
  const valid = !openEnded ? to >= from : true
  const save = () => {
    if (!valid) return
    update(s => {
      s.planPauses = withPlanPause(s.planPauses, from, {
        to: openEnded ? null : to, reason, note, holdProgramme: hasProgramme && hold,
      })
    })
    close()
  }
  const resume = () => {
    update(s => { s.planPauses = resumePlanPause(s.planPauses, existing?.from || from, today) })
    close()
  }
  return <>
    <h3>{t('Pause the plan')}</h3>
    <p className="muted small" style={{ marginBottom: 14 }}>
      {t('The workout reminder and the missed-day nudge go quiet. Nothing else changes, and a workout is never blocked.')}
    </p>
    <Row icon="calendar" iconTint="var(--orange)" title={t('Start date')}>
      <DateField compact value={from} max={null} onChange={setFrom} label={t('Start date')} />
    </Row>
    <Row icon="calendar" iconTint="var(--blue)" title={t('Until')}>
      {openEnded ? <span className="small muted">{t('Until I’m back')}</span>
        : <DateField compact value={to} min={from} onChange={setTo} label={t('Until')} />}
    </Row>
    <Row icon="pause" iconTint="var(--purple)" title={t('Until I’m back')}>
      <Switch checked={openEnded} onChange={setOpenEnded} aria-label={t('Until I’m back')} />
    </Row>
    <Row icon="info" iconTint="var(--grey)" title={t('Reason')}>
      <Segmented className="seg-inline" value={reason} onChange={setReason}
        options={['holiday', 'sick', 'other'].map(k => ({ value: k, label: <span className="row" style={{ gap: 5 }}><Icon name={PLAN_PAUSE_REASON_ICON[k]} />{t(PLAN_PAUSE_REASON_LABEL[k])}</span> }))} />
    </Row>
    <label className="sect-t" style={{ display: 'block', marginTop: 12 }}>{t('Note (optional)')}</label>
    <textarea className="input" rows={2} maxLength={160} value={note} onChange={e => setNote(e.target.value)} />
    {hasProgramme && <Row icon="calendar" iconTint="var(--teal)" title={t('Hold the programme’s week')}>
      <Switch checked={hold} onChange={setHold} aria-label={t('Hold the programme’s week')} />
    </Row>}
    {!valid && <p className="small" role="alert" style={{ color: 'var(--red)' }}>{t('The end date must be on or after the start.')}</p>}
    <div style={{ height: 16 }} />
    <Button variant="primary" onClick={save} disabled={!valid}>{t('Save')}</Button>
    {active && <><div style={{ height: 10 }} /><Button variant="ghost" icon="play" onClick={resume}>{t('Resume now')}</Button></>}
  </>
}

/** Open the pause sheet, optionally editing the pause that starts at `from`. */
export function planPauseSheet(from = null) {
  useUI.getState().openSheet(close => <PlanPause from={from} close={close} />)
}
