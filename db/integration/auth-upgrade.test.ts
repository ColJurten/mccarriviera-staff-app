import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { expect, it } from 'vitest';

it('upgrades legacy password-only native sessions safely and supports a reversible migration', async () => {
  if (process.env.DB_DISPOSABLE !== '1' || !process.env.MIGRATION_DATABASE_URL)
    throw new Error('Disposable owner database required');
  const owner = new pg.Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  await owner.connect();
  try {
    // Use a private transaction: existing synthetic fixtures and other suites
    // see no schema/data changes after the final rollback.
    await owner.query('BEGIN');
    const migration = await readFile(
      new URL(
        '../migrations/20261112000000_native_second_factor.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const [up, down] = migration.split('-- migrate:down');
    await owner.query(down!);
    const userId = randomUUID();
    await owner.query(
      "INSERT INTO auth_users(id,name,email) VALUES ($1,'Synthetic legacy staff',$2)",
      [userId, `${userId}@example.com`],
    );
    for (const mode of ['native', 'web_pending', 'web'])
      await owner.query(
        "INSERT INTO auth_sessions(user_id,token,mode,expires_at) VALUES ($1,$2,$3,clock_timestamp()+interval '30 days')",
        [userId, randomUUID(), mode],
      );
    await owner.query(
      "INSERT INTO auth_flows(user_id,token_hash,state,internal_cookie,expires_at) VALUES ($1,$2,'enrollment','synthetic-encrypted-cookie',clock_timestamp()+interval '10 minutes')",
      [userId, 'a'.repeat(64)],
    );
    await owner.query(up!);
    expect(
      (
        await owner.query('SELECT mode FROM auth_sessions WHERE user_id=$1', [
          userId,
        ])
      ).rows,
    ).toEqual([{ mode: 'web' }]);
    expect(
      (
        await owner.query('SELECT id FROM auth_flows WHERE user_id=$1', [
          userId,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await owner.query(
          "SELECT has_column_privilege('mcr_api','staff_profiles','active','UPDATE') AS allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    for (const mode of ['native_pending', 'web_pending'])
      await owner.query(
        "INSERT INTO auth_sessions(user_id,token,mode,expires_at) VALUES ($1,$2,$3,clock_timestamp()+interval '10 minutes')",
        [userId, randomUUID(), mode],
      );
    // Rollback to the old schema also removes unsupported native-pending rows.
    await owner.query(down!);
    expect(
      (
        await owner.query(
          "SELECT id FROM auth_sessions WHERE mode='native_pending'",
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await owner.query('ROLLBACK');
    await owner.end();
  }
});
