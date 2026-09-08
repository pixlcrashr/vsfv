/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1AccountGroupAssignment } from '../models/v1account-group-assignment';
import { V1ListAccountGroupAssignmentsResponse } from '../models/v1list-account-group-assignments-response';

/**
 * AccountGroupAssignmentService manages account memberships within account groups.
 */
@Injectable({
  providedIn: 'root',
})
class AccountGroupAssignmentServiceService extends __BaseService {
  static readonly AccountGroupAssignmentServiceUpdateAccountGroupAssignmentPath = '/v1/{assignment.name}';
  static readonly AccountGroupAssignmentServiceDeleteAccountGroupAssignmentPath = '/v1/{name_1}';
  static readonly AccountGroupAssignmentServiceGetAccountGroupAssignmentPath = '/v1/{name_2}';
  static readonly AccountGroupAssignmentServiceListAccountGroupAssignmentsPath = '/v1/{parent}/assignments';
  static readonly AccountGroupAssignmentServiceCreateAccountGroupAssignmentPath = '/v1/{parent}/assignments';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing assignment.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:update
   *   Domain: organization-scoped
   * @param params The `AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceUpdateAccountGroupAssignmentParams` containing the following parameters:
   *
   * - `assignment.name`: The resource name of the assignment.
   *   Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
   *
   * - `assignment`: The assignment to update.
   *
   * @return A successful response.
   */
  AccountGroupAssignmentServiceUpdateAccountGroupAssignmentResponse(params: AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceUpdateAccountGroupAssignmentParams): __Observable<__StrictHttpResponse<V1AccountGroupAssignment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.assignment;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.assignmentName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1AccountGroupAssignment>;
      })
    );
  }
  /**
   * Updates an existing assignment.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:update
   *   Domain: organization-scoped
   * @param params The `AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceUpdateAccountGroupAssignmentParams` containing the following parameters:
   *
   * - `assignment.name`: The resource name of the assignment.
   *   Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
   *
   * - `assignment`: The assignment to update.
   *
   * @return A successful response.
   */
  AccountGroupAssignmentServiceUpdateAccountGroupAssignment(params: AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceUpdateAccountGroupAssignmentParams): __Observable<V1AccountGroupAssignment> {
    return this.AccountGroupAssignmentServiceUpdateAccountGroupAssignmentResponse(params).pipe(
      __map(_r => _r.body as V1AccountGroupAssignment)
    );
  }

  /**
   * Permanently deletes an assignment.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:delete
   *   Domain: organization-scoped
   * @param name_1 The resource name of the assignment.
   * Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
   * @return A successful response.
   */
  AccountGroupAssignmentServiceDeleteAccountGroupAssignmentResponse(name1: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name1))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<{}>;
      })
    );
  }
  /**
   * Permanently deletes an assignment.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:delete
   *   Domain: organization-scoped
   * @param name_1 The resource name of the assignment.
   * Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
   * @return A successful response.
   */
  AccountGroupAssignmentServiceDeleteAccountGroupAssignment(name1: string): __Observable<{}> {
    return this.AccountGroupAssignmentServiceDeleteAccountGroupAssignmentResponse(name1).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Gets a single assignment by resource name.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param name_2 The resource name of the assignment.
   * Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
   * @return A successful response.
   */
  AccountGroupAssignmentServiceGetAccountGroupAssignmentResponse(name2: string): __Observable<__StrictHttpResponse<V1AccountGroupAssignment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name2))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1AccountGroupAssignment>;
      })
    );
  }
  /**
   * Gets a single assignment by resource name.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param name_2 The resource name of the assignment.
   * Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
   * @return A successful response.
   */
  AccountGroupAssignmentServiceGetAccountGroupAssignment(name2: string): __Observable<V1AccountGroupAssignment> {
    return this.AccountGroupAssignmentServiceGetAccountGroupAssignmentResponse(name2).pipe(
      __map(_r => _r.body as V1AccountGroupAssignment)
    );
  }

  /**
   * Lists assignments for an account group.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param params The `AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceListAccountGroupAssignmentsParams` containing the following parameters:
   *
   * - `parent`: The parent account group resource name.
   *   Format: organizations/{organization}/accountGroups/{account_group}
   *
   * - `page_token`: A page token from a previous ListAccountGroupAssignments call.
   *
   * - `page_size`: Maximum number of assignments to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account_id, negate.
   *   Example: "negate=true" or "account_id=\"<uuid>\"".
   *
   * @return A successful response.
   */
  AccountGroupAssignmentServiceListAccountGroupAssignmentsResponse(params: AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceListAccountGroupAssignmentsParams): __Observable<__StrictHttpResponse<V1ListAccountGroupAssignmentsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/assignments`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListAccountGroupAssignmentsResponse>;
      })
    );
  }
  /**
   * Lists assignments for an account group.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param params The `AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceListAccountGroupAssignmentsParams` containing the following parameters:
   *
   * - `parent`: The parent account group resource name.
   *   Format: organizations/{organization}/accountGroups/{account_group}
   *
   * - `page_token`: A page token from a previous ListAccountGroupAssignments call.
   *
   * - `page_size`: Maximum number of assignments to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account_id, negate.
   *   Example: "negate=true" or "account_id=\"<uuid>\"".
   *
   * @return A successful response.
   */
  AccountGroupAssignmentServiceListAccountGroupAssignments(params: AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceListAccountGroupAssignmentsParams): __Observable<V1ListAccountGroupAssignmentsResponse> {
    return this.AccountGroupAssignmentServiceListAccountGroupAssignmentsResponse(params).pipe(
      __map(_r => _r.body as V1ListAccountGroupAssignmentsResponse)
    );
  }

  /**
   * Creates a new assignment.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:create
   *   Domain: organization-scoped
   * @param params The `AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceCreateAccountGroupAssignmentParams` containing the following parameters:
   *
   * - `parent`: The parent account group resource name.
   *   Format: organizations/{organization}/accountGroups/{account_group}
   *
   * - `assignment`: The assignment to create.
   *
   * - `account_group_assignment_id`: The ID to use for the assignment. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent account group.
   *
   * @return A successful response.
   */
  AccountGroupAssignmentServiceCreateAccountGroupAssignmentResponse(params: AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceCreateAccountGroupAssignmentParams): __Observable<__StrictHttpResponse<V1AccountGroupAssignment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.assignment;
    if (params.accountGroupAssignmentId != null) __params = __params.set('account_group_assignment_id', params.accountGroupAssignmentId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/assignments`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1AccountGroupAssignment>;
      })
    );
  }
  /**
   * Creates a new assignment.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:create
   *   Domain: organization-scoped
   * @param params The `AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceCreateAccountGroupAssignmentParams` containing the following parameters:
   *
   * - `parent`: The parent account group resource name.
   *   Format: organizations/{organization}/accountGroups/{account_group}
   *
   * - `assignment`: The assignment to create.
   *
   * - `account_group_assignment_id`: The ID to use for the assignment. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent account group.
   *
   * @return A successful response.
   */
  AccountGroupAssignmentServiceCreateAccountGroupAssignment(params: AccountGroupAssignmentServiceService.AccountGroupAssignmentServiceCreateAccountGroupAssignmentParams): __Observable<V1AccountGroupAssignment> {
    return this.AccountGroupAssignmentServiceCreateAccountGroupAssignmentResponse(params).pipe(
      __map(_r => _r.body as V1AccountGroupAssignment)
    );
  }
}

module AccountGroupAssignmentServiceService {

  /**
   * Parameters for AccountGroupAssignmentServiceUpdateAccountGroupAssignment
   */
  export interface AccountGroupAssignmentServiceUpdateAccountGroupAssignmentParams {

    /**
     * The resource name of the assignment.
     * Format: organizations/{organization}/accountGroups/{account_group}/assignments/{assignment}
     */
    assignmentName: string;

    /**
     * The assignment to update.
     */
    assignment: {uid?: string, account_group?: string, account_id: string, negate?: boolean, update_time?: string, create_time?: string, etag?: string};
  }

  /**
   * Parameters for AccountGroupAssignmentServiceListAccountGroupAssignments
   */
  export interface AccountGroupAssignmentServiceListAccountGroupAssignmentsParams {

    /**
     * The parent account group resource name.
     * Format: organizations/{organization}/accountGroups/{account_group}
     */
    parent: string;

    /**
     * A page token from a previous ListAccountGroupAssignments call.
     */
    pageToken?: string;

    /**
     * Maximum number of assignments to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: account_id, negate.
     * Example: "negate=true" or "account_id=\"<uuid>\"".
     */
    filter?: string;
  }

  /**
   * Parameters for AccountGroupAssignmentServiceCreateAccountGroupAssignment
   */
  export interface AccountGroupAssignmentServiceCreateAccountGroupAssignmentParams {

    /**
     * The parent account group resource name.
     * Format: organizations/{organization}/accountGroups/{account_group}
     */
    parent: string;

    /**
     * The assignment to create.
     */
    assignment: V1AccountGroupAssignment;

    /**
     * The ID to use for the assignment. If not provided, a system-generated UUID
     * will be used. Must be unique within the parent account group.
     */
    accountGroupAssignmentId?: string;
  }
}

export { AccountGroupAssignmentServiceService }
