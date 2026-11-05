// Acceptance criteria of US-002 (ticket #3): checks the repository's own setup.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const packages = [
  'app',
  'api',
  'packages/shared',
  'db',
  'deploy',
  'scripts',
  'spikes/documenso',
];

const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readJson = (path: string) => JSON.parse(read(path));
// Docs wrap lines freely, so wording is matched on collapsed whitespace.
const readProse = (path: string) => read(path).replace(/\s+/g, ' ');

function isIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--no-index', '--quiet', path], {
      cwd: root,
    });
    return true;
  } catch (error) {
    // git check-ignore exits 1 for "not ignored"; anything else is a real error.
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

describe('workspace layout', () => {
  test('registers exactly the required packages', () => {
    const entries = read('pnpm-workspace.yaml')
      .split('\n')
      .flatMap((line) => line.match(/^\s*-\s*(\S+)/)?.[1] ?? []);
    expect(entries.sort()).toEqual([...packages].sort());
  });

  test('keeps docs/ as a plain folder, outside the workspace', () => {
    expect(existsSync(join(root, 'docs/README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/package.json'))).toBe(false);
  });

  describe.each(packages)('%s', (pkg) => {
    test('has a README', () => {
      const lines = read(`${pkg}/README.md`).trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    test('runs typecheck, ESLint, Prettier and tests', () => {
      const { scripts } = readJson(`${pkg}/package.json`);
      expect(scripts.typecheck).toMatch(/\btsc\b/);
      expect(scripts.lint).toMatch(/\beslint\b/);
      expect(scripts.lint).toMatch(/\bprettier --check\b/);
      expect(scripts.test).toMatch(/\bvitest run\b/);
    });

    test('extends the strict root TypeScript configuration', () => {
      const config = readJson(`${pkg}/tsconfig.json`);
      expect(join(pkg, config.extends)).toBe('tsconfig.base.json');
      expect(config.compilerOptions?.strict).not.toBe(false);
    });

    test('uses the root ESLint and Prettier configuration', () => {
      const files = readdirSync(join(root, pkg));
      expect(files.filter((f) => /eslint|prettier/.test(f))).toEqual([]);
    });

    test('has at least one test', () => {
      const hasTest = (directory: string): boolean =>
        readdirSync(directory, { withFileTypes: true }).some((entry) =>
          entry.isFile()
            ? entry.name.endsWith('.test.ts')
            : entry.isDirectory() &&
              !['node_modules', 'dist', 'coverage'].includes(entry.name) &&
              hasTest(join(directory, entry.name)),
        );
      expect(hasTest(join(root, pkg))).toBe(true);
    });
  });
});

describe('root tooling', () => {
  test('turns on TypeScript strict mode', () => {
    expect(readJson('tsconfig.base.json').compilerOptions.strict).toBe(true);
  });

  test('configures ESLint and Prettier', () => {
    expect(existsSync(join(root, 'eslint.config.mjs'))).toBe(true);
    expect(existsSync(join(root, '.prettierrc.json'))).toBe(true);
  });

  test('pnpm check chains typecheck, lint and tests for every package', () => {
    const { scripts } = readJson('package.json');
    expect(scripts.check).toBe('pnpm typecheck && pnpm lint && pnpm test');
    expect(scripts.typecheck).toBe('pnpm -r typecheck');
    expect(scripts.lint).toContain('pnpm -r lint');
    expect(scripts.test).toBe('pnpm -r test');
  });
});

describe('CI workflow', () => {
  const workflow = read('.github/workflows/ci.yml');

  test('runs on every pull request and on pushes to main', () => {
    // A bare "pull_request:" has no branch filter, so it covers every PR.
    expect(workflow).toMatch(/^ {2}pull_request:\s*$\n(?! {4})/m);
    expect(workflow).toMatch(/^ {2}push:\s*\n {4}branches: \[main\]\s*$/m);
  });

  test('caches the pnpm store', () => {
    expect(workflow).toMatch(/uses: pnpm\/action-setup@/);
    expect(workflow).toMatch(/uses: actions\/setup-node@/);
    expect(workflow).toMatch(/^\s*cache: pnpm\s*$/m);
    // setup-node needs pnpm on the PATH to find the store it caches.
    expect(workflow.indexOf('pnpm/action-setup')).toBeLessThan(
      workflow.indexOf('actions/setup-node'),
    );
  });

  test('installs from the lockfile, then runs pnpm check', () => {
    const install = workflow.indexOf('run: pnpm install --frozen-lockfile');
    expect(install).toBeGreaterThan(-1);
    expect(workflow.indexOf('run: pnpm check')).toBeGreaterThan(install);
    expect(existsSync(join(root, 'pnpm-lock.yaml'))).toBe(true);
  });
});

describe('ignore rules', () => {
  test.each([
    '.env',
    '.env.local',
    '.env.production',
    'api/.env',
    'api/.env.test',
    'dist/index.js',
    'api/dist/index.js',
    'app/build/index.js',
    'scan-of-contract.scan.pdf',
    'docs/nested/contract.scan.pdf',
    'scans/contract.pdf',
    'db/scans/contract.pdf',
  ])('ignores %s', (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  test.each(['.env.example', 'api/src/index.ts', 'docs/README.md'])(
    'keeps %s',
    (path) => {
      expect(isIgnored(path)).toBe(false);
    },
  );

  test('.env.example documents named variables and every Compose input', () => {
    const lines = read('.env.example').trim().split('\n');
    const names = new Set<string>();
    for (const [index, line] of lines.entries()) {
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Z][A-Z0-9_]*)=.+$/);
      expect(
        match,
        `Invalid configuration entry at line ${index + 1}`,
      ).not.toBeNull();
      expect(lines[index - 1]?.startsWith('#')).toBe(true);
      names.add(match![1]!);
    }
    expect(names.size).toBeGreaterThan(0);
    const compose = read('deploy/compose.local.yml');
    for (const match of compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)) {
      expect(names.has(match[1]!)).toBe(true);
    }
  });
});

test('the pull-request template asks for story, ADRs and testing', () => {
  const template = read('.github/pull_request_template.md');
  expect(template).toMatch(/story id/i);
  expect(template).toMatch(/\bADRs\b/);
  expect(template).toMatch(/^## Testing/m);
});

describe('agent guidance', () => {
  test('CLAUDE.md points to AGENTS.md', () => {
    expect(read('CLAUDE.md')).toContain('(AGENTS.md)');
  });

  test.each([
    ['start from the docs', /start from \[?docs\/README\.md/i],
    ['follow the ADRs', /follow the \[?ADRs/i],
    ['no real customer data', /never use real customer data/i],
    ['no secrets', /never commit secrets/i],
    ['how to run the checks', /pnpm install\s+pnpm check/],
    ['one story or goal per PR', /one story or goal per pull request/i],
    [
      'ask before changing an ADR',
      /never change an accepted ADR without asking/i,
    ],
  ])('AGENTS.md says: %s', (_rule, wording) => {
    expect(readProse('AGENTS.md')).toMatch(wording);
  });
});

test.each([
  /^## Unit tests/m,
  /^## Database tests/m,
  /^## API tests/m,
  /^## Contract PDF tests with Chromium/m,
  /^## End-to-end tests in a headless browser/m,
  /^## Real-iPhone checklist/m,
])('docs/testing.md has a section matching %s', (heading) => {
  expect(read('docs/testing.md')).toMatch(heading);
});
