// Session and instance-config actions, kept out of useStore.js: guest mode, the cached /api/config,
// the phone's Coach settings and the permission steps. The state fields themselves stay in the
// store; these only read and set them.
import { api } from '../../lib/api.js'
import { rememberDefaultLang } from '../../lib/default-lang.js'
import { saveCoachDevice, coachDeviceSettings } from '../../lib/coach-device.js'

let configFetch = null   // the /api/config in flight, so two callers make one request

export function sessionActions({ get, set, setSync }) {
  return {
    finishPermSteps() { set({ permSteps: false }) },
    async setCoachLocal(patch) {
      set({ coachLocal: coachDeviceSettings(await saveCoachDevice(patch)) })
    },
    isGuest: () => localStorage.getItem('gym_guest') === '1',
    // Choosing to go on without a server ends whatever was said about the last one.
    setGuest(v) {
      if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest')
      set({})
      if (v) setSync({ auth: false, offline: false, lastError: null })
    },
    // Public config from /api/config (invite_only, allow_guest). null until the first successful
    // fetch — the login screen and boot both read it, so it is fetched once and cached here
    // rather than by each screen that happens to need it.
    async loadConfig() {
      if (get().config) return get().config
      return get().refreshConfig()
    },
    // Always asks. The cached copy is right for one boot, but an admin can switch the Coach on
    // while a paired phone sits on the setup screen — that screen wants today's answer.
    // Two callers that ask at once get one request: signing in re-asks (setUser) and the pairing
    // flow awaits a refresh of its own immediately after, and there is one answer to have.
    async refreshConfig() {
      if (configFetch) return configFetch
      configFetch = (async () => {
        try { const c = await api('/api/config'); rememberDefaultLang(c); set({ config: c }); return c }
        catch { return null }
        finally { configFetch = null }
      })()
      return configFetch
    },
  }
}
