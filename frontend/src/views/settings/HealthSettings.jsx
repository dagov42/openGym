// The health store page and card, kept out of Settings.jsx. A fact about this phone, kept in
// its own file (lib/health-sync.js) and not in S, so it never switches on anywhere else.
import { useEffect, useState } from 'react'
import { MOBILE } from '../../lib/mobile.js'
import { t } from '../../lib/i18n.js'
import { Section, Row, Switch } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { healthStatus, loadHealth, enableHealth, disableHealth, openHealthConnect, onHealthChange, enableRead, disableRead, allowBirthDate } from '../../lib/health-sync.js'
import { readWatchPrefs, writeWatchPrefs } from '../../lib/watch-settings.js'
import { phoneSessionSupported } from '../../lib/phone-workout.js'
import { isOn } from '../../lib/modules.js'
import { confirmSheet, menuSheet } from '../../sheets.jsx'

// Android app: writing finished workouts and weigh-ins to Health Connect (#200), the phone's
// own store for health data, where other apps can read them. A fact about this phone, kept in
// its own file (lib/health-sync.js) and not in S, so it never switches on anywhere else. The card
// stays out of the way on a phone without Health Connect, and only points to installing it on
// Android 13 and lower, where it is an app of its own. The iPhone app's card is the same switch for
// Apple Health, which the Apple Watch app also goes by (heart rate per set).
const HEALTH_COPY = {
  android: () => ({
    section: t('Health Connect'), write: t('Write to Health Connect'), open: t('Open Health Connect'),
    footer: t('Workouts and weigh-ins go to Health Connect when you finish or change them.'),
    on: t('Writing to Health Connect'), denied: t('Health Connect permission not granted'), failed: t('Could not write to Health Connect'),
    removeFailed: t('Could not remove it from Health Connect'), stop: t('Stop writing to Health Connect?'),
    stopSub: t('What openGym already wrote can stay in Health Connect as your data, or be removed from it.'),
  }),
  ios: () => ({
    section: t('Apple Health'), write: t('Write to Apple Health'), open: t('Open Apple Health'),
    footer: t('Workouts and weigh-ins go to Apple Health when you finish or change them.'),
    on: t('Writing to Apple Health'), denied: t('Apple Health permission not granted'), failed: t('Could not write to Apple Health'),
    removeFailed: t('Could not remove it from Apple Health'), stop: t('Stop writing to Apple Health?'),
    stopSub: t('What openGym already wrote can stay in Apple Health as your data, or be removed from it.'),
  }),
}

// Settings в†’ Integrations в†’ Apple Health / Health Connect. On a phone without the store, a line
// that says so instead of an empty page.
export function HealthPage({ S, toast, android }) {
  if (!MOBILE) return <Section><Row icon="info" iconTint="var(--grey)" title={t('This lives in the openGym phone app.')} /></Section>
  return <>
    <HealthConnectCard S={S} toast={toast} android={android} page />
    <p className="sect-f">{t('Your watch or scale writes here too? Garmin, COROS, Fitbit, Withings, Oura and friends reach openGym this way.')}</p>
  </>
}

// Data & backup's way to the health page, shown where the store is.
export function HealthLinkRow({ android, nav }) {
  const [st, setSt] = useState(null)
  useEffect(() => { let gone = false; healthStatus().then(s => { if (!gone) setSt(s) }).catch(() => {}); return () => { gone = true } }, [])
  if (!st || st.status === 'unsupported') return null
  const ios = st.platform === 'ios' || (!st.platform && !android)
  return <Section tour="data-health">
    <Row icon="heart" iconTint="var(--red)" title={ios ? t('Apple Health') : t('Health Connect')} subtitle={t('Now in Integrations')} accessory="chevron"
      onClick={() => nav('/settings/' + (ios ? 'apple-health' : 'health-connect'))} />
  </Section>
}

export function HealthConnectCard({ S, toast, android, page = false }) {
  const getState = () => useStore.getState().S
  const [st, setSt] = useState(null)
  const [h, setH] = useState(null)
  const [busy, setBusy] = useState(false)
  // iOS 26+: AirPods that measure the heart rate fill each set's when no Apple Watch does (#818).
  const [airpods, setAirpods] = useState(false)
  const [zones, setZones] = useState(() => readWatchPrefs().show.zones)
  useEffect(() => {
    let gone = false
    Promise.all([healthStatus(), loadHealth()]).then(([s, f]) => { if (!gone) { setSt(s); setH(f) } }).catch(() => {})
    if (!android) phoneSessionSupported().then(v => { if (!gone) setAirpods(v) }).catch(() => {})
    const off = onHealthChange(f => { if (!gone) setH(f) })
    return () => { gone = true; off() }
  }, [])
  const ios = st?.platform === 'ios'
  if (!st || !h) return null
  if (st.status === 'unsupported' || (!android && !ios)) {
    return page ? <Section><Row icon="info" iconTint="var(--grey)" title={t('Not on this phone')} subtitle={t('This phone has no health store openGym can use.')} /></Section> : null
  }
  const c = HEALTH_COPY[ios ? 'ios' : 'android']()

  if (st.status !== 'available') return (
    <Section title={t('Health Connect')}>
      <Row icon="heart" iconTint="var(--red)" title={t('Health Connect')}
        subtitle={st.status === 'update'
          ? t('Update Health Connect to share workouts and weigh-ins with other apps.')
          : t('Install Health Connect to share workouts and weigh-ins with other apps.')}
        accessory="chevron" onClick={() => openHealthConnect().catch(() => {})} />
    </Section>
  )

  const turnOn = async () => {
    setBusy(true)
    try {
      const r = await enableHealth(S)
      if (r.health) setH(r.health)
      else setH(await loadHealth())
      if (r.ok) toast(c.on)
      else toast(r.reason === 'denied' ? c.denied : c.failed)
    } catch { toast(c.failed) }
    setBusy(false)
  }
  const turnOff = removeWritten => async () => {
    setBusy(true)
    try { setH(await disableHealth({ removeWritten })) }
    catch { toast(c.removeFailed) }
    setBusy(false)
  }
  // Reading back (v1.4.3): heart rate during workouts and weigh-ins from other apps, each its own
  // switch and its own permission. Turning one off keeps what it already brought in.
  const toggleRead = kind => async v => {
    setBusy(true)
    try {
      if (v) {
        const r = await enableRead(kind, getState)
        setH(r.health || await loadHealth())
        if (!r.ok) toast(r.reason === 'denied' ? c.denied : c.failed)
      } else setH(await disableRead(kind))
    } catch { toast(c.failed) }
    setBusy(false)
  }
  const reading = h.readHr || h.readWeight || h.readBody || h.readVitals || h.readSport

  // Off can mean two things for what is already there, so it asks; closing the sheet keeps it on.
  const askOff = () => menuSheet({
    title: c.stop,
    subtitle: c.stopSub,
    items: [
      { icon: 'check', label: t('Stop, keep what it wrote'), onClick: turnOff(false) },
      { icon: 'trash', label: t('Stop and remove what it wrote'), danger: true, onClick: turnOff(true) },
    ],
  })

  return (
    <Section title={c.section}
      footer={[h.on && c.footer, h.on && ios && airpods && t('AirPods Pro 3 or Powerbeats Pro 2 in? Your iPhone measures the heart rate for every set, unless your Apple Watch is already on it.'), reading && (h.readWeight && h.wHistory ? t('openGym reads only while it is open: heart rate for workouts of the last day, weigh-ins of the last year. Older workouts stay as they are.') : t('openGym reads only while it is open: heart rate for workouts of the last day, weigh-ins of the last 30 days. Older workouts stay as they are.'))].filter(Boolean).join(' ') || null}>
      <Row icon="heart" iconTint="var(--red)" title={c.write}
        subtitle={t('Finished workouts and weigh-ins, from this phone only.')}>
        <Switch checked={!!h.on} disabled={busy} onChange={v => (v ? turnOn() : askOff())} />
      </Row>
      {h.on && h.error === 'permission' && <Row icon="warning" iconTint="var(--orange)"
        title={t('Permission withdrawn. Tap to allow again')} accessory="chevron" onClick={turnOn} />}
      <Row icon="heart" iconTint="var(--red)" title={t('Heart rate from your watch')}
        subtitle={t('After a workout, each set gets the heart rate your watch saved. Garmin, Fitbit, Galaxy Watch and friends welcome.')}>
        <Switch checked={!!h.readHr} disabled={busy} onChange={toggleRead('hr')} />
      </Row>
      <Row icon="scale" iconTint="var(--teal)" title={t('Weigh-ins from other apps')}
        subtitle={t('Your smart scaleвЂ™s weigh-ins land here. One you type in yourself always wins.')}>
        <Switch checked={!!h.readWeight} disabled={busy} onChange={toggleRead('weight')} />
      </Row>
      <Row icon="scale" iconTint="var(--purple)" title={t('Body composition from your scale')}
        subtitle={ios ? t('Body fat and lean mass, as your scale saved them. Shown under Body measurements, never mixed into what you log.') : t('Body fat, lean mass, bone mass, body water and BMR, as your scale saved them. Shown under Body measurements, never mixed into what you log.')}>
        <Switch checked={!!h.readBody} disabled={busy} onChange={toggleRead('body')} />
      </Row>
      {/* Vitals (v1.4.5, lib/vitals.js): what the Daily form card and the check-in use. Explained
          before the system's own dialog, which asks for each of the four on its own. */}
      <Row icon="moon" iconTint="var(--indigo)" title={t('Sleep, resting heart rate, HRV and steps')}
        subtitle={t('For the Daily form card in Stats and your check-in. Read on this phone only, never sent anywhere.')}>
        <Switch checked={!!h.readVitals} disabled={busy} onChange={v => (v
          ? confirmSheet({ title: t('Read your vitals?'),
            message: ios
              ? t('openGym asks Apple Health for your sleep, resting heart rate, heart rate variability and steps. Allow the ones you like. They stay on this phone, in openGymвЂ™s own file, and never go to a server.')
              : t('openGym asks Health Connect for your sleep, resting heart rate, heart rate variability and steps. Allow the ones you like. They stay on this phone, in openGymвЂ™s own file, and never go to a server.'),
            confirmText: t('Continue'), onConfirm: () => toggleRead('vitals')(true) })
          : toggleRead('vitals')(false))} />
      </Row>
      {/* Sport (v1.4.5, gm-hooks, lib/activities.js): runs, rides and matches other apps saved,
          as activities in the calendar and the recovery map. openGym's own workouts stay out. */}
      <Row icon="figureRun" iconTint="var(--blue)" title={t('Runs, rides and matches from other apps')}
        subtitle={t('Strava, your watch, Runna and friends: their sessions show in your calendar and tire the right muscles. No sets, no volume.')}>
        <Switch checked={!!h.readSport} disabled={busy} onChange={toggleRead('sport')} />
      </Row>
      {/* The Apple Watch's Zones page: max heart rate from the age, a watch setting (show.zones).
          On asks Apple Health (the watch app shares this app's permissions), or opens it once answered. */}
      {ios && isOn(S, 'watch') && <Row icon="heart" iconTint="var(--orange)" title={t('Birth date, for heart-rate zones')}
        subtitle={t('Your Apple Watch works out your heart-rate zones from your age. Allow Date of Birth, or change it later in Apple Health.')}>
        <Switch aria-label={t('Birth date, for heart-rate zones')} checked={zones} disabled={busy} onChange={v => {
          setZones(writeWatchPrefs({ show: { zones: v } }).show.zones)
          if (v) allowBirthDate().catch(() => {})
        }} />
      </Row>}
      {reading && h.readError === 'permission' && <Row icon="warning" iconTint="var(--orange)"
        title={t('Permission withdrawn. Tap to allow again')} accessory="chevron"
        onClick={() => toggleRead(h.readHr ? 'hr' : h.readWeight ? 'weight' : h.readBody ? 'body' : h.readVitals ? 'vitals' : 'sport')(true)} />}
      {(h.on || reading) && <Row icon="list" iconTint="var(--blue)" title={c.open}
        accessory="chevron" onClick={() => openHealthConnect().catch(() => {})} />}
    </Section>
  )
}

