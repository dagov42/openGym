// The keyboard help sheet, opened by `?` anywhere outside a field and from Settings → About.
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { Button } from './ui.jsx'

const KEY_STYLE = {
  display: 'inline-block', minWidth: 24, padding: '2px 7px', marginInlineStart: 4,
  border: '1px solid var(--separator)', borderRadius: 6, background: 'var(--fill-2)',
  color: 'var(--text)', font: 'inherit', fontWeight: 600, textAlign: 'center',
}

const Key = ({ children }) => <kbd style={KEY_STYLE}>{children}</kbd>

const Shortcut = ({ keys, text }) => <div className="item">
  <div className="grow"><div className="tt">{text}</div></div>
  <span className="small" style={{ whiteSpace: 'nowrap' }}>{keys.map(k => <Key key={k}>{k}</Key>)}</span>
</div>

export function ShortcutsSheet({ close }) {
  return <>
    <h3>{t('Keyboard shortcuts')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('On a phone with a keyboard, the same keys work.')}</div>
    <h4 className="sec">{t('Workout')}</h4>
    <div className="list" style={{ gap: 8, marginBottom: 14 }}>
      <Shortcut keys={['Space', 'Enter']} text={t('Tick the next set')} />
      <Shortcut keys={['←', '→']} text={t('Previous or next exercise')} />
    </div>
    <h4 className="sec">{t('App')}</h4>
    <div className="list" style={{ gap: 8, marginBottom: 14 }}>
      <Shortcut keys={['Esc']} text={t('Close a sheet')} />
      <Shortcut keys={['/']} text={t('Search this screen')} />
      <Shortcut keys={['?']} text={t('Show this list')} />
    </div>
    <Button variant="ghost" className="dim" onClick={close}>{t('Close')}</Button>
  </>
}

export const shortcutsSheet = () => useUI.getState().openSheet(close => <ShortcutsSheet close={close} />)
