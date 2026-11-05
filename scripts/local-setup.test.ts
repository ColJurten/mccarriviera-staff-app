import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
it('creates protected local secrets outside the checkout without printing them, verifies its p12 and refuses replacement', () => {
  const directory = mkdtempSync(join(homedir(), '.mcr-secret-test-'));
  const env = { ...process.env, LOCAL_SECRETS_DIR: directory };
  const run = (script: string, args: string[] = []) =>
    execFileSync('bash', [script, ...args], {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 20000,
    });
  try {
    const output = run('scripts/local-secrets.sh');
    const configuration = readFileSync(join(directory, 'local.env'), 'utf8');
    const passphrase = readFileSync(
      join(directory, 'signing-passphrase'),
      'utf8',
    ).trim();
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    for (const name of ['local.env', 'signing-passphrase'])
      expect(statSync(join(directory, name)).mode & 0o777).toBe(0o600);
    expect(statSync(join(directory, 'cert.p12')).mode & 0o777).toBe(0o644);
    expect(output.includes(passphrase)).toBe(false);
    expect(
      configuration.includes(`NEXT_PRIVATE_SIGNING_PASSPHRASE=${passphrase}`),
    ).toBe(true);
    for (const entry of configuration.split('\n')) {
      const [name, value] = entry.split('=');
      if (
        name?.includes('PASSWORD') ||
        name?.includes('SECRET') ||
        name?.includes('ENCRYPTION_KEY')
      ) {
        expect(output.includes(value!)).toBe(false);
      }
    }
    expect(run('scripts/local-signing-certificate.sh', ['--check'])).toContain(
      'passphrase verified',
    );
    const repeated = spawnSync('bash', ['scripts/local-secrets.sh'], {
      cwd: root,
      env,
      timeout: 20000,
    });
    expect(repeated.status).not.toBe(0);
    expect(
      readFileSync(join(directory, 'local.env'), 'utf8') === configuration,
    ).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);

it('rejects an in-checkout secret directory before writing anything', () => {
  const directory = join(root, 'synthetic-rejected-secrets');
  for (const script of [
    'scripts/local-secrets.sh',
    'scripts/local-signing-certificate.sh',
  ]) {
    const result = spawnSync('bash', [script], {
      cwd: root,
      env: { ...process.env, LOCAL_SECRETS_DIR: directory },
      timeout: 10000,
    });
    expect(result.status).not.toBe(0);
    expect(existsSync(directory)).toBe(false);
  }
});
