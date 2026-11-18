import { sql } from 'kysely';
import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/db.js';
import { createStorage } from '../src/storage.js';
import { readConfig } from '../src/config.js';
import {
  HeadBucketCommand,
  ListBucketsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

it('probes migrated PostgreSQL 17 and private Garage buckets with real drivers', async () => {
  // Required configuration: this suite fails rather than silently skipping services.
  const config = readConfig();
  const database = createDatabase(
    config.DATABASE_URL,
    config.HEALTH_TIMEOUT_MS,
  );
  const storage = createStorage(config);
  const { app } = await buildApp({
    database: database.probe,
    storage: storage.probe,
    timeoutMs: config.HEALTH_TIMEOUT_MS,
  });
  const wrongKey = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'GK000000000000000000000000',
      secretAccessKey: 'synthetic-invalid-key',
    },
    maxAttempts: 1,
  });
  try {
    const result = await app.inject('/api/health');
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ database: 'ok', storage: 'ok' });
    const version = await sql<{
      server_version: string;
    }>`show server_version`.execute(database.db);
    expect(version.rows[0]?.server_version).toMatch(/^17\./);
    const vehicles = await database.db
      .selectFrom('vehicles')
      .select('id')
      .execute();
    expect(vehicles).toBeInstanceOf(Array);
    const apiKey = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      maxAttempts: 1,
    });
    try {
      const buckets = [
        'condition-photos',
        'client-documents',
        'signatures',
        'contract-pdfs',
      ];
      const inventory = await apiKey.send(new ListBucketsCommand({}), {
        abortSignal: AbortSignal.timeout(3000),
      });
      expect(inventory.Buckets?.map((bucket) => bucket.Name).sort()).toEqual(
        [...buckets].sort(),
      );
      for (const bucket of buckets) {
        await apiKey.send(new HeadBucketCommand({ Bucket: bucket }), {
          abortSignal: AbortSignal.timeout(3000),
        });
        await expect(
          wrongKey.send(new HeadBucketCommand({ Bucket: bucket }), {
            abortSignal: AbortSignal.timeout(3000),
          }),
        ).rejects.toThrow();
        const anonymous = await fetch(`${config.S3_ENDPOINT}/${bucket}`, {
          signal: AbortSignal.timeout(3000),
        });
        expect(anonymous.status).toBe(403);
      }
    } finally {
      apiKey.destroy();
    }
  } finally {
    wrongKey.destroy();
    await app.close();
    await database.close();
    storage.close();
  }
});
