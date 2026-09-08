/* tslint:disable */
import { AuditLogEntryAction } from './audit-log-entry-action';
import { AuditLogEntryChange } from './audit-log-entry-change';

/**
 * AuditLogEntry is an immutable record of a single change to a resource.
 * One entry is created per mutating API call: an update that changes multiple
 * fields at once results in a single entry containing the per-field diff.
 * Entries are append-only and can never be modified or deleted.
 */
export interface V1AuditLogEntry {

  /**
   * The kind of change that was recorded.
   */
  action?: AuditLogEntryAction;
  actor?: string;

  /**
   * The per-field changes recorded by this entry.
   */
  changes?: Array<AuditLogEntryChange>;
  name?: string;
  organization?: string;
  resource?: string;

  /**
   * The time at which the change was recorded.
   */
  timestamp?: string;

  /**
   * The UUID of the audit log entry.
   */
  uid?: string;
}
