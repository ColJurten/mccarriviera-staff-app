import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { expect, it } from 'vitest';
import { withActor } from '../src/db.js';
import { authFixture } from './auth-fixture.js';

it('clears actor after commit/rollback before reusing the very same pooled connection', async () => {
  const f = await authFixture();
  const id = randomUUID();
  try {
    await f.runtime.connection().execute(async (connection) => {
      const context = async () =>
        (
          await sql<{
            pid: number;
            actor: string | null;
          }>`select pg_backend_pid() as pid, nullif(current_setting('app.actor_id',true),'') as actor`.execute(
            connection,
          )
        ).rows[0]!;
      const original = await context();
      expect(original.actor).toBeNull();
      await withActor(connection, f.actorId, async (trx) => {
        const current = (
          await sql<{
            pid: number;
            actor: string;
          }>`select pg_backend_pid() as pid, current_setting('app.actor_id') as actor`.execute(
            trx,
          )
        ).rows[0];
        expect(current).toEqual({ pid: original.pid, actor: f.actorId });
        await trx
          .insertInto('clients')
          .values({
            id,
            created_by: f.actorId,
            last_name: 'Synthetic pooled client',
          })
          .execute();
      });
      expect(await context()).toEqual(original);
      await expect(
        connection
          .updateTable('clients')
          .set({ last_name: 'Synthetic missing actor' })
          .where('id', '=', id)
          .execute(),
      ).rejects.toMatchObject({ code: '22023' });
      const rollback = new Error('Synthetic rollback');
      await expect(
        withActor(connection, f.staffId, async (trx) => {
          await trx
            .updateTable('clients')
            .set({ last_name: 'Synthetic rollback' })
            .where('id', '=', id)
            .execute();
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect(await context()).toEqual(original);
      expect(
        await connection
          .selectFrom('clients')
          .select('last_name')
          .where('id', '=', id)
          .executeTakeFirstOrThrow(),
      ).toEqual({ last_name: 'Synthetic pooled client' });
      expect(
        await connection
          .selectFrom('audit_events')
          .select('action')
          .where('row_id', '=', id)
          .execute(),
      ).toEqual([{ action: 'INSERT' }]);
      // A later unauthenticated limiter transaction on this connection succeeds.
      await connection.transaction().execute(async (trx) => {
        await trx
          .insertInto('auth_rate_limits')
          .values({
            key: randomUUID().replaceAll('-', '').padEnd(64, '0'),
            count: 1,
            window_started_at: new Date(),
          })
          .execute();
      });
      expect(await context()).toEqual(original);
    });
  } finally {
    await f.close();
  }
});
