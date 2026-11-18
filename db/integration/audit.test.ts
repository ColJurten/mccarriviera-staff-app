import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asActor } from './actor.js';

if (
  process.env.DB_DISPOSABLE !== '1' ||
  !process.env.MIGRATION_DATABASE_URL ||
  !process.env.DATABASE_URL
)
  throw new Error('Disposable owner and runtime databases required');
const owner = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
const runtime = new pg.Client({ connectionString: process.env.DATABASE_URL });
const creator = randomUUID();
const editor = randomUUID();
const excluded = [
  'schema_migrations',
  'audit_events',
  'auth_users',
  'auth_accounts',
  'auth_sessions',
  'auth_verifications',
  'auth_two_factors',
  'auth_flows',
  'auth_rate_limits',
];

// Discover relations, rather than keeping an inclusion list that misses future
// uploads/vehicle_documents. A prefix match would hide new auth_* business data.
async function missingTriggers() {
  return (
    await owner.query(
      `
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname <> ALL($1::text[])
    AND NOT EXISTS (SELECT FROM pg_trigger t WHERE t.tgrelid=c.oid
      AND t.tgfoid='public.audit_business_mutation()'::regprocedure
      AND t.tgtype=29 AND t.tgenabled IN ('O','A') AND t.tgqual IS NULL
      AND NOT t.tgisinternal)
    ORDER BY c.relname`,
      [excluded],
    )
  ).rows.map((r) => r.relname as string);
}
beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
  for (const id of [creator, editor])
    await asActor(
      owner,
      id,
      "INSERT INTO staff_profiles(id,created_by,display_name) VALUES ($1,$1,'Synthetic audit operator')",
      [id],
    );
});
afterAll(async () => {
  await Promise.all([owner.end(), runtime.end()]);
});

it('covers every business relation, detects missing/disabled triggers, and excludes exactly the credential tables', async () => {
  expect(await missingTriggers()).toEqual([]);
  const excludedTriggers = await owner.query(
    `SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgfoid='audit_business_mutation()'::regprocedure AND c.relname=ANY($1::text[])`,
    [excluded],
  );
  expect(excludedTriggers.rows).toEqual([]);
  await owner.query('BEGIN');
  try {
    await owner.query(
      'CREATE TABLE public.synthetic_future_business(id uuid PRIMARY KEY)',
    );
    await owner.query(
      'CREATE TABLE public.auth_synthetic_business(id uuid PRIMARY KEY)',
    );
    expect(await missingTriggers()).toEqual([
      'auth_synthetic_business',
      'synthetic_future_business',
    ]);
    await owner.query(
      'ALTER TABLE clients DISABLE TRIGGER business_mutation_audit',
    );
    expect(await missingTriggers()).toContain('clients');
  } finally {
    await owner.query('ROLLBACK');
  }
});

it('records exact INSERT/UPDATE/DELETE snapshots with current actor and database time', async () => {
  const id = randomUUID();
  const lower = (await owner.query('SELECT clock_timestamp() AS at')).rows[0]
    .at as Date;
  const inserted = (
    await asActor(
      runtime,
      creator,
      "INSERT INTO clients(id,created_by,last_name) VALUES ($1,$2,'Synthetic before') RETURNING to_jsonb(clients) AS row",
      [id, creator],
    )
  ).rows[0].row;
  const updated = (
    await asActor(
      runtime,
      editor,
      "UPDATE clients SET last_name='Synthetic after' WHERE id=$1 RETURNING to_jsonb(clients) AS row",
      [id],
    )
  ).rows[0].row;
  await asActor(owner, editor, 'DELETE FROM clients WHERE id=$1', [id]);
  const upper = (await owner.query('SELECT clock_timestamp() AS at')).rows[0]
    .at as Date;
  const events = (
    await runtime.query(
      'SELECT * FROM audit_events WHERE table_name=$1 AND row_id=$2 ORDER BY created_at',
      ['clients', id],
    )
  ).rows;
  expect(
    events.map((e) => [e.action, e.actor_id, e.before_values, e.after_values]),
  ).toEqual([
    ['INSERT', creator, null, inserted],
    ['UPDATE', editor, inserted, updated],
    ['DELETE', editor, updated, null],
  ]);
  for (const event of events) {
    expect(event.created_by).toBe(event.actor_id);
    expect(event.created_at.getTime()).toBeGreaterThanOrEqual(lower.getTime());
    expect(event.created_at.getTime()).toBeLessThanOrEqual(upper.getTime());
  }
});

it('rejects missing/empty/malformed/unknown actors instead of using created_by, and rolls back audit with data', async () => {
  const id = randomUUID();
  await asActor(
    runtime,
    creator,
    "INSERT INTO clients(id,created_by,last_name) VALUES ($1,$2,'Synthetic unchanged')",
    [id, creator],
  );
  for (const db of [owner, runtime]) {
    for (const actor of [undefined, '', 'invalid-uuid', randomUUID()]) {
      await db.query('BEGIN');
      try {
        if (actor !== undefined)
          await db.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
        await expect(
          db.query(
            "UPDATE clients SET last_name='Synthetic rejected' WHERE id=$1",
            [id],
          ),
        ).rejects.toMatchObject({ code: '22023' });
      } finally {
        await db.query('ROLLBACK');
      }
    }
    await expect(
      db.query(
        "INSERT INTO clients(created_by,last_name) VALUES ($1,'Synthetic rejected')",
        [creator],
      ),
    ).rejects.toMatchObject({ code: '22023' });
  }
  await expect(
    owner.query('DELETE FROM clients WHERE id=$1', [id]),
  ).rejects.toMatchObject({ code: '22023' });
  const rolledBack = randomUUID();
  await owner.query('BEGIN');
  await owner.query("SELECT set_config('app.actor_id',$1,true)", [creator]);
  await owner.query(
    "INSERT INTO clients(id,created_by,last_name) VALUES ($1,$2,'Synthetic rollback')",
    [rolledBack, creator],
  );
  expect(
    (
      await owner.query('SELECT id FROM audit_events WHERE row_id=$1', [
        rolledBack,
      ])
    ).rowCount,
  ).toBe(1);
  await owner.query('ROLLBACK');
  expect(
    (await owner.query('SELECT id FROM clients WHERE id=$1', [rolledBack]))
      .rows,
  ).toEqual([]);
  expect(
    (
      await owner.query('SELECT id FROM audit_events WHERE row_id=$1', [
        rolledBack,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (await runtime.query('SELECT last_name FROM clients WHERE id=$1', [id]))
      .rows[0].last_name,
  ).toBe('Synthetic unchanged');
});

it('prevents runtime forgery and permits only allowlisted ID-only staff events with a matching actor', async () => {
  await expect(
    asActor(
      runtime,
      creator,
      "INSERT INTO audit_events(created_by,actor_id,action,table_name,row_id) VALUES ($1,$1,'forged','clients',$1)",
      [creator],
    ),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    asActor(
      runtime,
      creator,
      "SELECT write_staff_audit('staff_factor_reset',$1,$1)",
      [creator],
    ),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    owner.query("SELECT write_staff_audit('staff_factor_reset',$1,$1)", [
      creator,
    ]),
  ).rejects.toMatchObject({ code: '22023' });
  await expect(
    asActor(
      owner,
      creator,
      "SELECT write_staff_audit('staff_factor_reset',$1,$1)",
      [editor],
    ),
  ).rejects.toMatchObject({ code: '22023' });
  await expect(
    asActor(owner, creator, "SELECT write_staff_audit('unlisted',$1,$1)", [
      creator,
    ]),
  ).rejects.toMatchObject({ code: '22023' });
  const event = (
    await asActor(
      owner,
      creator,
      "INSERT INTO audit_events(created_at,created_by,actor_id,action,table_name,row_id) VALUES ('1900-01-01',$1,$1,'synthetic_time','staff_profiles',$1) RETURNING *",
      [editor],
    )
  ).rows[0];
  expect(event.actor_id).toBe(creator);
  expect(event.created_by).toBe(creator);
  expect(event.created_at.getUTCFullYear()).toBeGreaterThan(2000);
});

it('uses server signature times and audits file references without image/PDF/stroke contents', async () => {
  const vehicle = randomUUID(),
    contract = randomUUID(),
    revision = randomUUID(),
    terms = randomUUID(),
    authTerms = randomUUID();
  const preview = randomUUID(),
    sealed = randomUUID(),
    authorisation = randomUUID(),
    stored = randomUUID(),
    signature = randomUUID(),
    baseline = randomUUID(),
    photo = randomUUID();
  const client = randomUUID(),
    clientDocument = randomUUID(),
    driver = randomUUID(),
    inspection = randomUUID(),
    damage = randomUUID(),
    damagePhoto = randomUUID();
  const digest = 'b'.repeat(64);
  await owner.query('BEGIN');
  try {
    await owner.query("SELECT set_config('app.actor_id',$1,true)", [creator]);
    const lower = (await owner.query('SELECT clock_timestamp() AS at')).rows[0]
      .at as Date;
    await owner.query(
      "INSERT INTO vehicles(id,created_by,plate,make_model) VALUES ($1,$2,$3,'Synthetic car')",
      [vehicle, creator, vehicle.slice(0, 20).toUpperCase()],
    );
    await owner.query(
      'INSERT INTO contracts(id,created_by,vehicle_id) VALUES ($1,$2,$3)',
      [contract, creator, vehicle],
    );
    await owner.query(
      "INSERT INTO contract_revisions(id,created_by,contract_id,revision_no,kind,signed_at) VALUES ($1,$2,$3,1,'departure','1900-01-01')",
      [revision, creator, contract],
    );
    for (const [id, kind] of [
      [terms, 'general_terms'],
      [authTerms, 'return_authorisation'],
    ])
      await owner.query(
        "INSERT INTO terms_versions(id,created_by,kind,language,version_label,effective_from,body_pages) VALUES ($1::uuid,$2,$3,'fr',$1::text,current_date,ARRAY['Synthetic terms'])",
        [id, creator, kind],
      );
    for (const [id, stage, version] of [
      [preview, 'preview', terms],
      [sealed, 'departure', terms],
      [authorisation, 'authorisation', authTerms],
    ])
      await owner.query(
        "INSERT INTO contract_documents(id,created_by,contract_id,revision_no,stage,language,template_version,terms_version_id,storage_path,sha256,size_bytes) VALUES ($1,$2,$3,1,$4,'fr','synthetic-v1',$5,'synthetic/test.pdf',$6,100)",
        [id, creator, contract, stage, version, digest],
      );
    await owner.query(
      "INSERT INTO condition_baselines(id,created_by,vehicle_id,reason,taken_at,taken_by) VALUES ($1,$2,$3,'initial',now(),$2)",
      [baseline, creator, vehicle],
    );
    await owner.query(
      "INSERT INTO photos(id,created_by,baseline_id,kind,angle,storage_path,sha256,size_bytes,taken_at,taken_by) VALUES ($1,$2,$3,'reference','front','synthetic/test.jpg',$4,100,now(),$2)",
      [photo, creator, baseline, digest],
    );
    await owner.query(
      "INSERT INTO stored_signatures(id,created_at,created_by,contract_id,image_path,image_sha256,strokes_path,strokes_sha256,image_size_bytes,strokes_size_bytes,authorisation_version_id,authorisation_pdf_id,captured_at,captured_by,capture_agent_name) VALUES ($1,'1900-01-01',$2,$3,'synthetic/drawing.png',$4,'synthetic/strokes.json',$4,100,100,$5,$6,'1900-01-01',$2,'Synthetic')",
      [stored, creator, contract, digest, authTerms, authorisation],
    );
    await owner.query(
      "INSERT INTO signatures(id,created_at,created_by,contract_id,revision_no,stage,mode,image_path,image_sha256,strokes_path,strokes_sha256,image_size_bytes,strokes_size_bytes,preview_id,preview_sha256,sealed_pdf_sha256,sealed_pdf_id,signed_at,staff_id,device_model,os_version,app_version,ip_address,snapshot_sha256,terms_version_ids) VALUES ($1,'1900-01-01',$2,$3,1,'departure','in_person','synthetic/drawing.png',$4,'synthetic/strokes.json',$4,100,100,$5,$4,$4,$6,'1900-01-01',$2,'Synthetic','test','test','192.0.2.1',$4,ARRAY[$7]::uuid[])",
      [signature, creator, contract, digest, preview, sealed, terms],
    );
    await owner.query(
      "INSERT INTO clients(id,created_by,last_name) VALUES ($1,$2,'Synthetic runbook client')",
      [client, creator],
    );
    await owner.query(
      "INSERT INTO client_documents(id,created_by,client_id,type,storage_path,sha256,size_bytes) VALUES ($1,$2,$3,'licence','synthetic/licence.pdf',$4,100)",
      [clientDocument, creator, client, digest],
    );
    await owner.query(
      "INSERT INTO contract_drivers(id,created_by,contract_id,client_id,role) VALUES ($1,$2,$3,$4,'renter')",
      [driver, creator, contract, client],
    );
    await owner.query(
      "INSERT INTO inspections(id,created_by,contract_id,stage,at,km,fuel,agent_name,baseline_id) VALUES ($1,$2,$3,'departure',now(),0,8,'Synthetic',$4)",
      [inspection, creator, contract, baseline],
    );
    await owner.query(
      "INSERT INTO damages(id,created_by,vehicle_id,comment,found_stage,found_contract_id,found_in_inspection_id) VALUES ($1,$2,$3,'Synthetic scratch','departure',$4,$5)",
      [damage, creator, vehicle, contract, inspection],
    );
    await owner.query(
      "INSERT INTO photos(id,created_by,damage_id,kind,storage_path,sha256,size_bytes,taken_at,taken_by) VALUES ($1,$2,$3,'damage','synthetic/damage.jpg',$4,100,now(),$2)",
      [damagePhoto, creator, damage, digest],
    );
    await owner.query("SELECT write_staff_audit('staff_factor_reset',$1,$1)", [
      creator,
    ]);
    // Execute the SELECT bodies of the actual prepared statements in the docs,
    // binding UUIDs through pg rather than interpolating operator input.
    const runbook = await readFile(
      new URL('../../docs/runbook.md', import.meta.url),
      'utf8',
    );
    const queries = new Map(
      [...runbook.matchAll(/PREPARE (\w+)_audit\(uuid\) AS\n([\s\S]*?);/g)].map(
        (match) => [match[1], match[2]!],
      ),
    );
    expect(queries.size).toBe(4);
    for (const [name, id, expected] of [
      [
        'contract',
        contract,
        [
          contract,
          revision,
          preview,
          sealed,
          authorisation,
          stored,
          signature,
          baseline,
          photo,
          inspection,
          damage,
          damagePhoto,
          driver,
        ],
      ],
      [
        'vehicle',
        vehicle,
        [vehicle, contract, baseline, photo, inspection, damage, damagePhoto],
      ],
      ['client', client, [client, clientDocument, driver]],
      ['staff', creator, [creator]],
    ] as const) {
      const history = (await owner.query(queries.get(name)!, [id])).rows;
      expect(new Set(history.map((e) => e.row_id))).toEqual(new Set(expected));
      if (name === 'staff')
        expect(history.map((e) => e.action)).toContain('staff_factor_reset');
    }
    const upper = (await owner.query('SELECT clock_timestamp() AS at')).rows[0]
      .at as Date;
    const rows = (
      await owner.query(
        'SELECT table_name,after_values FROM audit_events WHERE row_id=ANY($1::uuid[])',
        [[revision, photo, preview, sealed, stored, signature]],
      )
    ).rows;
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      for (const field of [
        'signed_at',
        'captured_at',
        ...(row.table_name === 'signatures' ||
        row.table_name === 'stored_signatures'
          ? ['created_at']
          : []),
      ])
        if (row.after_values[field]) {
          expect(Date.parse(row.after_values[field])).toBeGreaterThanOrEqual(
            lower.getTime(),
          );
          expect(Date.parse(row.after_values[field])).toBeLessThanOrEqual(
            upper.getTime(),
          );
        }
      for (const field of ['storage_path', 'image_path', 'strokes_path'])
        if (row.after_values[field])
          expect(row.after_values[field]).toMatch(/^synthetic\//);
      for (const field of ['bytes', 'strokes', 'image_data', 'pdf_data'])
        expect(Object.keys(row.after_values)).not.toContain(field);
    }
    // First transition timestamps are server-owned; later status transitions
    // retain capture time. Future workflow functions call these same guards.
    const captured = (
      await owner.query(
        'SELECT captured_at FROM stored_signatures WHERE id=$1',
        [stored],
      )
    ).rows[0].captured_at;
    await owner.query('SAVEPOINT lifecycle_time');
    await owner.query(
      "UPDATE stored_signatures SET status='applied',applied_at='1900-01-01',applied_by=$1 WHERE id=$2",
      [creator, stored],
    );
    const applied = (
      await owner.query(
        'SELECT captured_at,applied_at FROM stored_signatures WHERE id=$1',
        [stored],
      )
    ).rows[0];
    expect(applied.captured_at).toEqual(captured);
    expect(applied.applied_at.getTime()).toBeGreaterThanOrEqual(
      lower.getTime(),
    );
    await owner.query('ROLLBACK TO SAVEPOINT lifecycle_time');
    await owner.query(
      "UPDATE stored_signatures SET status='cancelled',cancelled_at='1900-01-01',cancelled_by=$1,cancel_reason='Synthetic cancellation' WHERE id=$2",
      [creator, stored],
    );
    const cancelled = (
      await owner.query(
        'SELECT captured_at,cancelled_at FROM stored_signatures WHERE id=$1',
        [stored],
      )
    ).rows[0];
    expect(cancelled.captured_at).toEqual(captured);
    expect(cancelled.cancelled_at.getTime()).toBeGreaterThanOrEqual(
      lower.getTime(),
    );
    await owner.query('SAVEPOINT frozen_time');
    await expect(
      owner.query(
        "UPDATE stored_signatures SET cancelled_at='1900-01-01' WHERE id=$1",
        [stored],
      ),
    ).rejects.toMatchObject({ code: '55000' });
    await owner.query('ROLLBACK TO SAVEPOINT frozen_time');
  } finally {
    await owner.query('ROLLBACK');
  }
});

it('the audit migration reverses and reapplies without mutating existing evidence', async () => {
  const migration = await readFile(
    new URL('../migrations/20261117000000_audit_trail.sql', import.meta.url),
    'utf8',
  );
  const [up, down] = migration.split('-- migrate:down');
  await owner.query('BEGIN');
  try {
    const before = (
      await owner.query('SELECT count(*)::int AS n FROM audit_events')
    ).rows[0].n;
    await owner.query(down!);
    expect(
      (
        await owner.query(
          "SELECT has_column_privilege('mcr_api','audit_events','action','INSERT') AS allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    await owner.query(up!);
    expect(await missingTriggers()).toEqual([]);
    expect(
      (await owner.query('SELECT count(*)::int AS n FROM audit_events')).rows[0]
        .n,
    ).toBe(before);
    expect(
      (
        await owner.query(
          "SELECT has_column_privilege('mcr_api','audit_events','action','INSERT') AS allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  } finally {
    await owner.query('ROLLBACK');
  }
});
