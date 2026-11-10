import process from 'node:process';
import pg from 'pg';
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error(
    'MIGRATION_DATABASE_URL is required for synthetic local seed',
  );
if (process.env.DB_DISPOSABLE !== '1')
  throw new Error(
    'Set DB_DISPOSABLE=1 only for an isolated synthetic local database',
  );
const db = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await db.connect();
try {
  await db.query('BEGIN');
  const actor = '00000000-0000-4000-8000-000000000001';
  await db.query(
    `INSERT INTO staff_profiles(id, created_by, display_name)
     VALUES ($1, $1, 'Synthetic seed fixture') ON CONFLICT (id) DO NOTHING`,
    [actor],
  );
  await db.query(
    `INSERT INTO vehicles(id, created_by, plate, make_model, current_km, current_fuel)
     VALUES ('00000000-0000-4000-8000-000000000002', $1, 'ZZ-001-ZZ', 'Example Compact', 12000, 8),
            ('00000000-0000-4000-8000-000000000003', $1, 'ZZ-002-ZZ', 'Example Estate', 8000, 4)
     ON CONFLICT (id) DO NOTHING`,
    [actor],
  );
  await db.query(
    `INSERT INTO clients(id, created_by, first_name, last_name, email)
     VALUES ('00000000-0000-4000-8000-000000000004', $1, 'Alex', 'Synthetic', 'alex@example.test'),
            ('00000000-0000-4000-8000-000000000005', $1, 'Sam', 'Invented', 'sam@example.test')
     ON CONFLICT (id) DO NOTHING`,
    [actor],
  );
  await db.query('COMMIT');
  process.stdout.write('Synthetic clients and vehicles loaded (idempotent).\n');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
