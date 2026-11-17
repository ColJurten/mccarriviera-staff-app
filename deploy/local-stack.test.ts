import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compose = read('deploy/compose.local.yml');
const workflow = read('.github/workflows/ci.yml');

/** The text of one top-level Compose service, up to the next service. */
function service(name: string) {
  const match = compose.match(
    new RegExp(`^  ${name}:\\n((?:    .*\\n|      .*\\n|\\n)+)`, 'm'),
  );
  if (!match) throw new Error(`Missing service ${name}`);
  return match[1]!;
}

describe('compose.local.yml (US-004, ADR-0019, ADR-0022, ADR-0023)', () => {
  test('contains only the local API dependencies and their data volumes', () => {
    const [services, volumes] = compose.split('\nvolumes:\n');
    expect(
      [...services!.matchAll(/^ {2}([\w-]+):$/gm)].map((m) => m[1]),
    ).toEqual(['postgres', 'garage', 'garage-init', 'mailpit', 'api']);
    expect(
      [...volumes!.matchAll(/^ {2}([\w-]+):$/gm)].map((m) => m[1]),
    ).toEqual(['postgres', 'garage']);
    expect(compose).not.toMatch(/cert\.p12|signing-passphrase/);
    expect(readdirSync(new URL('./postgres', import.meta.url))).toEqual([
      'init.sh',
    ]);
  });

  test.each([
    ['postgres', /^ {4}image: postgres:17\.\d+-bookworm$/m],
    ['garage', /^ {4}image: dxflrs\/garage:v\d+\.\d+\.\d+$/m],
    ['mailpit', /^ {4}image: axllent\/mailpit:v\d+\.\d+\.\d+$/m],
  ])('pins %s to an exact version', (name, image) => {
    expect(service(name)).toMatch(image);
  });

  test('builds the API and Garage initializer from exact base images', () => {
    expect(service('api')).toContain('dockerfile: api/Dockerfile');
    expect(read('api/Dockerfile')).toMatch(
      /^FROM node:\d+\.\d+\.\d+-bookworm-slim$/m,
    );
    const garage = read('deploy/garage/Dockerfile');
    expect(garage).toContain(service('garage').match(/image: (.+)/)![1]!);
    expect(garage).toMatch(/^FROM alpine:\d+\.\d+\.\d+$/m);
  });

  test('never uses a floating latest tag', () => {
    expect(compose).not.toMatch(/:latest\b/);
  });

  test('publishes every port on loopback only', () => {
    const ports = [...compose.matchAll(/ports: \[(.+)\]/g)].flatMap((match) =>
      match[1]!.split(','),
    );
    expect(ports.map((port) => port.trim()).sort()).toEqual([
      "'127.0.0.1:1025:1025'",
      "'127.0.0.1:3001:3001'",
      "'127.0.0.1:3900:3900'",
      "'127.0.0.1:5432:5432'",
      "'127.0.0.1:8025:8025'",
    ]);
    for (const port of ports) expect(port.trim()).toMatch(/^'127\.0\.0\.1:/);
  });

  test('creates only the app database with separate owner and restricted runtime roles', () => {
    const init = read('deploy/postgres/init.sh');
    expect(service('postgres')).toContain('./postgres/init.sh:');
    expect(
      [...init.matchAll(/^CREATE DATABASE (.+);$/gm)].map((m) => m[1]),
    ).toEqual(['mcr OWNER mcr']);
    expect(
      [...init.matchAll(/^CREATE ROLE (\w+) /gm)].map((m) => m[1]),
    ).toEqual(['mcr', 'mcr_api', 'mcr_runtime']);
    expect(init).toContain("CREATE ROLE mcr LOGIN PASSWORD :'mcr_password';");
    expect(init).toContain('REVOKE ALL ON DATABASE mcr FROM PUBLIC;');
    expect(init).toContain('GRANT CONNECT ON DATABASE mcr TO mcr_api;');
    expect(init).toContain(
      'mcr_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
    );
    expect(init).toContain(
      'mcr_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
    );
    expect(service('api')).toContain('postgresql://mcr_runtime:');
    expect(init).toContain('GRANT mcr_api TO mcr_runtime');
    expect(init).not.toContain('GRANT mcr TO mcr_runtime');
    expect(service('api')).toContain('@postgres:5432/mcr');
    expect(read('.env.example')).toMatch(
      /^DATABASE_URL=postgresql:\/\/mcr_runtime:.*\/mcr\?sslmode=disable$/m,
    );
  });

  test('waits for PostgreSQL TCP readiness after the temporary init server exits', () => {
    expect(service('postgres')).toContain(
      'pg_isready -h 127.0.0.1 -U postgres -d postgres',
    );
  });

  test('creates only the four local app buckets and grants the API key access to each', () => {
    const init = read('deploy/garage/init.sh');
    const adr = read('docs/adr/0014-file-storage.md');
    const buckets = init.match(/for bucket in (.+); do/)![1]!.split(' ');
    const expected = [
      'condition-photos',
      'client-documents',
      'signatures',
      'contract-pdfs',
    ];
    expect(buckets).toEqual(expected);
    for (const bucket of expected) {
      expect(adr).toContain(`\`${bucket}\``);
    }
    expect(init).toContain(
      '  /garage bucket allow --read --write "$bucket" --key "$S3_ACCESS_KEY_ID"',
    );
    expect(init).toMatch(/key import "\$S3_ACCESS_KEY_ID"/);
    expect([...init.matchAll(/\/garage key import /g)]).toHaveLength(1);
    expect(service('garage-init')).toContain('./garage/init.sh:');
  });

  test('starts the API only once PostgreSQL is healthy and Garage initialized', () => {
    const api = service('api');
    expect(api).toContain('postgres: { condition: service_healthy }');
    expect(api).toContain(
      'garage-init: { condition: service_completed_successfully }',
    );
  });
});

describe('API image', () => {
  // pnpm writes pnpm-lock.yaml (and pnpm-workspace.yaml when it edits it) as
  // mode 600. COPY keeps the mode with root ownership, and pnpm refuses to
  // start when it cannot read pnpm-workspace.yaml, so a USER node container
  // must not depend on the modes in the developer's checkout.
  test('does not need host file modes for its non-root runtime', () => {
    const dockerfile = read('api/Dockerfile');
    const usesPnpmAtRuntime = /^CMD \["pnpm"/m.test(dockerfile);
    const normalizesModes = /--chmod=|\bchmod\b|--chown=|\bchown\b/.test(
      dockerfile,
    );
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(usesPnpmAtRuntime && !normalizesModes).toBe(false);
  });
});

describe('CI (ADR-0016, ADR-0022)', () => {
  const up = workflow.match(/docker compose .* up .*/)![0];

  test('runs migrations, type drift and API tests against disposable PostgreSQL 17', () => {
    expect(up).toMatch(/\bpostgres\b/);
    expect(workflow).toContain('pnpm db:migrate');
    expect(workflow).toContain('pnpm db:check');
    expect(workflow).toContain(
      'pnpm --filter @mccarriviera/api test:integration',
    );
    expect(workflow).toMatch(/if: always\(\)[\s\S]*down -v/);
  });

  test('finishes Garage initialization successfully before integration tests', () => {
    const initialization = workflow.match(
      /docker compose .* run --build --rm --no-deps garage-init/,
    );
    expect(initialization).not.toBeNull();
    expect(initialization![0]).not.toMatch(/--detach|\s-d(?:\s|$)/);
    expect(workflow.indexOf(initialization![0])).toBeGreaterThan(
      workflow.indexOf(up),
    );
    expect(workflow.indexOf(initialization![0])).toBeLessThan(
      workflow.indexOf('pnpm db:migrate'),
    );
  });

  // `up --wait` treats a selected service as finished-successfully only if
  // another *selected* service depends on it that way. Otherwise a one-shot is
  // "ready" while running and a failure once it has exited, so the step either
  // fails with `container ... exited (0)` or continues before buckets exist.
  test('never waits on the one-shot Garage initializer without its dependent', () => {
    const waited = up.includes('--wait')
      ? up.slice(up.indexOf('--wait') + '--wait'.length).trim()
      : '';
    const selected = waited.split(/\s+/).filter(Boolean);
    if (selected.includes('garage-init')) {
      expect(selected).toContain('api');
    }
  });
});

describe('migrations (dbmate, ADR-0019)', () => {
  test('keeps the initial migration and adds the core schema', () => {
    const migrations = readdirSync(
      new URL('../db/migrations', import.meta.url),
    );
    expect(migrations).toContain('20261105000000_initial.sql');
    expect(migrations).toContain('20261110000000_core_schema.sql');
    const scripts = JSON.parse(read('package.json')).scripts;
    for (const name of ['db:migrate', 'db:generate', 'db:check']) {
      expect(scripts).toHaveProperty([name]);
    }
  });
});

describe('deploy/README.md', () => {
  const readme = read('deploy/README.md');

  test.each([
    ['start', 'up -d --build --wait'],
    ['stop', '-f deploy/compose.local.yml stop'],
    ['reset', 'down -v'],
    ['API URL', 'http://localhost:3001/api/health'],
    ['Mailpit URL', 'http://localhost:8025'],
    ['certificate check', 'bash scripts/local-signing-certificate.sh --check'],
  ])('explains %s', (_label, text) => {
    expect(readme).toContain(text);
  });

  test('marks the reset as destructive', () => {
    expect(readme).toMatch(/DESTRUCTIVE.*\n.*down -v/);
  });
});

describe('.env.example', () => {
  const example = read('.env.example');
  const lines = example.split('\n');
  const documented = new Set(
    lines.flatMap((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1] ?? []),
  );

  test('lists only the remaining local configuration', () => {
    expect([...documented].sort()).toEqual([
      'API_PORT',
      'AUTH_BASE_URL',
      'AUTH_SECRET',
      'AUTH_TRUSTED_ORIGINS',
      'DATABASE_URL',
      'GARAGE_RPC_SECRET',
      'HEALTH_TIMEOUT_MS',
      'LOCAL_SECRETS_DIR',
      'MCR_API_DB_PASSWORD',
      'MCR_DB_PASSWORD',
      'MIGRATION_DATABASE_URL',
      'POSTGRES_PASSWORD',
      'POSTGRES_USER',
      'S3_ACCESS_KEY_ID',
      'S3_ENDPOINT',
      'S3_HEALTH_BUCKET',
      'S3_REGION',
      'S3_SECRET_ACCESS_KEY',
      'TRUSTED_PROXY_IP',
    ]);
  });

  test.each([
    ['the API configuration', 'api/src/config.ts', /^ {2}([A-Z][A-Z0-9_]*):/gm],
    [
      'Compose service environments',
      'deploy/compose.local.yml',
      /^ {6}([A-Z][A-Z0-9_]*):/gm,
    ],
    [
      'generated local configuration',
      'scripts/local-secrets.sh',
      /^([A-Z][A-Z0-9_]*)=/gm,
    ],
  ])('documents every variable of %s', (_label, path, pattern) => {
    const names = [...read(path).matchAll(pattern)].map((match) => match[1]!);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !documented.has(name))).toEqual([]);
  });

  test('holds only inert values for every secret', () => {
    for (const line of lines) {
      const match = line.match(
        /^(?!LOCAL_SECRETS_DIR=)[A-Z_]*(?:PASSWORD|SECRET|PASSPHRASE|ENCRYPTION[A-Z_]*KEY)[A-Z_]*=(.*)$/,
      );
      if (match) expect(match[1]).toMatch(/fake|^0+$/);
    }
  });
});
