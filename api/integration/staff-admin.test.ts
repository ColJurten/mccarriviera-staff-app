import { sql } from 'kysely';
import { pendingAuthAudit } from '../src/auth-audit.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { authFixture, sessionCookie, totp } from './auth-fixture.js';
import { createStaffAdmin } from '../src/staff-admin.js';

it('deactivates all sessions/challenges, reactivates without resurrection, and resets factor/password with one audit hook per command', async () => {
  const f = await authFixture();
  const audit = vi.fn(async () => {});
  const admin = createStaffAdmin(f.owner, f.config, audit);
  try {
    const first = await f.native();
    const second = await f.native();
    await f.resetLimits();
    const pending = await f.web();
    const enrolled = f.factor();
    const verified = await f.verify(pending.cookie, totp(enrolled.secret));
    expect(verified.statusCode, verified.body).toBe(200);
    await f.resetLimits();
    const challenge = await f.web();
    const nativeChallenge = (await f.nativeSignIn()).json().flowToken as string;
    await admin.change('deactivate', f.staffId, f.actorId);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(
      (await f.nativeVerify(nativeChallenge, totp(enrolled.secret))).statusCode,
    ).toBe(401);
    expect(
      await f.runtime
        .selectFrom('auth_sessions')
        .select('id')
        .where('user_id', '=', f.userId)
        .execute(),
    ).toEqual([]);
    expect(
      await f.runtime
        .selectFrom('auth_flows')
        .select('id')
        .where('user_id', '=', f.userId)
        .execute(),
    ).toEqual([]);
    expect(
      await f.runtime
        .selectFrom('auth_verifications')
        .select('id')
        .where('value', '=', f.userId)
        .execute(),
    ).toEqual([]);
    expect(
      (await f.verify(challenge.cookie, totp(enrolled.secret))).statusCode,
    ).toBe(401);
    await admin.change('reactivate', f.staffId, f.actorId);
    for (const token of [first, second])
      expect(
        (
          await f.inject({
            url: '/api/auth/session',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(401);
    expect(
      (
        await f.inject({
          url: '/api/auth/session',
          headers: { cookie: sessionCookie(verified) },
        })
      ).statusCode,
    ).toBe(401);
    const newNative = await f.native();
    await admin.change('reset-factor', f.staffId, f.actorId);
    expect(
      await f.runtime
        .selectFrom('auth_two_factors')
        .select('id')
        .where('user_id', '=', f.userId)
        .execute(),
    ).toEqual([]);
    expect(
      (
        await f.inject({
          url: '/api/auth/session',
          headers: { authorization: `Bearer ${newNative}` },
        })
      ).statusCode,
    ).toBe(401);
    await f.resetLimits();
    const reenroll = await f.web();
    expect(reenroll.response.json()).toEqual({ next: 'enrollment' });
    const nextPassword = randomBytes(18).toString('base64url');
    await admin.change('reset-password', f.staffId, f.actorId, nextPassword);
    expect(
      (
        await f.inject({
          method: 'POST',
          url: '/api/auth/native/sign-in',
          payload: { email: f.email, password: f.password },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await f.inject({
          method: 'POST',
          url: '/api/auth/native/sign-in',
          payload: { email: f.email, password: nextPassword },
        })
      ).statusCode,
    ).toBe(200);
    expect(audit).toHaveBeenCalledTimes(4);
    for (const call of audit.mock.calls as unknown as [
      Record<string, unknown>,
      unknown,
    ][]) {
      expect(Object.keys(call[0]).sort()).toEqual([
        'action',
        'actorId',
        'staffId',
      ]);
      expect(call[0].actorId).toBe(f.actorId);
    }
  } finally {
    await f.close();
  }
});

it('enforces the 12-character policy, atomic creation, attribution, and audit rollback without orphan identities', async () => {
  const f = await authFixture();
  const audit = vi.fn(async () => {});
  const admin = createStaffAdmin(f.owner, f.config, audit);
  const email = `${randomUUID()}@example.com`;
  try {
    await expect(
      admin.create({
        email,
        displayName: 'Synthetic',
        password: 'x'.repeat(11),
        actorId: f.actorId,
      }),
    ).rejects.toThrow();
    expect(audit).not.toHaveBeenCalled();
    const created = await admin.create({
      email,
      displayName: 'Synthetic',
      password: 'x'.repeat(12),
      actorId: f.actorId,
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(
      await f.runtime
        .selectFrom('staff_profiles')
        .select(['created_by', 'active'])
        .where('id', '=', created.staffId)
        .executeTakeFirst(),
    ).toEqual({ created_by: f.actorId, active: true });
    await expect(
      admin.create({
        email,
        displayName: 'Duplicate',
        password: f.password,
        actorId: f.actorId,
      }),
    ).rejects.toThrow();
    expect(audit).toHaveBeenCalledTimes(1);
    const failureEmail = `${randomUUID()}@example.com`;
    const failing = createStaffAdmin(f.owner, f.config, async () => {
      throw new Error('Synthetic audit failure');
    });
    await expect(
      failing.create({
        email: failureEmail,
        displayName: 'Synthetic',
        password: f.password,
        actorId: f.actorId,
      }),
    ).rejects.toThrow('Synthetic audit failure');
    expect(
      await f.runtime
        .selectFrom('auth_users')
        .select('id')
        .where('email', '=', failureEmail)
        .execute(),
    ).toEqual([]);
    const token = await f.native();
    await expect(
      failing.change('deactivate', f.staffId, f.actorId),
    ).rejects.toThrow('Synthetic audit failure');
    expect(
      (
        await f.inject({
          url: '/api/auth/session',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(200);
    await expect(
      admin.create({
        email: failureEmail,
        displayName: 'Synthetic',
        password: f.password,
        actorId: null,
      }),
    ).rejects.toThrow('Bootstrap requires an empty account store');
    await expect(
      admin.change('reset-password', f.staffId, f.actorId, 'short'),
    ).rejects.toThrow();
    expect(audit).toHaveBeenCalledTimes(1);
  } finally {
    await f.close();
  }
});

it('runs the developer CLI with protected file input and sanitized output', async () => {
  const f = await authFixture();
  const directory = await mkdtemp(join(tmpdir(), 'mcr-auth-command-'));
  const file = join(directory, 'password');
  const run = (args: string[]) =>
    promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', 'scripts/staff.ts', ...args],
      { timeout: 20000, maxBuffer: 4096 },
    );
  try {
    await writeFile(file, f.password + '\n', { mode: 0o600 });
    const email = `${randomUUID()}@example.com`;
    const result = await run([
      'create',
      '--email',
      email,
      '--name',
      'Synthetic CLI',
      '--actor',
      f.actorId,
      '--password-file',
      file,
    ]);
    expect(result.stdout).toMatch(
      /^Staff profile: [a-f0-9-]{36}\nStaff command completed\.\n$/,
    );
    expect(result.stderr).toBe('');
    const user = await f.runtime
      .selectFrom('auth_users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    const profile = await f.runtime
      .selectFrom('staff_profiles')
      .select('id')
      .where('auth_user_id', '=', user.id)
      .executeTakeFirstOrThrow();
    expect(result.stdout).toContain(profile.id);
    await expect(
      run([
        'create',
        '--email',
        email,
        '--name',
        'Synthetic CLI',
        '--bootstrap',
        '--password-file',
        file,
      ]),
    ).rejects.toMatchObject({
      stderr: 'Staff command failed: bootstrap_not_empty.\n',
    });
    for (const action of [
      'deactivate',
      'reactivate',
      'reset-factor',
      'reset-password',
    ]) {
      const output = await run([
        action,
        '--staff',
        profile.id,
        '--actor',
        f.actorId,
        ...(action === 'reset-password' ? ['--password-file', file] : []),
      ]);
      expect(output.stdout + output.stderr).not.toContain(f.password);
    }
    await expect(
      run([
        'create',
        '--email',
        email,
        '--name',
        'Synthetic CLI',
        '--actor',
        f.actorId,
        '--password',
        f.password,
      ]),
    ).rejects.toMatchObject({
      stderr: 'Staff command failed: command_failed.\n',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await f.close();
  }
}, 60000);

it('persists all five credential-free semantic events in the command transaction', async () => {
  const f = await authFixture();
  try {
    const token = await f.native();
    const factor = f.factor();
    const credentials = await f.runtime
      .selectFrom('auth_accounts')
      .select('password')
      .where('user_id', '=', f.userId)
      .executeTakeFirstOrThrow();
    await f.admin.change('deactivate', f.staffId, f.actorId);
    await f.admin.change('reactivate', f.staffId, f.actorId);
    await f.admin.change(
      'reset-password',
      f.staffId,
      f.actorId,
      randomBytes(18).toString('base64url'),
    );
    await f.admin.change('reset-factor', f.staffId, f.actorId);
    const events = await f.runtime
      .selectFrom('audit_events')
      .selectAll()
      .where('row_id', '=', f.staffId)
      .orderBy('created_at')
      .execute();
    const semantic = events.filter((e) => e.action.startsWith('staff_'));
    expect(semantic.map((e) => e.action)).toEqual([
      'staff_created',
      'staff_deactivated',
      'staff_reactivated',
      'staff_password_reset',
      'staff_factor_reset',
    ]);
    for (const event of semantic) {
      expect(event).toMatchObject({
        created_by: f.actorId,
        actor_id: f.actorId,
        table_name: 'staff_profiles',
        before_values: null,
        after_values: { action: event.action, staff_id: f.staffId },
      });
      expect(event.created_at.getUTCFullYear()).toBeGreaterThan(2000);
    }
    const payload = JSON.stringify(events);
    for (const secret of [
      f.password,
      credentials.password!,
      token,
      factor.secret,
      ...factor.backupCodes,
    ])
      expect(payload.includes(secret)).toBe(false);
    for (const event of events) {
      const keys = Object.keys(event.after_values ?? {});
      for (const credentialKey of [
        'password',
        'access_token',
        'refresh_token',
        'secret',
        'backup_codes',
        'internal_cookie',
        'token',
      ])
        expect(keys).not.toContain(credentialKey);
    }
    expect(events.filter((e) => e.action === 'UPDATE')).toHaveLength(2);
  } finally {
    await f.close();
  }
});

it('rejects missing command actors, including auth-only resets, and rolls back default-writer failure', async () => {
  const f = await authFixture();
  try {
    const token = await f.native();
    const initial = await f.runtime
      .selectFrom('audit_events')
      .select('id')
      .where('row_id', '=', f.staffId)
      .execute();
    const before = await f.runtime
      .selectFrom('auth_accounts')
      .select('password')
      .where('user_id', '=', f.userId)
      .executeTakeFirstOrThrow();
    for (const action of [
      'deactivate',
      'reactivate',
      'reset-password',
      'reset-factor',
    ] as const) {
      for (const actor of ['', randomUUID()])
        await expect(
          f.admin.change(action, f.staffId, actor, f.password),
        ).rejects.toThrow();
      // Clear the transaction actor at the seam, then invoke the REAL writer.
      // This must fail even for commands whose state changes are auth-only.
      const failing = createStaffAdmin(
        f.owner,
        f.config,
        async (event, trx) => {
          await sql`select set_config('app.actor_id','',true)`.execute(trx);
          await pendingAuthAudit(event, trx);
        },
      );
      await expect(
        failing.change(
          action,
          f.staffId,
          f.actorId,
          randomBytes(18).toString('base64url'),
        ),
      ).rejects.toMatchObject({ code: '22023' });
    }
    expect(
      await f.runtime
        .selectFrom('auth_accounts')
        .select('password')
        .where('user_id', '=', f.userId)
        .executeTakeFirstOrThrow(),
    ).toEqual(before);
    expect(
      await f.runtime
        .selectFrom('auth_two_factors')
        .select('id')
        .where('user_id', '=', f.userId)
        .execute(),
    ).toHaveLength(1);
    expect(
      await f.runtime
        .selectFrom('audit_events')
        .select('id')
        .where('row_id', '=', f.staffId)
        .execute(),
    ).toEqual(initial);
    expect(
      (
        await f.inject({
          url: '/api/auth/session',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(200);
    const email = `${randomUUID()}@example.com`;
    const failingCreate = createStaffAdmin(
      f.owner,
      f.config,
      async (event, trx) => {
        await pendingAuthAudit(event, trx);
        throw new Error('Synthetic failure after persistent audit');
      },
    );
    await expect(
      failingCreate.create({
        email,
        displayName: 'Synthetic rollback',
        password: f.password,
        actorId: f.actorId,
      }),
    ).rejects.toThrow('Synthetic failure after persistent audit');
    expect(
      await f.runtime
        .selectFrom('auth_users')
        .select('id')
        .where('email', '=', email)
        .execute(),
    ).toEqual([]);
    expect(
      await f.runtime
        .selectFrom('audit_events')
        .select('id')
        .where('actor_id', '=', f.actorId)
        .where('action', '=', 'staff_created')
        .execute(),
    ).toHaveLength(1);
  } finally {
    await f.close();
  }
});

it('commits self-attributed first-account bootstrap and rolls it all back on writer failure', async () => {
  const f = await authFixture();
  try {
    // This suite is serial and requires DB_DISPOSABLE=1. Clear only the
    // synthetic credential store so the real bootstrap transaction can commit;
    // historical business profiles and immutable audit rows remain intact.
    await f.owner.deleteFrom('auth_users').execute();
    const { staffId } = await f.admin.create({
      email: `${randomUUID()}@example.com`,
      displayName: 'Synthetic bootstrap',
      password: f.password,
      actorId: null,
    });
    const profile = await f.runtime
      .selectFrom('staff_profiles')
      .select(['created_by', 'auth_user_id'])
      .where('id', '=', staffId)
      .executeTakeFirstOrThrow();
    expect(profile.created_by).toBe(staffId);
    expect(profile.auth_user_id).toBeTruthy();
    const events = await f.runtime
      .selectFrom('audit_events')
      .selectAll()
      .where('row_id', '=', staffId)
      .orderBy('created_at')
      .execute();
    expect(events.map((e) => e.action)).toEqual(['INSERT', 'staff_created']);
    for (const event of events)
      expect(event).toMatchObject({
        actor_id: staffId,
        created_by: staffId,
        table_name: 'staff_profiles',
      });
    // A second bootstrap is denied; a writer failure in an empty store leaves
    // neither credentials, the self-referencing profile, nor either event.
    await expect(
      f.admin.create({
        email: `${randomUUID()}@example.com`,
        displayName: 'Synthetic duplicate bootstrap',
        password: f.password,
        actorId: null,
      }),
    ).rejects.toThrow('Bootstrap requires an empty account store');
    await f.owner.deleteFrom('auth_users').execute();
    let rolledBackId = '';
    const failing = createStaffAdmin(f.owner, f.config, async (event, trx) => {
      rolledBackId = event.staffId;
      await pendingAuthAudit(event, trx);
      throw new Error('Synthetic bootstrap audit failure');
    });
    await expect(
      failing.create({
        email: `${randomUUID()}@example.com`,
        displayName: 'Synthetic rollback bootstrap',
        password: f.password,
        actorId: null,
      }),
    ).rejects.toThrow('Synthetic bootstrap audit failure');
    expect(rolledBackId).not.toBe('');
    expect(
      await f.runtime.selectFrom('auth_users').select('id').execute(),
    ).toEqual([]);
    expect(
      await f.runtime
        .selectFrom('staff_profiles')
        .select('id')
        .where('id', '=', rolledBackId)
        .execute(),
    ).toEqual([]);
    expect(
      await f.runtime
        .selectFrom('audit_events')
        .select('id')
        .where('row_id', '=', rolledBackId)
        .execute(),
    ).toEqual([]);
  } finally {
    await f.close();
  }
});
