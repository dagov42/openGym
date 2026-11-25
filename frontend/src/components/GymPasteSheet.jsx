// A gym card copied from 2GIS or Yandex Maps. The card's share text is the only input: this
// reads it locally and never calls either map service. The person can correct the fields on the
// gym editor before saving.
import { useEffect, useMemo, useState } from 'react'
import { t } from '../lib/i18n.js'
import { readClipboard } from '../lib/clipboard.js'
import { parseGymCard } from '../lib/gym-card.js'
import { Button, Row } from './ui.jsx'

const sourceName = source => source === '2gis' ? '2GIS' : source === 'yandex' ? 'Yandex Maps' : ''

export function GymPaste({ close, onUse, near = null, onLocate, onAddress }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [here, setHere] = useState(near)
  const [busy, setBusy] = useState(false)
  const card = useMemo(() => parseGymCard(text), [text])
  const hasPoint = card && Number.isFinite(card.lat) && Number.isFinite(card.lng)
  const point = hasPoint ? card : card && here ? { ...card, lat: here.lat, lng: here.lng } : null

  useEffect(() => { setHere(near) }, [near?.lat, near?.lng])

  const paste = async () => {
    const copied = await readClipboard()
    if (copied) { setText(copied); setError('') }
  }
  // A Yandex organisation link often has no point (`?si=...`). Its address is enough to ask OSM
  // where it is; the phone's own position is only the fallback when that search finds nothing.
  const locate = async () => {
    if (!onLocate) return null
    const p = await onLocate()
    if (p) { setHere({ lat: p.lat, lng: p.lng }); setError('') }
    return p
  }
  const use = async () => {
    if (!point) {
      setBusy(true)
      try {
        if (card?.address && onAddress) {
          const p = await onAddress(card.address)
          if (p && card) { close(); onUse({ ...card, lat: p.lat, lng: p.lng }); return }
        }
        const p = await locate()
        if (p && card) { close(); onUse({ ...card, lat: p.lat, lng: p.lng }); return }
        setError(t('That card has no coordinates. Copy its link again or add the gym manually.'))
      } finally { setBusy(false) }
      return
    }
    close()
    onUse(point)
  }

  return <>
    <h3>{t('Paste a gym card')}</h3>
    <p className="muted small" style={{ marginBottom: 12 }}>
      {t('Open 2GIS or Yandex Maps, copy the gym card link, then come back and paste it here.')}
    </p>
    <div className="row" style={{ gap: 8, marginBottom: 10 }}>
      <Button variant="ghost" icon="clipboard" onClick={paste}>{t('Paste from clipboard')}</Button>
    </div>
    <textarea className="input" rows={4} value={text} onChange={e => { setText(e.target.value); setError('') }}
      placeholder="DDX Fitness https://2gis.ru/…" aria-label={t('Paste a gym card')} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    {card && <div className="sect-b" style={{ marginTop: 12 }}>
      <Row icon={hasPoint ? 'checkCircle' : 'mapPin'} iconTint={hasPoint ? 'var(--green)' : 'var(--orange)'}
        title={card.name || t('My gym')} subtitle={[card.address, sourceName(card.source)].filter(Boolean).join(' · ')} />
    </div>}
    {card && !hasPoint && !point && !error && (onAddress || onLocate) && <div style={{ marginTop: 10 }}>
      {onAddress && <Button variant="tinted" icon="search" onClick={async () => {
        setBusy(true)
        try {
          const p = await onAddress(card.address)
          if (p) { setHere({ lat: p.lat, lng: p.lng }); setError('') }
        } finally { setBusy(false) }
      }} disabled={busy}>{busy ? t('Searching…') : t('Find the address on the map')}</Button>}
      {onLocate && <Button variant="tinted" icon="location" onClick={locate} disabled={busy}>{t('Current location')}</Button>}
    </div>}
    {card && !hasPoint && point && !error && <p className="small muted" style={{ marginTop: 8 }}>
      {t('Drag the map to put the pin on your gym.')}
    </p>}
    {error && <p className="small" role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
    <div style={{ height: 12 }} />
    <Button variant="primary" icon="check" onClick={use} disabled={!card || busy}>{busy ? t('Searching…') : t('Continue')}</Button>
  </>
}

/** Open the paste sheet. `onUse` receives { name, address, lat, lng } for the gym editor. */
export function gymPasteSheet(openSheet, { onUse, near, onLocate, onAddress }) {
  openSheet(close => <GymPaste close={close} onUse={onUse} near={near} onLocate={onLocate} onAddress={onAddress} />)
}
