import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { WorkoutRow, DayNoteRow, workoutDetailSheet, logPastWorkoutSheet, menuSheet } from '../sheets.jsx'
import { Button, SearchField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { historyRows } from '../lib/history-rows.js'
import { buildHistoryIndex, filterHistoryIndex, monthsOf } from '../lib/history-search.js'
import { fmtMonth } from '../lib/format.js'
import { reportSheet } from '../components/ReportSheet.jsx'
import { recoverySheet, RecoveryRow } from '../components/RecoverySheet.jsx'
import { ActivityRow } from '../components/ActivitySheet.jsx'
import { quickLogSheet } from '../components/QuickLogSheet.jsx'

export { historyRows }

// The list grows as it is scrolled: the first PAGE rows, then PAGE more whenever its end comes
// within a screen or so. A 400-workout history rendered every row (some 1500 components) on each
// open. How far it had grown is kept for the session, so coming back (the back button, the edge
// swipe) renders the same rows and the page lands where it was scrolled to.
export const HISTORY_PAGE = 60
let grownTo = HISTORY_PAGE

const TYPE_CHIPS = [
  ['all', 'All'],
  ['workout', 'Workouts'],
  ['note', 'Notes'],
  ['recovery', 'Recovery'],
  ['activity', 'Activities'],
]

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const rows = useMemo(() => historyRows(S), [S])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [month, setMonth] = useState(null)
  const [pr, setPr] = useState(false)
  const active = !!query.trim() || type !== 'all' || !!month || pr
  const [shown, setShown] = useState(() => Math.max(HISTORY_PAGE, grownTo))
  const end = useRef(null)

  // The index is built only while something is filtered; a query change filters that index again
  // instead of walking every workout and set once per keystroke.
  const index = useMemo(() => (active ? buildHistoryIndex(S, rows) : null), [S, rows, active])
  const filtered = useMemo(
    () => (index ? filterHistoryIndex(index, { query, type, month, pr }) : null),
    [index, query, type, month, pr],
  )
  const listRows = filtered ? filtered.map(e => e.row) : rows
  const months = useMemo(() => monthsOf(rows), [rows])
  const more = listRows.length > shown

  // A filter change starts the filtered list at one page and returns to the top. Clearing it puts
  // the full list back at the depth it had grown to, not at 60 again.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (active) {
      setShown(HISTORY_PAGE)
      try { window.scrollTo(0, 0) } catch { /* no window in a test shell */ }
    } else setShown(Math.max(HISTORY_PAGE, grownTo))
  }, [active, query, type, month, pr])

  useEffect(() => { if (!active) grownTo = Math.max(grownTo, shown) }, [shown, active])

  useEffect(() => {
    if (!more) return
    const IO = typeof window !== 'undefined' ? window.IntersectionObserver : undefined
    // Without an observer (an old engine) the list is simply whole, as before.
    if (typeof IO !== 'function') { setShown(Infinity); return }
    const io = new IO(es => { if (es.some(e => e.isIntersecting)) setShown(n => n + HISTORY_PAGE) }, { rootMargin: '0px 0px 1200px 0px' })
    if (end.current) io.observe(end.current)
    return () => io.disconnect()
  }, [more, shown])

  const clearAll = () => { setQuery(''); setType('all'); setMonth(null); setPr(false) }
  const chooseMonth = () => menuSheet({
    title: t('Month'),
    items: [
      { label: t('All months'), on: !month, onClick: () => setMonth(null) },
      ...months.map(m => ({ label: m.label, on: month === m.ym, onClick: () => setMonth(m.ym) })),
    ],
  })

  return <>
    <div className="hdr"><button className="iconbtn" data-back="/stats" data-tour="history-back" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('History')}</h1><div className="sub">{tn('{0} workout', '{0} workouts', S.workouts.length)}</div></div>
      {/* A sauna, an ice bath (components/RecoverySheet.jsx): logged from here, listed below with the workouts. */}
      {rows.length > 0 && <button className="iconbtn" onClick={() => recoverySheet()} aria-label={t('Log recovery')} title={t('Log recovery')} style={{ marginInlineEnd: 8 }}><Icon name="sparkles" /></button>}
      {S.workouts.length > 0 && <button className="iconbtn" onClick={reportSheet} aria-label={t('Performance report')} title={t('Performance report')}><Icon name="note" /></button>}</div>

    {rows.length > 0 && <>
      <SearchField value={query} onChange={e => setQuery(e.target.value)} onClear={() => setQuery('')} clearLabel={t('Clear search')}
        placeholder={t('Search workouts, exercises and notes')} aria-label={t('Search history')}
        data-search type="search" enterKeyHint="search" autoCorrect="off" autoCapitalize="none"
        onKeyDown={e => { if (e.key === 'Escape') setQuery('') }} />
      <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', margin: '8px 0 10px', paddingBottom: 2 }}>
        {TYPE_CHIPS.map(([id, label]) => <button key={id} type="button" className={'chip nocap' + (type === id ? ' on' : '')}
          aria-pressed={type === id} onClick={() => setType(id)}>{t(label)}</button>)}
        <button type="button" className={'chip nocap' + (month ? ' on' : '')} aria-pressed={!!month} onClick={chooseMonth}>
          <Icon name="calendar" /> {month ? fmtMonth(month) : t('All months')}
        </button>
        <button type="button" className={'chip nocap' + (pr ? ' on' : '')} aria-pressed={pr} onClick={() => setPr(v => !v)}>
          <Icon name="trophy" /> {t('PRs')}
        </button>
      </div>
    </>}

    {rows.length > 0 && <Button icon="plus" data-tour="history-add" onClick={logPastWorkoutSheet} style={{ marginBottom: 8 }}>{t('Log a past workout')}</Button>}
    {rows.length > 0 && <Button variant="ghost" icon="pencil" data-quick-log-open onClick={quickLogSheet} style={{ marginBottom: 12 }}>{t('Type a workout')}</Button>}
    {active && <div className="small muted" aria-live="polite" style={{ margin: '0 2px 8px' }}>{tn('{0} match', '{0} matches', listRows.length)}</div>}
    {rows.length === 0
      ? <EmptyState icon="history" text={t('No workouts yet. Your first one will land here.')}>
          <Button variant="tinted" icon="plus" data-tour="history-add" onClick={logPastWorkoutSheet}>{t('Log a past workout')}</Button>
          <div style={{ height: 8 }} />
          <Button variant="ghost" icon="pencil" data-quick-log-open onClick={quickLogSheet}>{t('Type a workout')}</Button>
          <div style={{ height: 8 }} />
          <Button variant="ghost" icon="sparkles" onClick={() => recoverySheet()}>{t('Log recovery')}</Button>
        </EmptyState>
      : listRows.length === 0
        ? <EmptyState icon="magnifier" text={query.trim() ? t('No matches for “{0}”', query.trim()) : t('No matches')}>
            <Button variant="tinted" icon="xmark" onClick={clearAll}>{t('Clear all')}</Button>
          </EmptyState>
        : <><div className="list">{(more ? listRows.slice(0, shown) : listRows).map((r, i) => r.w
            ? <WorkoutRow key={r.w.id} w={r.w} tour={i === 0 ? 'history-row' : undefined} onClick={() => workoutDetailSheet(r.w)} />
            : r.rec ? <RecoveryRow key={'rec-' + r.rec.id} r={r.rec} />
            : r.act ? <ActivityRow key={'act-' + r.act.id} a={r.act} />
            : <DayNoteRow key={'note-' + r.d} iso={r.d} note={r.note} />)}</div>
            {more && <div ref={end} aria-hidden="true" style={{ height: 1 }} />}</>}
  </>
}
