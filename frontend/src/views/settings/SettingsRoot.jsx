// The Settings root: the account card, the grouped rows and the search. Kept out of Settings.jsx
// so the page router and the root do not share one 2,000-line module.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PinnedBadges } from '../../components/Streak.jsx'
import { AvatarFace } from '../../components/Avatar.jsx'
import { Row, SearchField, Section } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { t, tn } from '../../lib/i18n.js'
import { DEMO } from '../../lib/demo.js'
import { MOBILE } from '../../lib/mobile.js'
import { coachAvailable } from '../../lib/coach.js'
import { useStore } from '../../store/useStore.js'
import { PAGES, ROOT_GROUPS, onRoot, searchSettings } from '../settings-pages.js'

// What was typed into the search, kept while you step into a hit and back out again: tied to
// the history entry it was typed on, so Back (in the app, the browser's or Android's) brings the
// results back, while Settings opened afresh from anywhere (the gear, a tab) starts at the root.
let lastQuery = { q: '', key: null }

export default function SettingsRoot({ ctx, preview, open, user, sync, home, go, entryKey }) {
  // The router's key for this history entry, taken once. From the router rather than
  // window.history: drawn under an edge swipe back the page is the entry before the current one.
  const [key] = useState(() => (entryKey && entryKey !== 'default' && entryKey !== 'back-preview' ? entryKey : window.history.state?.key || null))
  const [q, setQ] = useState(() => (key && lastQuery.key === key ? lastQuery.q : ''))
  const set = v => { lastQuery = { q: v, key }; setQ(v) }
  const hits = q.trim() ? searchSettings(q, ctx) : null
  // The account card: who this is, and the one line that matters about it.
  const acct = DEMO ? { title: t('Demo'), sub: t('Example data, only in this browser.') }
    : user ? {
      title: user.name || t('Account'),
      sub: sync && sync.status && sync.status !== 'ok' ? t('Sync needs a look') : MOBILE ? t('Synced with your server') : t('Account, devices and sync'),
    }
    : MOBILE ? { title: t('This phone'), sub: t('All data stays on this phone') }
    : { title: t('Guest'), sub: t('Your data lives on this device. Sign in to sync.') }
  // The face: one's own picture (components/Avatar.jsx), else the name's first letter, else the icon.
  const faceName = user && !DEMO ? (String(user.name || '').trim() || '?') : null
  const nav = useNavigate()
  // Only while the server offers the Coach (the flag every Coach screen reads): on a box without
  // it the admin dashboard has no Coach card to land on.
  const config = useStore(s => s.config)
  const adminCoach = !MOBILE && !DEMO && !!user?.admin && coachAvailable(config, user) && (!ctx.mod || ctx.mod('coach'))
  return <div className="narrow">
    <div className="sp-nav">
      <button className="sp-back" data-back="/home" onClick={home} aria-label={t('Home')}><Icon name="chevronLeft" /><span>{t('Home')}</span></button>
    </div>
    <h1 className="sp-root-title">{t('Settings')}</h1>
    <div className="sp-search">
      <SearchField value={q} onChange={e => set(e.target.value)} onClear={() => set('')}
        placeholder={t('Search…')} aria-label={t('Search settings')} data-search inputMode="search" enterKeyHint="search" autoComplete="off" />
    </div>
    {hits ? (hits.length ? <Section title={tn('{0} result', '{0} results', hits.length)}>
      {hits.slice(0, 40).map(h => (
        <Row key={h.page + ':' + h.title} icon={h.icon} iconTint={h.tint} title={h.label} subtitle={h.trail} accessory="chevron" onClick={() => go(h)} />
      ))}
    </Section> : <div className="sp-empty">{t('No setting matches “{0}”.', q.trim())}</div>) : <>
      <Section>
        <button className="lrow tap sp-acct" data-tour="settings-account" onClick={() => open('account')}>
          <AvatarFace name={faceName} />
          <span className="lrow-m"><span className="lrow-t">{acct.title}</span><span className="lrow-s">{acct.sub}</span></span>
          {/* Badges pinned to the profile (lib/levels.js), from Stats → Week streak → Level. */}
          {ctx.mod('motivation') && <PinnedBadges />}
          <Icon name="chevronRight" className="lrow-c" />
        </button>
      </Section>
      {ROOT_GROUPS.map(g => ({ ...g, ids: g.ids.filter(id => onRoot(id, ctx)) })).filter(g => g.ids.length).map(g => (
        <Section key={g.ids[0]} title={g.title && t(g.title)}>
          {g.ids.map(id => <Row key={id} icon={PAGES[id].icon} iconTint={PAGES[id].tint} title={t(PAGES[id].title)}
            value={preview[id]?.() || null} accessory="chevron" onClick={() => open(id)} className="sp-root-row" tour={'settings-' + id} />)}
          {/* The phone app sets up its own Coach on the Coach page in Connections; in a hosted app the
              Coach is the server's, set up by an admin on the admin dashboard. Its admins get the
              same row, in the same place, straight to that card; nobody else has anything to set. */}
          {g.title === 'Connections' && adminCoach && <Row icon={PAGES.coach.icon} iconTint={PAGES.coach.tint} title={t(PAGES.coach.title)}
            value={t('Admin')} accessory="chevron" onClick={() => nav('/admin', { state: { section: 'coach' } })} className="sp-root-row" />}
          {/* Claude, ChatGPT or Gemini on the plan people already pay for, with openGym as their
              connector (views/Assistants.jsx). Everywhere but the offline build and the demo. */}
          {g.title === 'Connections' && !DEMO && !ctx.offline && <Row icon="chat" iconTint="var(--acc)" title={t('Use your subscription')}
            accessory="chevron" onClick={() => nav('/assistants')} className="sp-root-row" />}
        </Section>
      ))}
      <div className="dim small sp-version">openGym v{__APP_VERSION__}</div>
    </>}
  </div>
}
