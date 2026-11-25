// A gym card copied from 2GIS or Yandex Maps. The card's share text is the only input: this
// reads it locally and never calls either map service. The person can correct the fields on the
// gym editor before saving.
import { useMemo, useState } from 'react'
import { t } from '../lib/i18n.js'
import { readClipboard } from '../lib/clipboard.js'
import { parseGymCard } from '../lib/gym-card.js'
import { Button, Row } from './ui.jsx'

const sourceName = source => source === '2gis' ? '2GIS' : source === 'yandex' ? 'Yandex Maps' : ''

export function GymPaste({ close, onUse, near = null }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const card = useMemo(() => parseGymCard(text), [text])
  const hasPoint = card && Number.isFinite(card.lat) && Number.isFinite(card.lng)
  const point = hasPoint ? card : card && near ? { ...card, lat: near.lat, lng: near.lng } : null

  const paste = async () => {
    const copied = await readClipboard()
    if (copied) { setText(copied); setError('') }
  }
  const use = () => {
    if (!point) { setError(t('That card has no coordinates. Copy its link again or add the gym manually.')); return }
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
    {card && !hasPoint && <p className="small muted" style={{ marginTop: 8 }}>
      {near ? t('Drag the map to put the pin on your gym.') : t('That card has no coordinates. Copy its link again or add the gym manually.')}
    </p>}
    {error && <p className="small" role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
    <div style={{ height: 12 }} />
    <Button variant="primary" icon="check" onClick={use} disabled={!card}>{t('Continue')}</Button>
  </>
}

/** Open the paste sheet. `onUse` receives { name, address, lat, lng } for the gym editor. */
export function gymPasteSheet(openSheet, { onUse, near }) {
  openSheet(close => <GymPaste close={close} onUse={onUse} near={near} />)
}
