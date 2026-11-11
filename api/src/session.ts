import { sql, type Kysely } from 'kysely';
import type { StaffSession } from '@mccarriviera/shared';
import type { DB } from './db/generated.js';

export interface SessionIdentity extends StaffSession {
  sessionId: string;
  userId: string;
}
export async function resolveToken(
  db: Kysely<DB>,
  token: string,
  mode: 'native' | 'web',
): Promise<SessionIdentity | null> {
  // One conditional UPDATE both resolves and renews; concurrent revocation
  // cannot resurrect a deleted session. No cookie/JWT cache is consulted.
  const result = await sql<{
    id: string;
    user_id: string;
    staff_id: string;
    display_name: string;
    expires_at: Date;
  }>`UPDATE auth_sessions s SET updated_at = clock_timestamp(), expires_at =
      CASE WHEN s.mode = 'native' THEN clock_timestamp() + interval '30 days'
      ELSE LEAST(clock_timestamp() + interval '30 minutes', s.authenticated_at + interval '12 hours') END
    FROM staff_profiles p WHERE s.token = ${token} AND s.mode = ${mode}
      AND p.auth_user_id = s.user_id::text AND p.active
      AND s.expires_at > clock_timestamp()
      AND (s.mode = 'native' OR s.authenticated_at + interval '12 hours' > clock_timestamp())
    RETURNING s.id, s.user_id, p.id AS staff_id, p.display_name, s.expires_at`.execute(
    db,
  );
  const row = result.rows[0];
  return row
    ? {
        sessionId: row.id,
        userId: row.user_id,
        staffId: row.staff_id,
        displayName: row.display_name,
        mode,
        expiresAt: row.expires_at.toISOString(),
      }
    : null;
}
export function publicSession(identity: SessionIdentity): StaffSession {
  return {
    staffId: identity.staffId,
    displayName: identity.displayName,
    mode: identity.mode,
    expiresAt: identity.expiresAt,
  };
}
