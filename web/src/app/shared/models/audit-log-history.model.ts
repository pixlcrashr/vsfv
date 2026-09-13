/** Audit actions as stored by the backend (enum values without the ACTION_ prefix). */
export type AuditLogHistoryAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogHistoryChange {
  field: string;
  /** Value before the change; undefined means the field was absent. */
  oldValue?: string;
  /** Value after the change; undefined means the field was absent. */
  newValue?: string;
}

/**
 * A single audit log entry rendered by the audit log history component.
 * `resource` is the full resource name of the audited object and may be a
 * child of the entity whose history is being displayed (e.g. a budget
 * revision under its budget).
 */
export interface AuditLogHistoryEntry {
  id: string;
  resource: string;
  action: AuditLogHistoryAction;
  actorId?: string;
  /** Display name of the actor; undefined for system entries or deleted users. */
  actorName?: string;
  changes: AuditLogHistoryChange[];
  timestamp: Date;
}
