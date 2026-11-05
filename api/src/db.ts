import { Kysely, PostgresDialect, sql } from 'kysely';
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
