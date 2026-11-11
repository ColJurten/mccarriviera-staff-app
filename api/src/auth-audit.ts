import type { Kysely } from 'kysely';
import type { DB } from './db/generated.js';

export interface AuthAuditEvent {
  action:
    | 'staff_created'
    | 'staff_deactivated'
    | 'staff_reactivated'
    | 'staff_password_reset'
    | 'staff_factor_reset';
  actorId: string;
  staffId: string;
}
export type AuthAuditHook = (
  event: AuthAuditEvent,
  transaction: Kysely<DB>,
) => Promise<void>;
// US-007 integration seam: replace this with the agreed transactional audit
// writer once its event/actor contract exists. No event is persisted yet.
// Never add emails, passwords, tokens, factor secrets or codes to this payload.
export const pendingAuthAudit: AuthAuditHook = async () => {};
