/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1ListAuditLogEntriesResponse } from '../models/v1list-audit-log-entries-response';
import { V1AuditLogEntry } from '../models/v1audit-log-entry';

/**
 * AuditLogService provides read-only access to the global, append-only audit
 * log. Entries can be retrieved individually by resource name or listed with
 * filters. The audit log itself is not bound to any organization: entries for
 * resources below an organization carry that organization's resource name and
 * can be filtered by it.
 */
@Injectable({
  providedIn: 'root',
})
class AuditLogServiceService extends __BaseService {
  static readonly AuditLogServiceListAuditLogEntriesPath = '/v1/auditLogEntries';
  static readonly AuditLogServiceGetAuditLogEntryPath = '/v1/{name_3}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Lists audit log entries with pagination.
   * Callers holding only organization-scoped auditLogs:read permissions
   * receive only the entries of the organizations they have access to.
   * Authorization:
   *   Scope: auditLogs:read
   *   Permission: auditLogs:read
   *   Domain: global, or organization-scoped
   * @param params The `AuditLogServiceService.AuditLogServiceListAuditLogEntriesParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListAuditLogEntries call.
   *
   * - `page_size`: Maximum number of audit log entries to return. The service may return fewer.
   *   If unspecified, at most 100 are returned. Maximum value is 200.
   *
   * - `order_by`: Order by expression (e.g. "timestamp", "timestamp desc"). Defaults to
   *   "timestamp desc".
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: resource, actor, action, organization, timestamp.
   *   Examples: "action=CREATE", "organization=\"organizations/123\"",
   *   "timestamp>=\"2026-01-01T00:00:00Z\"".
   *
   * @return A successful response.
   */
  AuditLogServiceListAuditLogEntriesResponse(params: AuditLogServiceService.AuditLogServiceListAuditLogEntriesParams): __Observable<__StrictHttpResponse<V1ListAuditLogEntriesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/auditLogEntries`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListAuditLogEntriesResponse>;
      })
    );
  }
  /**
   * Lists audit log entries with pagination.
   * Callers holding only organization-scoped auditLogs:read permissions
   * receive only the entries of the organizations they have access to.
   * Authorization:
   *   Scope: auditLogs:read
   *   Permission: auditLogs:read
   *   Domain: global, or organization-scoped
   * @param params The `AuditLogServiceService.AuditLogServiceListAuditLogEntriesParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListAuditLogEntries call.
   *
   * - `page_size`: Maximum number of audit log entries to return. The service may return fewer.
   *   If unspecified, at most 100 are returned. Maximum value is 200.
   *
   * - `order_by`: Order by expression (e.g. "timestamp", "timestamp desc"). Defaults to
   *   "timestamp desc".
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: resource, actor, action, organization, timestamp.
   *   Examples: "action=CREATE", "organization=\"organizations/123\"",
   *   "timestamp>=\"2026-01-01T00:00:00Z\"".
   *
   * @return A successful response.
   */
  AuditLogServiceListAuditLogEntries(params: AuditLogServiceService.AuditLogServiceListAuditLogEntriesParams): __Observable<V1ListAuditLogEntriesResponse> {
    return this.AuditLogServiceListAuditLogEntriesResponse(params).pipe(
      __map(_r => _r.body as V1ListAuditLogEntriesResponse)
    );
  }

  /**
   * Gets a single audit log entry by resource name.
   * Authorization:
   *   Scope: auditLogs:read
   *   Permission: auditLogs:read
   *   Domain: global, or organization-scoped for entries below an organization
   * @param name_3 The resource name of the audit log entry.
   * Format: auditLogEntries/{audit_log_entry}
   * @return A successful response.
   */
  AuditLogServiceGetAuditLogEntryResponse(name3: string): __Observable<__StrictHttpResponse<V1AuditLogEntry>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name3))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1AuditLogEntry>;
      })
    );
  }
  /**
   * Gets a single audit log entry by resource name.
   * Authorization:
   *   Scope: auditLogs:read
   *   Permission: auditLogs:read
   *   Domain: global, or organization-scoped for entries below an organization
   * @param name_3 The resource name of the audit log entry.
   * Format: auditLogEntries/{audit_log_entry}
   * @return A successful response.
   */
  AuditLogServiceGetAuditLogEntry(name3: string): __Observable<V1AuditLogEntry> {
    return this.AuditLogServiceGetAuditLogEntryResponse(name3).pipe(
      __map(_r => _r.body as V1AuditLogEntry)
    );
  }
}

module AuditLogServiceService {

  /**
   * Parameters for AuditLogServiceListAuditLogEntries
   */
  export interface AuditLogServiceListAuditLogEntriesParams {

    /**
     * A page token from a previous ListAuditLogEntries call.
     */
    pageToken?: string;

    /**
     * Maximum number of audit log entries to return. The service may return fewer.
     * If unspecified, at most 100 are returned. Maximum value is 200.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "timestamp", "timestamp desc"). Defaults to
     * "timestamp desc".
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: resource, actor, action, organization, timestamp.
     * Examples: "action=CREATE", "organization=\"organizations/123\"",
     * "timestamp>=\"2026-01-01T00:00:00Z\"".
     */
    filter?: string;
  }
}

export { AuditLogServiceService }
