// The What's new sheet, the automatic idle trigger, and the Settings row's opener.
import { useEffect } from 'react'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { changelogUrl, itemsFor, normalizeVersion, readSeen, shouldShow, writeSeen } from '../lib/whats-new.js'

export function WhatsNewSheet({ version, items, close }) {
  // Closing by the button, the backdrop or Escape all unmount the sheet; that is the dismissal.
  useEffect(() => () => writeSeen(version), [version])
  return <>
    <h3>{t('What’s new in {0}', 'v' + version)}</h3>
    <div className="list" style={{ gap: 8, margin: '4px 0 12px' }}>
      {items.map(item => <div className="item" key={item}>
        <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="sparkles" /></span>
        <div className="grow"><div className="tt">{t(item)}</div></div>
      </div>)}
    </div>
    <a href={changelogUrl()} target="_blank" rel="noopener" className="small" style={{ display: 'inline-block', marginBottom: 12 }}>
      {t('Read the changelog')}
    </a>
    <Button variant="primary" onClick={close}>{t('Got it')}</Button>
  </>
}

/** Open the notes for a version; an unknown build opens the changelog instead. */
export function openWhatsNew(version = __APP_VERSION__) {
  const v = normalizeVersion(version)
  const items = itemsFor(v)
  if (!items) {
    try { window.open(changelogUrl(), '_blank', 'noopener') } catch { /* a blocked popup still gets the toast */ }
    useUI.getState().toast(t('No notes for this build.'))
    return
  }
  useUI.getState().openSheet(close => <WhatsNewSheet version={v} items={items} close={close} />)
}

// The automatic sheet: once per version, in the first idle moment after boot. A workout or an
// open sheet holds it; the subscriptions try again when that ends, and the next launch covers the
// rest. A first install writes the current version and says nothing.
let started = false
export function initWhatsNew() {
  if (started) return
  started = true
  const current = normalizeVersion(__APP_VERSION__)
  if (!readSeen()) { writeSeen(current); return }
  let done = false
  const busy = () => !!useStore.getState().S?.active || useUI.getState().sheets.length > 0
  const attempt = () => {
    if (done || !useStore.getState().ready) return
    const decision = shouldShow(readSeen(), current, { busy: busy() })
    if (decision === 'wait') return
    done = true
    if (decision === 'show') openWhatsNew(current)
  }
  useStore.subscribe(attempt)
  useUI.subscribe(attempt)
  setTimeout(attempt, 2500)
}
