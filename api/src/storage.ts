import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { Config } from './config.js';

export function createStorage(config: Config) {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    maxAttempts: 1,
  });
  return {
    probe: async (signal: AbortSignal) => {
      await client.send(
        new HeadBucketCommand({ Bucket: config.S3_HEALTH_BUCKET }),
        { abortSignal: signal },
      );
    },
    close: () => client.destroy(),
  };
}
