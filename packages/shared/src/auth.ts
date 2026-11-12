import { z } from 'zod';

export const passwordSchema = z.string().min(12).max(128);
export const signInSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export const enrollmentSchema = z.strictObject({ password: passwordSchema });
export const factorSchema = z.strictObject({
  kind: z.enum(['totp', 'backup']),
  code: z.string().min(1).max(64),
});
export const emptyAuthSchema = z.strictObject({});
export const staffSessionSchema = z.strictObject({
  staffId: z.uuid(),
  displayName: z.string().min(1).max(80),
  mode: z.enum(['native', 'web']),
  expiresAt: z.iso.datetime(),
});
export const nativeVerifyResponseSchema = z.strictObject({
  token: z.string(),
  session: staffSessionSchema,
});
export const webSignInResponseSchema = z.strictObject({
  next: z.enum(['enrollment', 'challenge']),
});
export const nativeSignInResponseSchema = webSignInResponseSchema.extend({
  flowToken: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
});
export const nativeEnrollmentSchema = enrollmentSchema.extend({
  flowToken: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
});
export const nativeFactorSchema = factorSchema.extend({
  flowToken: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
});
export const enrollmentResponseSchema = z.strictObject({
  totpURI: z.string(),
  backupCodes: z.array(z.string()),
});
export const signOutResponseSchema = z.strictObject({
  success: z.literal(true),
});
export type StaffSession = z.infer<typeof staffSessionSchema>;
