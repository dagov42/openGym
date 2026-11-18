// The phone app's export choice: save the file to a place the person picks, or send it on
// through the share sheet. The browser keeps its plain download.
import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { shareExport, shareExportBlob, saveExport, saveExportBlob } from '../lib/mobile.js'
import { Button, Row } from './ui.jsx'

export function ExportChoiceSheet({ text, blob, filename, mime, close }) {
  const toast = useUI(s => s.toast)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = text != null ? await saveExport(text, filename, mime) : await saveExportBlob(blob, filename, mime)
      close()
      if (result === 'saved') toast?.(t('Saved to device'))
    } catch (e) {
      close()
      toast?.(t('Couldn’t save the file'))
    }
  }
  const share = async () => {
    if (busy) return
    setBusy(true)
    close()
    try {
      if (text != null) await shareExport(text, filename)
      else await shareExportBlob(blob, filename)
    } catch (e) { /* share sheet dismissed */ }
  }
  return <>
    <h3>{t('Save or share')}</h3>
    <div className="list menu-list" style={{ marginBottom: 14 }}>
      <Row icon="download" title={t('Save to device')} subtitle={t('Choose a folder and file name')} accessory="chevron" onClick={save} />
      <Row icon="share" title={t('Share')} subtitle={t('Send it to another app')} accessory="chevron" onClick={share} />
    </div>
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export const exportChoiceSheet = opts => useUI.getState().openSheet(close => <ExportChoiceSheet {...opts} close={close} />)
