/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1TransactionAssignment } from '../models/v1transaction-assignment';
import { V1Decimal } from '../models/v1decimal';
import { V1ListTransactionAssignmentsResponse } from '../models/v1list-transaction-assignments-response';
@Injectable({
  providedIn: 'root',
})
class TransactionAssignmentServiceService extends __BaseService {
  static readonly TransactionAssignmentServiceUpdateTransactionAssignmentPath = '/v1/{assignment.name_1}';
  static readonly TransactionAssignmentServiceDeleteTransactionAssignmentPath = '/v1/{name_10}';
  static readonly TransactionAssignmentServiceGetTransactionAssignmentPath = '/v1/{name_16}';
  static readonly TransactionAssignmentServiceListTransactionAssignmentsPath = '/v1/{parent_1}/assignments';
  static readonly TransactionAssignmentServiceCreateTransactionAssignmentPath = '/v1/{parent_1}/assignments';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing transaction assignment.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:update
   *   Domain: organization-scoped
   * @param params The `TransactionAssignmentServiceService.TransactionAssignmentServiceUpdateTransactionAssignmentParams` containing the following parameters:
   *
   * - `assignment.name_1`: The resource name of the transaction assignment.
   *   Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
   *
   * - `assignment`: The transaction assignment to update.
   *
   * @return A successful response.
   */
  TransactionAssignmentServiceUpdateTransactionAssignmentResponse(params: TransactionAssignmentServiceService.TransactionAssignmentServiceUpdateTransactionAssignmentParams): __Observable<__StrictHttpResponse<V1TransactionAssignment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.assignment;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.assignmentName1))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1TransactionAssignment>;
      })
    );
  }
  /**
   * Updates an existing transaction assignment.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:update
   *   Domain: organization-scoped
   * @param params The `TransactionAssignmentServiceService.TransactionAssignmentServiceUpdateTransactionAssignmentParams` containing the following parameters:
   *
   * - `assignment.name_1`: The resource name of the transaction assignment.
   *   Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
   *
   * - `assignment`: The transaction assignment to update.
   *
   * @return A successful response.
   */
  TransactionAssignmentServiceUpdateTransactionAssignment(params: TransactionAssignmentServiceService.TransactionAssignmentServiceUpdateTransactionAssignmentParams): __Observable<V1TransactionAssignment> {
    return this.TransactionAssignmentServiceUpdateTransactionAssignmentResponse(params).pipe(
      __map(_r => _r.body as V1TransactionAssignment)
    );
  }

  /**
   * Deletes a transaction assignment.
   * Authorization:
   *   Scope: transactions:delete
   *   Permission: transactions:delete
   *   Domain: organization-scoped
   * @param name_10 The resource name of the transaction assignment.
   * Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
   * @return A successful response.
   */
  TransactionAssignmentServiceDeleteTransactionAssignmentResponse(name10: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name10))}`,
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
   * Deletes a transaction assignment.
   * Authorization:
   *   Scope: transactions:delete
   *   Permission: transactions:delete
   *   Domain: organization-scoped
   * @param name_10 The resource name of the transaction assignment.
   * Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
   * @return A successful response.
   */
  TransactionAssignmentServiceDeleteTransactionAssignment(name10: string): __Observable<{}> {
    return this.TransactionAssignmentServiceDeleteTransactionAssignmentResponse(name10).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Gets a single transaction assignment by resource name.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param name_16 The resource name of the transaction assignment.
   * Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
   * @return A successful response.
   */
  TransactionAssignmentServiceGetTransactionAssignmentResponse(name16: string): __Observable<__StrictHttpResponse<V1TransactionAssignment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name16))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1TransactionAssignment>;
      })
    );
  }
  /**
   * Gets a single transaction assignment by resource name.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param name_16 The resource name of the transaction assignment.
   * Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
   * @return A successful response.
   */
  TransactionAssignmentServiceGetTransactionAssignment(name16: string): __Observable<V1TransactionAssignment> {
    return this.TransactionAssignmentServiceGetTransactionAssignmentResponse(name16).pipe(
      __map(_r => _r.body as V1TransactionAssignment)
    );
  }

  /**
   * Lists transaction assignments with keyset pagination and optional filters.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param params The `TransactionAssignmentServiceService.TransactionAssignmentServiceListTransactionAssignmentsParams` containing the following parameters:
   *
   * - `parent_1`: The parent transaction resource name.
   *   Format: organizations/{organization}/transactions/{transaction}
   *
   * - `page_token`: A page token from a previous ListTransactionAssignments call.
   *
   * - `page_size`: Maximum number of assignments to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "value desc", "create_time").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account.
   *   Example: "account=\"organizations/{organization}/accounts/{account}\"".
   *
   * @return A successful response.
   */
  TransactionAssignmentServiceListTransactionAssignmentsResponse(params: TransactionAssignmentServiceService.TransactionAssignmentServiceListTransactionAssignmentsParams): __Observable<__StrictHttpResponse<V1ListTransactionAssignmentsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent1))}/assignments`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListTransactionAssignmentsResponse>;
      })
    );
  }
  /**
   * Lists transaction assignments with keyset pagination and optional filters.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param params The `TransactionAssignmentServiceService.TransactionAssignmentServiceListTransactionAssignmentsParams` containing the following parameters:
   *
   * - `parent_1`: The parent transaction resource name.
   *   Format: organizations/{organization}/transactions/{transaction}
   *
   * - `page_token`: A page token from a previous ListTransactionAssignments call.
   *
   * - `page_size`: Maximum number of assignments to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "value desc", "create_time").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account.
   *   Example: "account=\"organizations/{organization}/accounts/{account}\"".
   *
   * @return A successful response.
   */
  TransactionAssignmentServiceListTransactionAssignments(params: TransactionAssignmentServiceService.TransactionAssignmentServiceListTransactionAssignmentsParams): __Observable<V1ListTransactionAssignmentsResponse> {
    return this.TransactionAssignmentServiceListTransactionAssignmentsResponse(params).pipe(
      __map(_r => _r.body as V1ListTransactionAssignmentsResponse)
    );
  }

  /**
   * Creates a new transaction assignment.
   * Authorization:
   *   Scope: transactions:create
   *   Permission: transactions:create
   *   Domain: organization-scoped
   * @param params The `TransactionAssignmentServiceService.TransactionAssignmentServiceCreateTransactionAssignmentParams` containing the following parameters:
   *
   * - `parent_1`: The parent transaction resource name.
   *   Format: organizations/{organization}/transactions/{transaction}
   *
   * - `assignment`: The transaction assignment to create.
   *
   * - `assignment_id`: The ID to use for the assignment. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent transaction.
   *
   * @return A successful response.
   */
  TransactionAssignmentServiceCreateTransactionAssignmentResponse(params: TransactionAssignmentServiceService.TransactionAssignmentServiceCreateTransactionAssignmentParams): __Observable<__StrictHttpResponse<V1TransactionAssignment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.assignment;
    if (params.assignmentId != null) __params = __params.set('assignment_id', params.assignmentId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent1))}/assignments`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1TransactionAssignment>;
      })
    );
  }
  /**
   * Creates a new transaction assignment.
   * Authorization:
   *   Scope: transactions:create
   *   Permission: transactions:create
   *   Domain: organization-scoped
   * @param params The `TransactionAssignmentServiceService.TransactionAssignmentServiceCreateTransactionAssignmentParams` containing the following parameters:
   *
   * - `parent_1`: The parent transaction resource name.
   *   Format: organizations/{organization}/transactions/{transaction}
   *
   * - `assignment`: The transaction assignment to create.
   *
   * - `assignment_id`: The ID to use for the assignment. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent transaction.
   *
   * @return A successful response.
   */
  TransactionAssignmentServiceCreateTransactionAssignment(params: TransactionAssignmentServiceService.TransactionAssignmentServiceCreateTransactionAssignmentParams): __Observable<V1TransactionAssignment> {
    return this.TransactionAssignmentServiceCreateTransactionAssignmentResponse(params).pipe(
      __map(_r => _r.body as V1TransactionAssignment)
    );
  }
}

module TransactionAssignmentServiceService {

  /**
   * Parameters for TransactionAssignmentServiceUpdateTransactionAssignment
   */
  export interface TransactionAssignmentServiceUpdateTransactionAssignmentParams {

    /**
     * The resource name of the transaction assignment.
     * Format: organizations/{organization}/transactions/{transaction}/assignments/{assignment}
     */
    assignmentName1: string;

    /**
     * The transaction assignment to update.
     */
    assignment: {uid?: string, transaction?: string, account: string, value: V1Decimal, update_time?: string, create_time?: string};
  }

  /**
   * Parameters for TransactionAssignmentServiceListTransactionAssignments
   */
  export interface TransactionAssignmentServiceListTransactionAssignmentsParams {

    /**
     * The parent transaction resource name.
     * Format: organizations/{organization}/transactions/{transaction}
     */
    parent1: string;

    /**
     * A page token from a previous ListTransactionAssignments call.
     */
    pageToken?: string;

    /**
     * Maximum number of assignments to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "value desc", "create_time").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: account.
     * Example: "account=\"organizations/{organization}/accounts/{account}\"".
     */
    filter?: string;
  }

  /**
   * Parameters for TransactionAssignmentServiceCreateTransactionAssignment
   */
  export interface TransactionAssignmentServiceCreateTransactionAssignmentParams {

    /**
     * The parent transaction resource name.
     * Format: organizations/{organization}/transactions/{transaction}
     */
    parent1: string;

    /**
     * The transaction assignment to create.
     */
    assignment: V1TransactionAssignment;

    /**
     * The ID to use for the assignment. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent transaction.
     */
    assignmentId?: string;
  }
}

export { TransactionAssignmentServiceService }
