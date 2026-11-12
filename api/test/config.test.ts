import { expect, it } from 'vitest';
import { readConfig } from '../src/config.js';
import { randomBytes } from 'node:crypto';
it('rejects invalid configuration with no input values in the error', () => {
  expect(() =>
    readConfig({ DATABASE_URL: 'synthetic-private-invalid-url' }),
  ).toThrow(/^Invalid API configuration$/);
});
it('requires a server secret and exact HTTPS auth origins', () => {
  const env = {
    DATABASE_URL: 'postgresql://synthetic@localhost/synthetic',
    S3_ENDPOINT: 'http://localhost:3900',
    S3_REGION: 'garage',
    S3_ACCESS_KEY_ID: 'synthetic',
    S3_SECRET_ACCESS_KEY: 'synthetic',
    S3_HEALTH_BUCKET: 'synthetic',
    AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_BASE_URL: 'https://app.example.com',
    AUTH_TRUSTED_ORIGINS: 'https://app.example.com,https://staging.example.com',
  };
  expect(readConfig(env).AUTH_TRUSTED_ORIGINS).toEqual([
    'https://app.example.com',
    'https://staging.example.com',
  ]);
  expect(readConfig(env).TRUSTED_PROXY_IP).toBeUndefined();
  expect(
    readConfig({ ...env, TRUSTED_PROXY_IP: '' }).TRUSTED_PROXY_IP,
  ).toBeUndefined();
  for (const ip of ['192.0.2.10', '::1'])
    expect(readConfig({ ...env, TRUSTED_PROXY_IP: ip }).TRUSTED_PROXY_IP).toBe(
      ip,
    );
  for (const replacement of [
    ...[
      'true',
      '1',
      'caddy',
      '192.0.2.0/24',
      '192.0.2.1,192.0.2.2',
      ' 192.0.2.1',
      'fe80::1%eth0',
    ].map((TRUSTED_PROXY_IP) => ({ TRUSTED_PROXY_IP })),
    { AUTH_SECRET: '' },
    { AUTH_SECRET: 'fake-auth-secret-do-not-use' },
    { AUTH_BASE_URL: 'http://app.example.com' },
    { AUTH_TRUSTED_ORIGINS: 'https://app.example.com/path' },
    { AUTH_TRUSTED_ORIGINS: 'https://app.example.com/' },
    { AUTH_TRUSTED_ORIGINS: 'https://app.example.com,' },
  ])
    expect(() => readConfig({ ...env, ...replacement })).toThrow(
      /^Invalid API configuration$/,
    );
});
