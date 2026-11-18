// Admin user management: the dashboard's list and drill-down, recovery codes, disable, delete,
// roles and the owner hand-off. They share the server's db, audit, permissions and state helpers;
// the route code lives here, the helpers stay in server.js.
import fs from 'node:fs'

export function adminUserRoutes(ctx) {
  const {
    json, readBody, requireAdmin, requireOwner, db, saveDb, audit,
    isAdmin, isOwner, ADMIN_UIDS, ADMIN_DATA_VIEW, INVITE_ONLY, PASSWORD_LOGIN, TRAINERS,
    readState, records, livePresence, lastSyncOf, hasPassword, presence,
    dropDeviceLinks, removeAccount, issueRecovery, recoveryLinkOf, stateFile,
    org, perms, budgets, shareLog,
  } = ctx

  return {
    /* ---------- admin dashboard ---------- */
    // One row per user, cheap enough for a personal instance (stateSummary reads a file only when it
    // changed). Operational numbers only: how much is there, when it last synced, whether pushes
    // work. With ADMIN_DATA_VIEW on it also says when each person last trained and what they are
    // training right now, as it did before 1.4.5, and that look is in the activity log.
    'GET /api/admin/users': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const view = ADMIN_DATA_VIEW
      const users = db.users.map(u => {
        const S = readState(u.id) || {}
        const workouts = records(S.workouts)
        const last = workouts[workouts.length - 1]
        const live = livePresence(u.id)
        return {
          id: u.id, name: u.name, created: u.created || null,
          disabled: !!u.disabled, admin: isAdmin(u), owner: isOwner(u), invitedBy: u.invitedBy || null,
          workouts: workouts.length,
          ...(view ? { lastWorkout: last ? last.d : null } : {}),
          lastSync: lastSyncOf(u, S),
          hasPush: db.subs.some(s => s.userId === u.id),
          // Training right now is a fact about the server's load; which routine and how far along is theirs.
          live: live ? (view ? live : { startedAt: live.startedAt }) : null,
          // The sign-in e-mail is an admin's to see (to hand out a reset code, to tell two
          // profiles apart), and only while the instance takes passwords at all.
          ...(PASSWORD_LOGIN ? { password: hasPassword(u), email: u.email || null } : {}),
        }
      })
      if (view) audit(req, 'admin.data-view', { user: admin, msg: 'user list' })
      json(res, 200, { users, invite_only: INVITE_ONLY, data_view: view, ...(TRAINERS ? { trainers: true } : {}), ...(PASSWORD_LOGIN ? { password_login: true } : {}), now: Date.now() })
    },

    // Drill-down for one user. Without ADMIN_DATA_VIEW: counts, storage and roles, never a workout
    // or a weigh-in. With it: the full workout history and body-weight log as before 1.4.5, and the
    // look is written to the activity log and to the member's own sharing log.
    'GET /api/admin/user': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const id = new URL(req.url, 'http://x').searchParams.get('id')
      const u = db.users.find(x => x.id === id)
      if (!u) return json(res, 404, { error: 'no such user' })
      const S = readState(u.id) || {}
      let bytes = 0
      try { bytes = fs.statSync(stateFile(u.id)).size } catch { /* no state yet */ }
      const base = {
        user: {
          id: u.id, name: u.name, created: u.created || null, disabled: !!u.disabled, admin: isAdmin(u), owner: isOwner(u), invitedBy: u.invitedBy || null,
          // Only on an instance with password sign-in: whether they have one, and until when an
          // unused reset code is good.
          ...(PASSWORD_LOGIN ? { password: hasPassword(u), email: u.email || null, resetUntil: u.pwReset?.exp > Date.now() ? u.pwReset.exp : null } : {}),
          // Until when an unused recovery code is good (#584), on every instance.
          recoveryUntil: recoveryLinkOf(db, u.id)?.exp || null,
        },
        unit: S.unit || 'kg',
        lastSync: lastSyncOf(u, S),
        hasPush: db.subs.some(s => s.userId === u.id),
        bytes,
        counts: {
          workouts: records(S.workouts).length, bodyweight: records(S.bodyweight).length,
          measurements: records(S.measurements).length, routines: records(S.routines).length,
        },
        ...(TRAINERS ? { roles: org.rolesOf(u.id), grants: org.get().grants.filter(g => g.memberId === u.id && g.status === 'active').length } : {}),
        data_view: false,
      }
      const may = perms.can(admin, 'admin:data-view', { memberId: u.id })
      if (!may.ok) return json(res, 200, base)
      const wait = budgets.take('data.admin', admin.id)
      if (wait) return json(res, 429, { error: 'slow down a little', code: 'rate-limited', retryAfter: wait }, { 'Retry-After': String(wait) })
      audit(req, 'admin.data-view', { user: admin, target: u })
      if (u.id !== admin.id) {
        try { shareLog.append(u.id, { ev: 'data.admin-view', actor: { kind: 'admin', id: admin.id, name: admin.name } }) }
        catch (e) { console.error('share log', e.message) }
      }
      json(res, 200, {
        ...base,
        data_view: true,
        routines: records(S.routines).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, count: records(r.ex).length })),
        bodyweight: records(S.bodyweight),
        // records() already copied, so this reverse is ours: newest first for display. A workout's
        // photos and videos are the owner's own: the admin view gets no refs to them.
        workouts: records(S.workouts).reverse().map(({ media, ...w }) => w),
      })
    },

    // A recovery code (#584): for someone who lost every way in, on any instance, password sign-in
    // or not. The person enters it on the sign-in screen, and the device they use gets a new passkey
    // for the profile (POST /api/device-link/*, the same redemption a device link has). Who may make
    // one for whom: any admin for a profile that is not an admin; the owner for an admin; nobody here
    // for the owner, who uses the server's own command (recover.js), since no one else may take over
    // the owner's login. Not for oneself, and not for a disabled profile. See issueRecovery.
    'POST /api/admin/user/recovery': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      const u = db.users.find(x => x.id === body.id)
      if (!u) return json(res, 404, { error: 'no such user' })
      if (u.id === admin.id) return json(res, 400, { error: 'you are signed in: add a passkey in Settings instead', code: 'self' })
      if (isOwner(u)) return json(res, 403, { error: 'the owner recovers with the server command (recover.js)', code: 'owner' })
      if (isAdmin(u) && !isOwner(admin)) { audit(req, 'admin.denied', { ok: false, user: admin, target: u, msg: 'recovery' }); return json(res, 403, { error: 'only the owner can make a recovery code for an admin' }) }
      if (u.disabled) return json(res, 400, { error: 'enable the account first', code: 'disabled' })
      const { code, link } = issueRecovery(req, u, admin)
      json(res, 200, { ok: true, name: u.name, code, expires: link.exp })
    },

    'POST /api/admin/user/disable': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      const u = db.users.find(x => x.id === body.id)
      if (!u) return json(res, 404, { error: 'no such user' })
      if (isAdmin(u)) return json(res, 400, { error: 'cannot disable an admin' })
      u.disabled = !!body.disabled
      if (u.disabled) presence.delete(u.id)   // drop them off "training now" at once
      // A device link made before the lock would otherwise still be waiting when it is lifted.
      if (u.disabled) dropDeviceLinks(db, u.id)
      saveDb()
      audit(req, u.disabled ? 'admin.user.disable' : 'admin.user.enable', { user: admin, target: u })
      json(res, 200, { ok: true, id: u.id, disabled: u.disabled })
    },

    // Disable locks an account out; this removes it. The one destructive action in the app, so the
    // client asks twice and this end refuses the two cases that cannot be undone from the UI
    // afterwards: an admin deleting themselves, and the last admin standing (issue #107).
    // The invite code that let them in stays burned — it was used, and freeing it would quietly
    // widen an invite-only instance. `GET /api/admin/user` is the export: the dashboard offers it
    // before the confirm, so the training history can be kept if anyone wants it.
    'POST /api/admin/user/delete': async (req, res) => {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      const u = db.users.find(x => x.id === body.id)
      if (!u) return json(res, 404, { error: 'no such user' })
      if (u.id === admin.id) return json(res, 400, { error: 'you cannot delete your own account' })
      if (isAdmin(u) && db.users.filter(isAdmin).length <= 1) return json(res, 400, { error: 'cannot delete the last admin' })
      if (isOwner(u)) return json(res, 400, { error: 'the owner cannot be deleted; hand the role to another admin first' })
      if (isAdmin(u) && !isOwner(admin)) { audit(req, 'admin.denied', { ok: false, user: admin, target: u }); return json(res, 403, { error: 'only the owner can delete an admin' }) }
      const name = u.name
      removeAccount(u)
      // Logged with the name, because the id is about to mean nothing to anyone reading this back.
      audit(req, 'admin.user.delete', { user: admin, msg: name })
      json(res, 200, { ok: true, id: u.id })
    },

    // Appoint or remove an admin. Owner only, never on themselves, and not for an admin named in
    // ADMIN_UIDS: that one comes back on the next restart whatever db.json says, so the switch
    // would lie. A disabled account is enabled first, so nobody is promoted while locked out.
    'POST /api/admin/user/role': async (req, res) => {
      const owner = requireOwner(req, res); if (!owner) return
      const body = await readBody(req)
      const u = db.users.find(x => x.id === body.id)
      if (!u) return json(res, 404, { error: 'no such user' })
      if (u.id === owner.id) return json(res, 400, { error: 'the owner stays an admin' })
      if (typeof body.admin !== 'boolean') return json(res, 400, { error: 'admin must be true or false' })
      if (ADMIN_UIDS.includes(u.id)) return json(res, 400, { error: 'this admin is set in ADMIN_UIDS on the server' })
      if (body.admin && u.disabled) return json(res, 400, { error: 'enable the account first' })
      if (body.admin) u.admin = true; else { delete u.admin; delete u.owner }
      saveDb()
      audit(req, body.admin ? 'admin.role.grant' : 'admin.role.revoke', { user: owner, target: u })
      json(res, 200, { ok: true, id: u.id, admin: isAdmin(u) })
    },

    // Hand the owner role to another admin. The old owner stays an admin.
    'POST /api/admin/owner': async (req, res) => {
      const owner = requireOwner(req, res); if (!owner) return
      const body = await readBody(req)
      const u = db.users.find(x => x.id === body.id)
      if (!u) return json(res, 404, { error: 'no such user' })
      if (u.id === owner.id) return json(res, 400, { error: 'you already are the owner' })
      if (!isAdmin(u) || u.disabled) return json(res, 400, { error: 'make them an admin first' })
      for (const x of db.users) delete x.owner
      u.owner = true
      saveDb()
      audit(req, 'admin.owner.transfer', { user: owner, target: u })
      json(res, 200, { ok: true, id: u.id })
    },
  }
}
