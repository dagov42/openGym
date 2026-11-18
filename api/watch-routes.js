// The watch relay routes (watch-relay.js, docs/ZEPP_OS.md). They live beside server.js like the
// coach and media route groups: the relay helpers are pure, and the server hands in the session,
// audit and mailbox pieces it owns. A signed-in device asks for a code, the Zepp app redeems it
// for a watch token, and from then on the page and the watch's Side Service meet in this
// profile's mailbox. A watch token opens the two /api/watch/box routes and nothing else.
import fs from 'node:fs'
import { createWatchCode, takeWatchCode, createWatchLink, listWatchLinks, dropWatchLinks, putSnapshot, pushEvents, queuedEvents, ackEvents } from './watch-relay.js'

export function watchRoutes(ctx) {
  const {
    json, readBody, readSession, db, saveDb, audit, auditFail,
    addressPaused, strikeAddress, sessionVersion, watchCodes, watchFile,
    readBox, writeBox, watchLinkFor, text,
  } = ctx

  return {
    'POST /api/watch/pair': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const { code, exp } = createWatchCode(watchCodes, user.id)
      audit(req, 'auth.watch.pair', { user })
      json(res, 200, { code, exp })
    },
    'POST /api/watch/redeem': async (req, res) => {
      const body = await readBody(req)
      if (addressPaused(req, res, 'watch')) return
      const uid = takeWatchCode(watchCodes, text(body.code))
      const user = uid && db.users.find(u => u.id === uid)
      if (!user || user.disabled) {
        strikeAddress(req, 'watch')
        auditFail(req, 'auth.watch.fail', { ok: false, msg: 'code-invalid' })
        return json(res, 400, { error: 'invalid or expired code', code: 'pair-invalid' })
      }
      const { token, link } = createWatchLink(db, user.id, sessionVersion(user), text(body.name))
      saveDb()
      audit(req, 'auth.watch.ok', { user, msg: link.name })
      json(res, 200, { token, id: link.id, name: user.name || '' })
    },
    'GET /api/watch/links': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      json(res, 200, { links: listWatchLinks(db, user.id) })
    },
    'POST /api/watch/unlink': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      const id = text(body.id) || null
      if (dropWatchLinks(db, user.id, id)) saveDb()
      // The last watch gone: nothing is left to read the mailbox.
      if (!listWatchLinks(db, user.id).length) { try { fs.unlinkSync(watchFile(user.id)) } catch { /* none */ } }
      audit(req, 'auth.watch.unlink', { user })
      json(res, 200, { ok: true, links: listWatchLinks(db, user.id) })
    },
    // The page's side: its snapshot for the watches, and what they sent.
    'PUT /api/watch/snapshot': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      if (!listWatchLinks(db, user.id).length) return json(res, 409, { error: 'no watch paired', code: 'no-watch' })
      const box = readBox(user.id)
      if (!putSnapshot(box, body.json)) return json(res, 400, { error: 'not a snapshot' })
      writeBox(user.id, box)
      json(res, 200, { ok: true })
    },
    'GET /api/watch/events': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const links = listWatchLinks(db, user.id)
      const seen = links.reduce((m, l) => Math.max(m, l.seen || 0), 0)
      json(res, 200, { events: links.length ? queuedEvents(readBox(user.id)) : [], paired: links.length, seen })
    },
    'POST /api/watch/ack': async (req, res) => {
      const user = readSession(req)
      if (!user) return json(res, 401, { error: 'not signed in' })
      const body = await readBody(req)
      const box = readBox(user.id)
      if (ackEvents(box, body.ids)) writeBox(user.id, box)
      json(res, 200, { ok: true })
    },
    // The watch's side (its Side Service, with the watch token): the snapshot, and its events.
    'GET /api/watch/box': async (req, res) => {
      const link = watchLinkFor(req)
      if (!link) return json(res, 401, { error: 'not paired', code: 'watch-unpaired' })
      const box = readBox(link.userId)
      json(res, 200, { json: box.snapshot, at: box.snapAt })
    },
    'POST /api/watch/box': async (req, res) => {
      const link = watchLinkFor(req)
      if (!link) return json(res, 401, { error: 'not paired', code: 'watch-unpaired' })
      const body = await readBody(req)
      const box = readBox(link.userId)
      const accepted = pushEvents(box, body.events)
      if (accepted.length) writeBox(link.userId, box)
      json(res, 200, { accepted, json: box.snapshot, at: box.snapAt })
    },
  }
}
