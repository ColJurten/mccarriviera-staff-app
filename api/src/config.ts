import { z } from 'zod';

const httpsOriginSchema = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      value.startsWith('https://') &&
      new URL(value).origin === value,
  );

const configSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (url) =>
        URL.canParse(url) &&
        ['postgres:', 'postgresql:'].includes(new URL(url).protocol),
    ),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_HEALTH_BUCKET: z.string().min(1),
  AUTH_SECRET: z
    .string()
    .min(32)
    .refine((value) => !value.startsWith('fake-')),
  AUTH_BASE_URL: httpsOriginSchema,
  AUTH_TRUSTED_ORIGINS: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(httpsOriginSchema).min(1)),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HEALTH_TIMEOUT_MS: z.coerce.number().int().min(50).max(10000).default(1500),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = configSchema.safeParse(env);
  // Zod errors can contain input values: never propagate them to startup logs.
  if (!parsed.success) throw new Error('Invalid API configuration');
  return parsed.data;
}
export type Config = ReturnType<typeof readConfig>;
