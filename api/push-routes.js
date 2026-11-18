// Web Push routes: the VAPID key, subscription upsert/status/removal, the test push and the
// rest-timer alerts. The server passes the push store, throttles and state readers it owns; the
// route logic lives here so server.js keeps the dispatch, not every push detail.
import crypto from 'node:crypto'
import { testPush } from './push-messages.js'

export function pushRoutes(ctx) {
  const {
    json, readBody, readSession, db, saveDb, vapid, MAX_SUBS_PER_USER, deviceIdOf,
    pushEndpointError, pushKeyError, pushThrottled, PUSH_TESTS, REST_TIMER_SETS,
    sendPush, readStateCached, scheduleRestTimer, cancelRestTimer,
  } = ctx

  return {
    'GET /api/push/public-key': async (req, res) => json(res, 200, { key: vapid.publicKey }),

    'POST /api/push/subscribe': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      const sub = body.subscription
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json(res, 400, { error: 'invalid subscription' })
      const bad = pushEndpointError(sub.endpoint) || pushKeyError(sub.keys.p256dh) || pushKeyError(sub.keys.auth)
      if (bad) return json(res, 400, { error: bad })
      // Only the two keys the push protocol needs are kept: `sub` is caller-supplied and would
      // otherwise put arbitrary fields into db.json, which every admin route reads back out.
      const keys = { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }
      const deviceId = deviceIdOf(body.deviceId)
      // An upsert: the client re-sends its subscription on every boot (lib/push.js) so a row this
      // instance lost — pruned after a dead send, a rebuilt db.json — comes back without anyone
      // touching Settings. The same endpoint sent again keeps its original `created`.
      //
      // A row filed under another account moves only for a caller that sends its keys. The endpoint
      // alone is a URL, and whoever learned it could otherwise re-file it as theirs: the owner's
      // device stops getting their alerts, and the caller's are sent to it instead, encrypted to
      // keys of the caller's choosing. The keys are what the browser holds (the auth secret never
      // leaves it and this server), and the legitimate move carries them: a shared browser signed
      // into a second account re-registers the same subscription on boot, and the row should
      // follow the person now using it. Refusing that, or keeping both rows, would leave the first
      // account's reminders arriving on a device somebody else is using.
      const keyDigest = k => crypto.createHash('sha256').update(`${k?.p256dh}\n${k?.auth}`).digest()
      const sameKeys = k => crypto.timingSafeEqual(keyDigest(k), keyDigest(keys))
      if (db.subs.some(s => s.endpoint === sub.endpoint && s.userId !== user.id && !sameKeys(s.keys))) {
        return json(res, 409, { error: 'this subscription belongs to another account' })
      }
      const prev = db.subs.find(s => s.endpoint === sub.endpoint)
      // No usable id in the request (none, or not a short token) leaves the id the row already
      // has: the request is a re-send, not a request to forget which device the row is.
      const storedDevice = deviceId || prev?.deviceId
      db.subs = db.subs.filter(s => s.endpoint !== sub.endpoint)
      // A browser holds one subscription per device, so this cap is far above real use. Without
      // it a single account could pile up endpoints without limit — every one of them a target
      // sendPush() would then contact, and a whole rewrite of db.json per addition.
      const mine = db.subs.filter(s => s.userId === user.id)
      if (mine.length >= MAX_SUBS_PER_USER) {
        const drop = new Set(mine.slice(0, mine.length - MAX_SUBS_PER_USER + 1).map(s => s.endpoint))
        db.subs = db.subs.filter(s => !drop.has(s.endpoint))
      }
      db.subs.push({ userId: user.id, endpoint: sub.endpoint, keys, ...(storedDevice ? { deviceId: storedDevice } : {}), created: prev?.created || new Date().toISOString() })
      saveDb()
      json(res, 200, { ok: true })
    },

    // Whether this instance still holds the caller's subscription for `endpoint`. The browser's
    // side (PushManager.getSubscription) says nothing about ours — a row pruned after a dead send
    // leaves the browser subscribed to nowhere — so Settings asks here before it shows "on".
    // A stored row also says which device it is filed under, `null` for none: a row from before
    // device ids, or one the worker re-sent without its id, sends that device's rest-timer alert
    // to every device of the account (sendPush), and the client re-sends its subscription with its
    // id when this is not its own.
    'GET /api/push/status': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const endpoint = new URL(req.url, 'http://x').searchParams.get('endpoint') || ''
      const row = db.subs.find(s => s.userId === user.id && s.endpoint === endpoint)
      json(res, 200, row ? { subscribed: true, deviceId: row.deviceId || null } : { subscribed: false })
    },

    'POST /api/push/unsubscribe': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      db.subs = db.subs.filter(s => !(s.userId === user.id && s.endpoint === body.endpoint))
      saveDb()
      json(res, 200, { ok: true })
    },

    'POST /api/push/test': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      if (pushThrottled(res, PUSH_TESTS, user)) return
      await sendPush(user.id, testPush(readStateCached(user.id)?.lang))
      json(res, 200, { ok: true })
    },

    'POST /api/push/rest-timer': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      if (pushThrottled(res, REST_TIMER_SETS, user)) return
      const body = await readBody(req)
      // Validated before it is clamped: the clamp used to run first, which turned a missing or
      // unusable value into a 1-second push and made the 400 below unreachable. `Number()` only
      // on a number or a string — on an object it can throw.
      const raw = body.seconds
      const n = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN
      if (!(n >= 1)) return json(res, 400, { error: 'seconds required' })
      const sec = Math.min(3600, Math.round(n))
      scheduleRestTimer(user.id, deviceIdOf(body.deviceId), sec, readStateCached(user.id)?.lang, typeof body.next === 'string' ? body.next : null)
      json(res, 200, { ok: true })
    },

    'POST /api/push/rest-timer/cancel': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      cancelRestTimer(user.id, deviceIdOf(body.deviceId))
      json(res, 200, { ok: true })
    },
  }
}
