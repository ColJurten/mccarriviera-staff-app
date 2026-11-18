import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import type { DB } from './db/generated.js';

export function createDatabase(connectionString: string, timeoutMs: number) {
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: timeoutMs,
    idleTimeoutMillis: 10000,
    statement_timeout: timeoutMs,
    query_timeout: timeoutMs,
  });
  // pg removes an errored idle connection; handle the event without logging
  // dependency details so a restarted database can be probed again.
  pool.on('error', () => {});
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  return {
    db,
    probe: async () => {
      await sql`select 1`.execute(db);
    },
    close: () => db.destroy(),
  };
}

// Set identity on the transaction's own connection. PostgreSQL clears it on
// commit/rollback, including when the pool lends that connection to sign-in.
export async function setTransactionActor(
  transaction: Transaction<DB>,
  actorId: string,
) {
  await sql`select set_config('app.actor_id', ${actorId}::uuid::text, true)`.execute(
    transaction,
  );
}

export function withActor<T>(
  db: Kysely<DB>,
  actorId: string,
  work: (transaction: Transaction<DB>) => Promise<T>,
) {
  return db.transaction().execute(async (transaction) => {
    await setTransactionActor(transaction, actorId);
    return work(transaction);
  });
}
