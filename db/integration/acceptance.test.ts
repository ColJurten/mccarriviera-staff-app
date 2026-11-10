// US-006 acceptance checks added by the goal-tester step.
import { randomInt, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

if (process.env.DB_DISPOSABLE !== '1')
  throw new Error(
    'DB_DISPOSABLE=1 is required; use an isolated synthetic database',
  );
if (!process.env.MIGRATION_DATABASE_URL || !process.env.DATABASE_URL)
  throw new Error(
    'MIGRATION_DATABASE_URL and restricted DATABASE_URL are required',
  );
const owner = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
const api = new pg.Client({ connectionString: process.env.DATABASE_URL });
const actor = randomUUID();
const vehicle = randomUUID();

async function newContract() {
  const id = randomUUID();
  await owner.query(
    'INSERT INTO contracts(id, created_by, vehicle_id) VALUES ($1,$2,$3)',
    [id, actor, vehicle],
  );
  return id;
}

beforeAll(async () => {
  await owner.connect();
  await api.connect();
  await owner.query(
    "INSERT INTO staff_profiles(id,created_by,display_name) VALUES ($1,$1,'Synthetic acceptance fixture')",
    [actor],
  );
  await owner.query(
    "INSERT INTO vehicles(id,created_by,plate,make_model) VALUES ($1,$2,$3,'Example car')",
    [vehicle, actor, `A-${vehicle.slice(0, 8).toUpperCase()}`],
  );
});
afterAll(async () => {
  await Promise.all([api.end(), owner.end()]);
});

describe('US-006 acceptance (goal-tester)', () => {
  test('parallel reservations for distinct contracts never share a number', async () => {
    const count = 12;
    const year = randomInt(3000, 9000);
    const contracts = await Promise.all(
      Array.from({ length: count }, () => newContract()),
    );
    const connections = contracts.map(
      () => new pg.Client({ connectionString: process.env.DATABASE_URL }),
    );
    try {
      await Promise.all(connections.map((db) => db.connect()));
      // Each connection reserves inside its own transaction, all at once, so
      // the yearly counter row is contended (the row lock serialises them).
      const numbers = await Promise.all(
        connections.map(async (db, i) => {
          await db.query('BEGIN');
          const { rows } = await db.query(
            'SELECT reserve_contract_number($1,$2,$3) AS number',
            [contracts[i], year, actor],
          );
          await db.query('COMMIT');
          return rows[0].number as string;
        }),
      );
      expect(new Set(numbers).size).toBe(count);
      const values = numbers.map((n) => {
        expect(n).toMatch(new RegExp(`^MCR-${year}-\\d{4}$`));
        return Number(n.slice(-4));
      });
      expect(Math.max(...values) - Math.min(...values)).toBe(count - 1);
      const stored = await owner.query(
        'SELECT number FROM contracts WHERE id = ANY($1::uuid[])',
        [contracts],
      );
      expect(stored.rows.map((r) => r.number).sort()).toEqual(
        [...numbers].sort(),
      );
    } finally {
      await Promise.all(connections.map((db) => db.end()));
    }
  });

  test('a signed departure revision rejects UPDATE and DELETE; an unsigned one stays editable', async () => {
    const signedContract = await newContract();
    const draftContract = await newContract();
    const signed = randomUUID();
    const draft = randomUUID();
    await owner.query(
      "INSERT INTO contract_revisions(id,created_by,contract_id,revision_no,kind,signed_at) VALUES ($1,$2,$3,1,'departure',now())",
      [signed, actor, signedContract],
    );
    await api.query(
      "INSERT INTO contract_revisions(id,created_by,contract_id,revision_no,kind) VALUES ($1,$2,$3,1,'departure')",
      [draft, actor, draftContract],
    );
    for (const db of [api, owner])
      await expect(
        db.query(
          "UPDATE contract_revisions SET pickup_place='Synthetic' WHERE id=$1",
          [signed],
        ),
      ).rejects.toMatchObject({ code: '55000' });
    await expect(
      owner.query('DELETE FROM contract_revisions WHERE id=$1', [signed]),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      api.query('DELETE FROM contract_revisions WHERE id=$1', [signed]),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      api.query('UPDATE contract_revisions SET signed_at=NULL WHERE id=$1', [
        signed,
      ]),
    ).rejects.toMatchObject({ code: '42501' });
    await api.query(
      "UPDATE contract_revisions SET pickup_place='Synthetic desk', card_last4='0042' WHERE id=$1",
      [draft],
    );
    expect(
      (
        await api.query(
          'SELECT pickup_place, card_last4 FROM contract_revisions WHERE id=$1',
          [draft],
        )
      ).rows[0],
    ).toEqual({ pickup_place: 'Synthetic desk', card_last4: '0042' });
  });

  test('the API role cannot update any status column on any table', async () => {
    const rows = await owner.query(
      "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='status'",
    );
    const tables = rows.rows.map((r) => r.table_name as string).sort();
    expect(tables).toEqual(
      [
        'contracts',
        'damages',
        'inspections',
        'stored_signatures',
        'vehicles',
      ].sort(),
    );
    for (const table of tables) {
      const granted = await api.query(
        "SELECT has_column_privilege(current_user,$1,'status','UPDATE') AS u, has_column_privilege(current_user,$1,'status','INSERT') AS i",
        [table],
      );
      expect(granted.rows[0]).toEqual({ u: false, i: false });
    }
  });

  test('the seed fixture only owns synthetic vehicles and clients', async () => {
    const seedActor = '00000000-0000-4000-8000-000000000001';
    const seeded = await owner.query(
      'SELECT 1 FROM staff_profiles WHERE id=$1',
      [seedActor],
    );
    if (seeded.rowCount === 0) return; // seed not loaded on this database
    const tables = (
      await owner.query(
        "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='created_by'",
      )
    ).rows.map((r) => r.table_name as string);
    const owned: Record<string, number> = {};
    for (const table of tables) {
      const { rows } = await owner.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE created_by=$1`,
        [seedActor],
      );
      if (rows[0].n > 0) owned[table] = rows[0].n;
    }
    expect(owned).toEqual({ staff_profiles: 1, vehicles: 2, clients: 2 });
    const clients = await owner.query(
      'SELECT email FROM clients WHERE created_by=$1',
      [seedActor],
    );
    for (const { email } of clients.rows)
      expect(email).toMatch(/@example\.test$/);
  });
});
