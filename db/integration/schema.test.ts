import { randomUUID } from 'node:crypto';
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
const contract = randomUUID();
const revision = randomUUID();
const inspection = randomUUID();
const signedRevision = randomUUID();
const completedInspection = randomUUID();
const baseline = randomUUID();
const photo = randomUUID();
const damage = randomUUID();
const terms = randomUUID();
const authorisationTerms = randomUUID();
const preview = randomUUID();
const sealed = randomUUID();
const authorisation = randomUUID();
const stored = randomUUID();
const signature = randomUUID();
const audit = randomUUID();
const digest = 'a'.repeat(64);
const tables =
  'staff_profiles vehicles condition_baselines photos damages maintenance_records clients client_documents contracts contract_revisions contract_drivers inspections signatures stored_signatures contract_documents terms_versions audit_events contract_number_counters'.split(
    ' ',
  );

async function rejected(
  db: pg.Client,
  sql: string,
  values: unknown[],
  code: string,
) {
  await expect(db.query(sql, values)).rejects.toMatchObject({ code });
}
async function newContract(db = owner) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO contracts(id, created_by, vehicle_id) VALUES ($1,$2,$3)',
    [id, actor, vehicle],
  );
  return id;
}
beforeAll(async () => {
  await owner.connect();
  await api.connect();
  expect(
    (await owner.query('SHOW server_version')).rows[0].server_version,
  ).toMatch(/^17\./);
  const role = (await api.query('SELECT current_user')).rows[0].current_user;
  expect(role).not.toBe(
    (await owner.query('SELECT current_user')).rows[0].current_user,
  );
  expect(
    (
      await api.query(
        "SELECT pg_has_role(current_user, 'mcr', 'MEMBER') AS owner",
      )
    ).rows[0].owner,
  ).toBe(false);
  await owner.query(
    "INSERT INTO staff_profiles(id,created_by,display_name) VALUES ($1,$1,'Synthetic test fixture')",
    [actor],
  );
  await owner.query(
    "INSERT INTO vehicles(id,created_by,plate,make_model) VALUES ($1,$2,$3,'Example car')",
    [vehicle, actor, `T-${vehicle.slice(0, 8).toUpperCase()}`],
  );
  await owner.query(
    'INSERT INTO contracts(id,created_by,vehicle_id) VALUES ($1,$2,$3)',
    [contract, actor, vehicle],
  );
  for (const [id, signed] of [
    [revision, false],
    [signedRevision, true],
  ] as const) {
    await owner.query(
      'INSERT INTO contract_revisions(id,created_by,contract_id,revision_no,kind,signed_at,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        actor,
        contract,
        signed ? 2 : 1,
        signed ? 'amendment' : 'departure',
        signed ? new Date() : null,
        signed ? 'Synthetic extension' : null,
      ],
    );
  }
  await owner.query(
    "INSERT INTO condition_baselines(id,created_by,vehicle_id,reason,taken_at,taken_by) VALUES ($1,$2,$3,'initial',now(),$2)",
    [baseline, actor, vehicle],
  );
  for (const [id, stage, status] of [
    [inspection, 'return', 'in_progress'],
    [completedInspection, 'departure', 'completed'],
  ]) {
    await owner.query(
      "INSERT INTO inspections(id,created_by,contract_id,stage,status,at,km,fuel,agent_name) VALUES ($1,$2,$3,$4,$5,now(),0,8,'Synthetic agent')",
      [id, actor, contract, stage, status],
    );
  }
  await owner.query(
    "INSERT INTO damages(id,created_by,vehicle_id,comment,found_stage) VALUES ($1,$2,$3,'Synthetic scratch','vehicle_file')",
    [damage, actor, vehicle],
  );
  await owner.query(
    "INSERT INTO photos(id,created_by,baseline_id,kind,angle,storage_path,sha256,size_bytes,taken_at,taken_by) VALUES ($1,$2,$3,'reference','front','synthetic/front.jpg',$4,100,now(),$2)",
    [photo, actor, baseline, digest],
  );
  for (const [id, kind] of [
    [terms, 'general_terms'],
    [authorisationTerms, 'return_authorisation'],
  ]) {
    await owner.query(
      "INSERT INTO terms_versions(id,created_by,kind,language,version_label,effective_from,body_pages) VALUES ($1,$2,$3,'fr',$4,current_date,ARRAY['Synthetic terms only'])",
      [id, actor, kind, id],
    );
  }
  for (const [id, stage, version] of [
    [preview, 'preview', terms],
    [sealed, 'departure', terms],
    [authorisation, 'authorisation', authorisationTerms],
  ]) {
    await owner.query(
      "INSERT INTO contract_documents(id,created_by,contract_id,revision_no,stage,language,template_version,terms_version_id,storage_path,sha256,size_bytes) VALUES ($1,$2,$3,1,$4,'fr','synthetic-v1',$5,'synthetic/document.pdf',$6,100)",
      [id, actor, contract, stage, version, digest],
    );
  }
  await owner.query(
    "INSERT INTO stored_signatures(id,created_by,contract_id,image_path,image_sha256,strokes_path,strokes_sha256,image_size_bytes,strokes_size_bytes,authorisation_version_id,authorisation_pdf_id,captured_at,captured_by,capture_agent_name) VALUES ($1,$2,$3,'synthetic/drawing.png',$4,'synthetic/strokes.json',$4,100,100,$5,$6,now(),$2,'Synthetic agent')",
    [stored, actor, contract, digest, authorisationTerms, authorisation],
  );
  await owner.query(
    "INSERT INTO signatures(id,created_by,contract_id,revision_no,stage,mode,image_path,image_sha256,strokes_path,strokes_sha256,image_size_bytes,strokes_size_bytes,preview_id,preview_sha256,sealed_pdf_sha256,sealed_pdf_id,signed_at,staff_id,device_model,os_version,app_version,ip_address,snapshot_sha256,terms_version_ids) VALUES ($1,$2,$3,1,'departure','in_person','synthetic/drawing.png',$4,'synthetic/strokes.json',$4,100,100,$5,$4,$4,$6,now(),$2,'Synthetic device','test','test','192.0.2.1',$4,ARRAY[$7]::uuid[])",
    [signature, actor, contract, digest, preview, sealed, terms],
  );
  await owner.query(
    "INSERT INTO audit_events(id,created_by,actor_id,action,table_name,row_id) VALUES ($1,$2,$2,'synthetic_fixture','contracts',$3)",
    [audit, actor, contract],
  );
}, 30000);
afterAll(async () => {
  await Promise.all([api.end(), owner.end()]);
});

describe('US-006 database catalog and constraints', () => {
  test('adds UUID Better Auth storage and activation without weakening business grants', async () => {
    const authTables = [
      'auth_users',
      'auth_accounts',
      'auth_sessions',
      'auth_verifications',
      'auth_two_factors',
      'auth_flows',
    ];
    const columns = (
      await owner.query(
        "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'",
      )
    ).rows;
    for (const table of authTables) {
      expect(columns).toContainEqual({
        table_name: table,
        column_name: 'id',
        data_type: 'uuid',
      });
      expect(
        (
          await api.query(
            "SELECT has_table_privilege(current_user,$1,'SELECT,INSERT,UPDATE,DELETE') AS allowed",
            [table],
          )
        ).rows[0].allowed,
      ).toBe(true);
    }
    expect(columns).toContainEqual({
      table_name: 'staff_profiles',
      column_name: 'active',
      data_type: 'boolean',
    });
    expect(
      (
        await owner.query('SELECT active FROM staff_profiles WHERE id=$1', [
          actor,
        ])
      ).rows[0].active,
    ).toBe(true);
    await rejected(
      api,
      "INSERT INTO staff_profiles(created_by,display_name) VALUES ($1,'Synthetic forbidden account')",
      [actor],
      '42501',
    );
  });
  test('has 18 UUID tables, creation attribution, typed money and instants, no forbidden card fields', async () => {
    const columns = (
      await owner.query(
        "SELECT table_name,column_name,data_type,numeric_precision,numeric_scale,character_maximum_length FROM information_schema.columns WHERE table_schema='public'",
      )
    ).rows;
    for (const table of tables) {
      expect(columns).toContainEqual(
        expect.objectContaining({
          table_name: table,
          column_name: 'id',
          data_type: 'uuid',
        }),
      );
      expect(columns).toContainEqual(
        expect.objectContaining({
          table_name: table,
          column_name: 'created_at',
          data_type: 'timestamp with time zone',
        }),
      );
      expect(columns).toContainEqual(
        expect.objectContaining({
          table_name: table,
          column_name: 'created_by',
          data_type: 'uuid',
        }),
      );
    }
    for (const column of columns.filter((c) => c.data_type === 'numeric')) {
      expect(column.numeric_precision).toBe(10);
      expect(column.numeric_scale).toBe(2);
    }
    expect(
      columns.filter((c) => /cvv|card_number|full_card/i.test(c.column_name)),
    ).toEqual([]);
    expect(
      columns.filter((c) => c.data_type === 'timestamp without time zone'),
    ).toEqual([]);
    expect(
      columns.filter(
        (c) => c.data_type === 'text' && c.table_name !== 'schema_migrations',
      ),
    ).toEqual([]);
    expect(
      (
        await api.query(
          "SELECT has_schema_privilege(current_user,'public','CREATE') AS allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  test('enforces all status sets and one active contract per vehicle', async () => {
    for (const [table, statuses] of [
      [
        'contracts',
        ['draft', 'awaiting_signature', 'active', 'closed', 'void'],
      ],
      ['vehicles', ['available', 'rented', 'maintenance', 'archived']],
    ] as const) {
      for (const status of statuses) {
        await owner.query(`UPDATE ${table} SET status=$1 WHERE id=$2`, [
          status,
          table === 'contracts' ? contract : vehicle,
        ]);
      }
      await rejected(
        owner,
        `UPDATE ${table} SET status='unknown' WHERE id=$1`,
        [table === 'contracts' ? contract : vehicle],
        '23514',
      );
    }
    await owner.query("UPDATE contracts SET status='active' WHERE id=$1", [
      contract,
    ]);
    await rejected(
      owner,
      "INSERT INTO contracts(created_by,vehicle_id,status) VALUES ($1,$2,'active')",
      [actor, vehicle],
      '23505',
    );
    await owner.query(
      "INSERT INTO contracts(created_by,vehicle_id,status) VALUES ($1,$2,'closed')",
      [actor, vehicle],
    );
    await owner.query("UPDATE contracts SET status='draft' WHERE id=$1", [
      contract,
    ]);
  });
  test('enforces live client limits and codes as well as snapshot monetary limits', async () => {
    for (const column of [
      'first_name',
      'last_name',
      'street',
      'line2',
      'city',
      'local_address',
    ]) {
      const id = randomUUID();
      await api.query(
        `INSERT INTO clients(id,created_by,last_name) VALUES ($1,$2,'Synthetic')`,
        [id, actor],
      );
      await api.query(`UPDATE clients SET ${column}=$1 WHERE id=$2`, [
        'x'.repeat(80),
        id,
      ]);
      await rejected(
        api,
        `UPDATE clients SET ${column}=$1 WHERE id=$2`,
        ['x'.repeat(81), id],
        '22001',
      );
      await rejected(
        api,
        `UPDATE clients SET id_doc_type='unknown' WHERE id=$1`,
        [id],
        '23514',
      );
    }
    const numericColumns = (
      await owner.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='contract_revisions' AND data_type='numeric'",
      )
    ).rows;
    for (const { column_name: column } of numericColumns) {
      if (column === 'pricing_balance') continue;
      await rejected(
        owner,
        `UPDATE contract_revisions SET ${column}=-0.01 WHERE id=$1`,
        [revision],
        '23514',
      );
    }
    for (const [table, id] of [
      ['inspections', inspection],
      ['damages', damage],
      ['stored_signatures', stored],
    ]) {
      await rejected(
        owner,
        `UPDATE ${table} SET status='unknown' WHERE id=$1`,
        [id],
        '23514',
      );
    }
    const publicExecution = await owner.query(
      "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='public' AND a.grantee=0 AND a.privilege_type='EXECUTE'",
    );
    expect(publicExecution.rows).toEqual([]);
    const keys = (
      await owner.query(
        "SELECT tc.table_name,kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_catalog,constraint_schema,constraint_name) WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public'",
      )
    ).rows;
    for (const table of tables)
      expect(keys).toContainEqual({ table_name: table, column_name: 'id' });
  });
  test('enforces km and fuel boundaries on vehicles, inspections and stored capture', async () => {
    for (const [table, id, km, fuel] of [
      ['vehicles', vehicle, 'current_km', 'current_fuel'],
      ['inspections', inspection, 'km', 'fuel'],
      ['stored_signatures', stored, 'km_at_capture', 'fuel_at_capture'],
    ]) {
      // Stored drawing/capture fields are immutable even for the owner after capture.
      if (table === 'stored_signatures') continue;
      for (const value of [-1, 9])
        await rejected(
          owner,
          `UPDATE ${table} SET ${fuel}=$1 WHERE id=$2`,
          [value, id],
          '23514',
        );
      for (const value of [0, 8])
        await owner.query(
          `UPDATE ${table} SET ${fuel}=$1,${km}=0 WHERE id=$2`,
          [value, id],
        );
      await rejected(
        owner,
        `UPDATE ${table} SET ${km}=-1 WHERE id=$1`,
        [id],
        '23514',
      );
    }
  });
  test('bounds client/vehicle snapshots, comments, card suffix and expiry; preserves leading zeroes', async () => {
    for (const column of [
      'renter_first_name',
      'renter_last_name',
      'renter_street',
      'renter_line2',
      'additional_first_name',
      'additional_local_address',
      'vehicle_make_model',
      'departure_agent',
    ]) {
      await owner.query(
        `UPDATE contract_revisions SET ${column}=$1 WHERE id=$2`,
        ['a'.repeat(80), revision],
      );
      await rejected(
        owner,
        `UPDATE contract_revisions SET ${column}=$1 WHERE id=$2`,
        ['a'.repeat(81), revision],
        '22001',
      );
    }
    await owner.query('UPDATE inspections SET comment=$1 WHERE id=$2', [
      'a'.repeat(500),
      inspection,
    ]);
    await rejected(
      owner,
      'UPDATE inspections SET comment=$1 WHERE id=$2',
      ['a'.repeat(501), inspection],
      '22001',
    );
    for (const suffix of ['123', 'abcd', '12345'])
      await expect(
        owner.query('UPDATE contract_revisions SET card_last4=$1 WHERE id=$2', [
          suffix,
          revision,
        ]),
      ).rejects.toThrow();
    for (const expiry of ['00/27', '13/27', '1/27', '01/2027'])
      await expect(
        owner.query(
          'UPDATE contract_revisions SET card_expiry=$1 WHERE id=$2',
          [expiry, revision],
        ),
      ).rejects.toThrow();
    await owner.query(
      "UPDATE contract_revisions SET card_last4='0012',card_expiry='12/27',pricing_rental=10.25,pricing_balance=-1.25 WHERE id=$1",
      [revision],
    );
    expect(
      (
        await owner.query(
          'SELECT card_last4,pricing_rental FROM contract_revisions WHERE id=$1',
          [revision],
        )
      ).rows[0],
    ).toEqual({ card_last4: '0012', pricing_rental: '10.25' });
    await rejected(
      owner,
      'UPDATE contract_revisions SET pricing_rental=-1 WHERE id=$1',
      [revision],
      '23514',
    );
    await rejected(
      owner,
      "UPDATE contract_revisions SET card_brand='unknown' WHERE id=$1",
      [revision],
      '23514',
    );
    await rejected(
      owner,
      "UPDATE contract_revisions SET renter_title='unknown' WHERE id=$1",
      [revision],
      '23514',
    );
  });
  test('rejects invalid photo ownership, evidence links and duplicate driver/stage/revisions', async () => {
    await rejected(
      owner,
      "INSERT INTO photos(created_by,kind,storage_path,sha256,size_bytes,taken_at,taken_by) VALUES ($1,'dashboard','synthetic/x',$2,1,now(),$1)",
      [actor, digest],
      '23514',
    );
    await rejected(
      owner,
      "INSERT INTO photos(created_by,baseline_id,damage_id,kind,angle,storage_path,sha256,size_bytes,taken_at,taken_by) VALUES ($1,$2,$3,'reference','rear','synthetic/x',$4,1,now(),$1)",
      [actor, baseline, damage, digest],
      '23514',
    );
    await rejected(
      owner,
      "INSERT INTO contract_revisions(created_by,contract_id,revision_no,kind) VALUES ($1,$2,1,'departure')",
      [actor, contract],
      '23505',
    );
    await rejected(
      owner,
      "INSERT INTO inspections(created_by,contract_id,stage,at,km,fuel,agent_name) VALUES ($1,$2,'return',now(),0,8,'Synthetic')",
      [actor, contract],
      '23505',
    );
    await rejected(
      owner,
      'UPDATE inspections SET open_damage_ids=ARRAY[$1]::uuid[] WHERE id=$2',
      [randomUUID(), inspection],
      '23514',
    );
    await rejected(
      owner,
      "UPDATE stored_signatures SET image_path='synthetic/replacement' WHERE id=$1",
      [stored],
      '55000',
    );
    await rejected(
      owner,
      "UPDATE damages SET comment='replacement' WHERE id=$1",
      [damage],
      '55000',
    );
    const client = randomUUID();
    await owner.query(
      "INSERT INTO clients(id,created_by,last_name) VALUES ($1,$2,'Invented')",
      [client, actor],
    );
    await api.query(
      "INSERT INTO contract_drivers(created_by,contract_id,client_id,role) VALUES ($1,$2,$3,'renter')",
      [actor, contract, client],
    );
    await rejected(
      api,
      "INSERT INTO contract_drivers(created_by,contract_id,client_id,role) VALUES ($1,$2,$3,'additional')",
      [actor, contract, client],
      '23505',
    );
  });
});

describe('restricted runtime privileges and immutability', () => {
  test('denies status writes alone, mixed with permitted fields, and on insert', async () => {
    for (const [table, id, status, permitted] of [
      ['contracts', contract, 'active', 'void_reason'],
      ['vehicles', vehicle, 'rented', 'notes'],
      ['inspections', inspection, 'completed', 'comment'],
      ['damages', damage, 'repaired', 'comment'],
      ['stored_signatures', stored, 'applied', 'cancel_reason'],
    ]) {
      await rejected(
        api,
        `UPDATE ${table} SET status=$1 WHERE id=$2`,
        [status, id],
        '42501',
      );
      await rejected(
        api,
        `UPDATE ${table} SET status=$1,${permitted}='synthetic' WHERE id=$2`,
        [status, id],
        '42501',
      );
    }
    await rejected(
      api,
      "INSERT INTO contracts(created_by,vehicle_id,status) VALUES ($1,$2,'active')",
      [actor, vehicle],
      '42501',
    );
    await rejected(
      api,
      'UPDATE contracts SET number=$1 WHERE id=$2',
      ['MCR-2026-0001', contract],
      '42501',
    );
    await rejected(
      api,
      'UPDATE contract_number_counters SET last_value=1',
      [],
      '42501',
    );
    await rejected(api, 'SET ROLE mcr', [], '42501');
  });
  test('blocks UPDATE, DELETE and TRUNCATE for evidence as API, including owner guards', async () => {
    const evidence = [
      ['condition_baselines', baseline],
      ['photos', photo],
      ['signatures', signature],
      ['contract_documents', preview],
      ['audit_events', audit],
      ['contract_revisions', signedRevision],
      ['inspections', completedInspection],
      ['stored_signatures', stored],
    ];
    for (const [table, id] of evidence) {
      const code = ['contract_revisions', 'inspections'].includes(table!)
        ? '55000'
        : '42501';
      await rejected(
        api,
        `UPDATE ${table} SET created_at=now() WHERE id=$1`,
        [id],
        ['contract_revisions', 'inspections'].includes(table!) ? '42501' : code,
      );
      if (table === 'contract_revisions')
        await rejected(
          api,
          "UPDATE contract_revisions SET pickup_place='Synthetic' WHERE id=$1",
          [id],
          '55000',
        );
      if (table === 'inspections')
        await rejected(
          api,
          "UPDATE inspections SET comment='Synthetic' WHERE id=$1",
          [id],
          '55000',
        );
      await rejected(api, `DELETE FROM ${table} WHERE id=$1`, [id], '42501');
      await rejected(api, `TRUNCATE ${table} CASCADE`, [], '42501');
      if (table !== 'stored_signatures') {
        await rejected(
          owner,
          `UPDATE ${table} SET created_at=now() WHERE id=$1`,
          [id],
          '55000',
        );
        await rejected(
          owner,
          `DELETE FROM ${table} WHERE id=$1`,
          [id],
          '55000',
        );
      }
    }
    const amendment = randomUUID();
    await owner.query(
      "INSERT INTO contract_revisions(id,created_by,contract_id,revision_no,kind,reason) VALUES ($1,$2,$3,3,'amendment','Synthetic extension')",
      [amendment, actor, contract],
    );
    await rejected(
      api,
      "UPDATE contract_revisions SET pickup_place='Synthetic' WHERE id=$1",
      [amendment],
      '55000',
    );
    await api.query(
      "UPDATE contract_revisions SET pickup_place='Synthetic desk' WHERE id=$1",
      [revision],
    );
    await api.query(
      "UPDATE inspections SET comment='Synthetic editable return' WHERE id=$1",
      [inspection],
    );
    await rejected(
      api,
      "UPDATE damages SET estimate_amount=10,estimate_mode='billed' WHERE id=$1",
      [damage],
      '42501',
    );
    await rejected(
      api,
      "UPDATE stored_signatures SET image_path='synthetic/overwrite' WHERE id=$1",
      [stored],
      '42501',
    );
  });
});

describe('contract numbers on independent connections', () => {
  test('concurrent reservations differ, same-contract retries agree and confirmation does not activate', async () => {
    const a = await newContract();
    const b = await newContract();
    const connections = Array.from(
      { length: 8 },
      () => new pg.Client({ connectionString: process.env.DATABASE_URL }),
    );
    try {
      await Promise.all(connections.map((db) => db.connect()));
      const results = await Promise.all(
        connections.map((db, index) =>
          db.query('SELECT reserve_contract_number($1,2026,$2) AS number', [
            index % 2 ? a : b,
            actor,
          ]),
        ),
      );
      const numbers = results.map((r) => r.rows[0].number as string);
      expect(new Set(numbers).size).toBe(2);
      numbers.forEach((n) => expect(n).toMatch(/^MCR-2026-\d{4}$/));
      const number = numbers[1]!;
      for (let i = 0; i < 2; i++)
        expect(
          (
            await api.query('SELECT confirm_contract_number($1,$2) AS number', [
              a,
              number,
            ])
          ).rows[0].number,
        ).toBe(number);
      expect(
        (await api.query('SELECT status FROM contracts WHERE id=$1', [a]))
          .rows[0].status,
      ).toBe('draft');
      await rejected(
        api,
        'SELECT confirm_contract_number($1,$2)',
        [b, number],
        '22023',
      );
      await rejected(
        api,
        'SELECT confirm_contract_number($1,$2)',
        [await newContract(), number],
        '22023',
      );
      await rejected(
        api,
        'SELECT reserve_contract_number($1,2026,$2)',
        [randomUUID(), actor],
        '22023',
      );
      await rejected(
        api,
        'SELECT reserve_contract_number($1,0,$2)',
        [a, actor],
        '22023',
      );
    } finally {
      await Promise.all(connections.map((db) => db.end()));
    }
  });
  test('rollbacks consume no number, year counters are independent and assignment failures roll back', async () => {
    const a = await newContract();
    const b = await newContract();
    await api.query('BEGIN');
    const rolledBack = (
      await api.query('SELECT reserve_contract_number($1,2027,$2) AS number', [
        a,
        actor,
      ])
    ).rows[0].number;
    await api.query('ROLLBACK');
    expect(
      (
        await api.query(
          'SELECT reserve_contract_number($1,2027,$2) AS number',
          [b, actor],
        )
      ).rows[0].number,
    ).toBe(rolledBack);
    const number = (
      await api.query('SELECT reserve_contract_number($1,2028,$2) AS number', [
        a,
        actor,
      ])
    ).rows[0].number;
    expect(number).toMatch(/^MCR-2028-\d{4}$/);
    await rejected(
      api,
      'SELECT reserve_contract_number($1,2029,$2)',
      [await newContract(), randomUUID()],
      '22023',
    );
    const exhausted = await newContract();
    await owner.query(
      'INSERT INTO contract_number_counters(created_by,year,last_value) VALUES ($1,9999,9999) ON CONFLICT(year) DO UPDATE SET last_value=9999',
      [actor],
    );
    await rejected(
      api,
      'SELECT reserve_contract_number($1,9999,$2)',
      [exhausted, actor],
      '23514',
    );
    expect(
      (await api.query('SELECT number FROM contracts WHERE id=$1', [exhausted]))
        .rows[0].number,
    ).toBeNull();
    expect(
      (
        await owner.query(
          'SELECT last_value FROM contract_number_counters WHERE year=9999',
        )
      ).rows[0].last_value,
    ).toBe(9999);
  });
});
