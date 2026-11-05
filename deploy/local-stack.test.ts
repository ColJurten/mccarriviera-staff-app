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

describe('compose.local.yml (US-004, ADR-0019, ADR-0020, ADR-0022)', () => {
  test.each([
    ['postgres', /^ {4}image: postgres:17\.\d+-bookworm$/m],
    ['garage', /^ {4}image: dxflrs\/garage:v\d+\.\d+\.\d+$/m],
    ['mailpit', /^ {4}image: axllent\/mailpit:v\d+\.\d+\.\d+$/m],
    ['documenso', /^ {4}image: documenso\/documenso:v\d+\.\d+\.\d+$/m],
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
    expect(ports.length).toBeGreaterThanOrEqual(6);
    for (const port of ports) expect(port.trim()).toMatch(/^'127\.0\.0\.1:/);
  });

  test('creates two databases, each owned by its own user', () => {
    const init = read('deploy/postgres/init.sh');
    expect(service('postgres')).toContain('./postgres/init.sh:');
    for (const name of ['mcr', 'documenso']) {
      expect(init).toContain(`CREATE ROLE ${name} LOGIN PASSWORD`);
      expect(init).toContain(`CREATE DATABASE ${name} OWNER ${name};`);
      expect(init).toContain(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC;`);
    }
    expect(service('api')).toContain('postgresql://mcr:');
    expect(service('api')).toContain('@postgres:5432/mcr');
    expect(read('.env.example')).toMatch(
      /^DOCUMENSO_DATABASE_URL=postgresql:\/\/documenso:.*\/documenso$/m,
    );
    expect(service('documenso')).not.toContain('mcr:');
  });

  test('waits for PostgreSQL TCP readiness after the temporary init server exits', () => {
    expect(service('postgres')).toContain(
      'pg_isready -h 127.0.0.1 -U postgres -d postgres',
    );
  });

  test('creates the ADR-0014 buckets and grants the API key none of Documenso', () => {
    const init = read('deploy/garage/init.sh');
    const adr = read('docs/adr/0014-file-storage.md');
    const buckets = init.match(/for bucket in (.+); do/)![1]!.split(' ');
    for (const bucket of [
      'condition-photos',
      'client-documents',
      'signatures',
      'contract-pdfs',
    ]) {
      expect(adr).toContain(`\`${bucket}\``);
      expect(buckets).toContain(bucket);
    }
    expect(buckets).toContain('documenso');
    expect(init).toContain('if [ "$bucket" != documenso ]; then');
    expect(init).toMatch(/key import "\$S3_ACCESS_KEY_ID"/);
    expect(service('garage-init')).toContain('./garage/init.sh:');
  });

  test('configures Documenso as specified, with sign-up disabled', () => {
    const documenso = service('documenso');
    expect(documenso).toContain("NEXT_PUBLIC_DISABLE_SIGNUP: 'true'");
    expect(documenso).toContain('NEXT_PUBLIC_UPLOAD_TRANSPORT: database');
    expect(documenso).toContain('NEXT_PRIVATE_SMTP_HOST: mailpit');
    expect(documenso).toContain("NEXT_PRIVATE_SMTP_PORT: '1025'");
    expect(documenso).toContain('NEXT_PRIVATE_SIGNING_TRANSPORT: local');
    expect(documenso).toContain('/cert.p12');
    expect(documenso).toContain('read_only: true');
    expect(documenso).not.toMatch(/^ {4}build:/m);
    // ADR-0020: a local stack has no Documenso API token or webhook (US-043).
    expect(documenso).not.toMatch(/WEBHOOK|API_TOKEN/);
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
  test('starts with one empty migration and exposes the commands', () => {
    const migrations = readdirSync(
      new URL('../db/migrations', import.meta.url),
    );
    expect(migrations).toHaveLength(1);
    const statements = read(`db/migrations/${migrations[0]}`)
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('--'));
    expect(statements).toEqual([]);
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
    ['Documenso URL', 'http://localhost:3000'],
    ['certificate status', '/api/certificate-status'],
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
