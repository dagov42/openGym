// Admin invites and the audit log. User management stays in server.js; these two admin surfaces
// own no user records and only read/write db.invites and the audit file.
import crypto from 'node:crypto'
import fs from 'node:fs'

export function adminRoutes(ctx) {
  const {
    json, readBody, requireAdmin, requireOwner, db, saveDb, audit, INVITE_ONLY, text,
    auditLines, auditKeep, AUDIT_ON, AUDIT_IP, AUDIT_MAX, AUDIT_DAYS, auditFile, resetAuditCount,
  } = ctx

  return {
    'GET /api/admin/invites': async (req, res) => {
      if (!requireAdmin(req, res)) return
      // resolve usedBy uid → name for display
      const invites = db.invites.map(i => ({
        ...i, usedByName: i.usedBy ? (db.users.find(u => u.id === i.usedBy) || {}).name || null : null,
      }))
      json(res, 200, { invites, invite_only: INVITE_ONLY })
    },

    'POST /api/admin/invites/new': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      let code
      // 16 hex chars = 64 bits, up from 8 chars / 32 bits. Passkey signup has no rate limiting by
      // design (that's the reverse proxy's job) and /api/register/options tells a caller whether a
      // code is good, so the code itself has to be the thing that isn't worth guessing. Codes already
      // in db.json keep working — validation is an exact string compare, never a length or format check.
      do { code = crypto.randomBytes(8).toString('hex').toUpperCase(); } while (db.invites.some(i => i.code === code))
      const invite = { code, note: text(body.note).slice(0, 60), createdBy: admin.id, created: new Date().toISOString() }
      db.invites.push(invite)
      saveDb()
      audit(req, 'admin.invite.create', { user: admin, msg: code })
      json(res, 200, { invite })
    },

    'POST /api/admin/invites/revoke': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      const inv = db.invites.find(i => i.code === text(body.code).toUpperCase())
      if (!inv) return json(res, 404, { error: 'no such code' })
      if (inv.usedBy) return json(res, 400, { error: 'already used, cannot revoke' })
      db.invites = db.invites.filter(i => i.code !== inv.code)
      saveDb()
      audit(req, 'admin.invite.revoke', { user: admin, msg: inv.code })
      json(res, 200, { ok: true })
    },

    /* ---------- activity log ---------- */
    // Newest first, paged by id. Not by offset: the log grows at the front of this view, so an
    // offset cursor would repeat a row whenever an event lands between two pages; and not by
    // timestamp, because two events can share a millisecond. auditKeep() runs on read as well as
    // on the hourly compaction, so nothing past its retention is ever served.
    'GET /api/admin/audit': async (req, res) => {
      if (!requireAdmin(req, res)) return
      const q = new URL(req.url, 'http://x').searchParams
      const limit = Math.max(1, Math.min(200, +q.get('limit') || 100))
      const before = +q.get('before') || Infinity
      const cat = q.get('cat') || ''
      let rows = auditKeep(auditLines()).reverse()
      if (cat === 'fail') rows = rows.filter(r => !r.ok)
      else if (cat) rows = rows.filter(r => String(r.ev).startsWith(cat + '.'))
      const page = rows.filter(r => r.id < before).slice(0, limit)
      json(res, 200, {
        events: page,
        total: rows.length,
        nextBefore: page.length === limit ? page[page.length - 1].id : null,
        enabled: AUDIT_ON, ip_mode: AUDIT_IP,
        retention: { max: AUDIT_MAX, days: AUDIT_DAYS },
        now: Date.now(),
      })
    },

    // Deleting the log is itself logged, and auditSeq is not reset — so a clear always leaves a
    // visible gap in the ids and can't be used to quietly erase a trace. There is no export route:
    // ./data/audit.log already is the export, in a format jq reads directly.
    // Owner only: an admin who could clear it could erase the trace of what they did.
    'POST /api/admin/audit/clear': async (req, res) => {
      const admin = requireOwner(req, res); if (!admin) return
      try { fs.unlinkSync(auditFile) } catch { /* nothing logged yet */ }
      resetAuditCount()
      audit(req, 'admin.audit.clear', { user: admin })
      json(res, 200, { ok: true })
    },
  }
}
