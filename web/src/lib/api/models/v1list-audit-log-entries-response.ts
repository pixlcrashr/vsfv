/* tslint:disable */
import { V1AuditLogEntry } from './v1audit-log-entry';
export interface V1ListAuditLogEntriesResponse {

  /**
   * The audit log entries returned.
   */
  audit_log_entries?: Array<V1AuditLogEntry>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * Total number of audit log entries matching the filter (may be an estimate).
   */
  total_size?: string;
}
