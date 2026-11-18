import { sql, type Transaction } from 'kysely';
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
  transaction: Transaction<DB>,
) => Promise<void>;
// The SQL writer allowlists actions and constructs an ID-only payload. Use the
// command transaction so an audit failure rolls back credentials/revocations too.
export const pendingAuthAudit: AuthAuditHook = async (event, transaction) => {
  await sql`select write_staff_audit(${event.action}, ${event.actorId}::uuid, ${event.staffId}::uuid)`.execute(
    transaction,
  );
};
