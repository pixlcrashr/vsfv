import { Observable } from 'rxjs';

/** Audit actions as stored by the backend (enum values without the ACTION_ prefix). */
export type AuditLogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE';

export interface AuditLogFieldChange {
  field: string;
  /** Value before the change; undefined means the field was absent. */
  oldValue?: string;
  /** Value after the change; undefined means the field was absent. */
  newValue?: string;
}

export interface AuditLogEntry {
  id: string;
  /** Resource name of the audit log entry itself (auditLogEntries/{id}). */
  name: string;
  /** Full resource name of the audited object. */
  resource: string;
  /** Resource name of the owning organization (empty for global resources). */
  organization: string;
  organizationId?: string;
  action: AuditLogAction;
  actor: string;
  actorId?: string;
  changes: AuditLogFieldChange[];
  timestamp: Date;
}

export interface AuditLogEntryFilters {
  action?: 'all' | AuditLogAction;
  resource?: string;
  actor?: string;
  afterDate?: string;
  beforeDate?: string;
  /** Organization scope of the listing; only applied by the global view. */
  organizationId?: string;
}

export abstract class AuditLogDataService {
  /**
   * Lists audit log entries. When {@link AuditLogEntryFilters.organizationId}
   * is set, only entries of that organization are returned; otherwise all
   * entries visible to the caller are returned.
   */
  abstract listEntries(
    pageSize: number,
    pageToken: string | undefined,
    filters?: AuditLogEntryFilters,
  ): Observable<{ entries: AuditLogEntry[]; total: number; nextPageToken?: string }>;
}
