import type pg from 'pg';

// Existing schema fixtures make independent writes, including expected errors.
// Give each one a real transaction; never leave session-level identity behind.
export async function asActor(
  db: pg.Client,
  actorId: string,
  statement: string,
  values: unknown[] = [],
) {
  await db.query('BEGIN');
  try {
    await db.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    const result = await db.query(statement, values);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
