// The calendar feed: its settings routes and the public .ics route. Token rules (scope, expiry,
// sealing) live in tokens.js; this module owns the feed's view and the four routes.
import { createToken, revokeTokens, findToken, touchToken, scopedState, ScopeError } from './tokens.js'
import { buildIcs } from './integrations/calendar.js'
import { open as openSealed, seal as sealText } from './integrations/crypto.js'

export function calendarRoutes(ctx) {
  const {
    json, readBody, readSession, db, saveDb, audit, auditFail, CAL_KEY, origin,
    TOKEN_READS, tooMany, readStateStrict, UNREADABLE, logToken,
  } = ctx

  const calRow = uid => (db.apiTokens || []).find(r => r && r.userId === uid && r.kind === 'calendar' && !(r.exp && r.exp <= Date.now())) || null
  const calUrl = token => origin.replace(/\/$/, '') + '/api/calendar/' + token + '.ics'
  function calView(user) {
    const r = calRow(user.id)
    if (!r || r.sv !== (user.sv || 0)) return { on: false }
    const token = CAL_KEY ? openSealed(CAL_KEY, r.seal, 'calendar:' + r.id) : null
    return { on: true, id: r.id, done: r.scopes?.workouts === 'view', created: r.created, used: r.used || null, ...(token ? { url: calUrl(token) } : {}) }
  }

  return {
    'GET /api/calendar': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      json(res, 200, calView(user))
    },
    // { done: bool } with the feed on changes what it shows and keeps the address; `renew: true`
    // (or no feed yet) makes a new address and ends the old.
    'POST /api/calendar': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      const done = body.done === true
      const scopes = { plans: 'view', workouts: done ? 'view' : 'off' }
      const cur = calRow(user.id)
      if (cur && cur.sv === (user.sv || 0) && body.renew !== true) {
        cur.scopes = { ...cur.scopes, ...scopes }
        saveDb()
        return json(res, 200, calView(user))
      }
      if (!CAL_KEY) return json(res, 503, { error: 'the server secret is missing' })
      const gone = (db.apiTokens || []).filter(r => r && r.userId === user.id && r.kind === 'calendar').flatMap(r => revokeTokens(db, user.id, r.id))
      let made
      try { made = createToken(db, user, { name: 'Calendar feed', scopes, days: 0, kind: 'calendar' }) }
      catch (e) { if (e instanceof ScopeError) return json(res, e.status, { error: e.message, code: e.code }); throw e }
      made.row.seal = sealText(CAL_KEY, made.token, 'calendar:' + made.row.id)
      saveDb()
      audit(req, 'auth.token.create', { user, msg: made.row.name })
      for (const r of gone) logToken(user.id, 'token.end', r)
      logToken(user.id, 'token.create', made.row)
      json(res, 200, calView(user))
    },
    'POST /api/calendar/revoke': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const r = calRow(user.id)
      const gone = r ? revokeTokens(db, user.id, r.id) : []
      if (gone.length) {
        saveDb()
        audit(req, 'auth.token.revoke', { user, msg: gone[0].name })
        logToken(user.id, 'token.end', gone[0])
      }
      json(res, 200, { on: false })
    },
    // The feed itself, for a calendar app: no cookie, no header, the token in the path.
    'GET /api/calendar/{token}.ics': async (req, res) => {
      const row = findToken(db, req.calToken, uid => db.users.find(u => u.id === uid) || null)
      if (!row || row.kind !== 'calendar') {
        auditFail(req, 'auth.token.fail', { ok: false, msg: 'token-invalid' })
        return json(res, 404, { error: 'not found' })
      }
      const wait = TOKEN_READS.take(row.id)
      if (wait) return tooMany(res, wait)
      if (touchToken(row)) saveDb()
      const user = db.users.find(u => u.id === row.userId)
      const state = readStateStrict(user.id)
      if (state === UNREADABLE) return json(res, 503, { error: 'state unreadable' })
      const ics = buildIcs(state ? scopedState(state, row.scopes) : {}, { uid: user.id, done: row.scopes?.workouts === 'view', tz: state?.reminder?.tz, name: user.name || '' })
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': 'inline; filename="opengym.ics"', 'X-Content-Type-Options': 'nosniff' })
      res.end(ics)
    },
  }
}
