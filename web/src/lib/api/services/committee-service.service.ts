/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1Committee } from '../models/v1committee';
import { V1CommitteePaymentAccount } from '../models/v1committee-payment-account';
import { V1ListCommitteesResponse } from '../models/v1list-committees-response';

/**
 * CommitteeService manages committees.
 */
@Injectable({
  providedIn: 'root',
})
class CommitteeServiceService extends __BaseService {
  static readonly CommitteeServiceUpdateCommitteePath = '/v1/{committee.name}';
  static readonly CommitteeServiceDeleteCommitteePath = '/v1/{name_4}';
  static readonly CommitteeServiceGetCommitteePath = '/v1/{name_9}';
  static readonly CommitteeServiceListCommitteesPath = '/v1/{parent}/committees';
  static readonly CommitteeServiceCreateCommitteePath = '/v1/{parent}/committees';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteeServiceService.CommitteeServiceUpdateCommitteeParams` containing the following parameters:
   *
   * - `committee.name`: The resource name of the committee.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `committee`: The committee to update.
   *
   * @return A successful response.
   */
  CommitteeServiceUpdateCommitteeResponse(params: CommitteeServiceService.CommitteeServiceUpdateCommitteeParams): __Observable<__StrictHttpResponse<V1Committee>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.committee;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.committeeName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Committee>;
      })
    );
  }
  /**
   * Updates an existing committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteeServiceService.CommitteeServiceUpdateCommitteeParams` containing the following parameters:
   *
   * - `committee.name`: The resource name of the committee.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `committee`: The committee to update.
   *
   * @return A successful response.
   */
  CommitteeServiceUpdateCommittee(params: CommitteeServiceService.CommitteeServiceUpdateCommitteeParams): __Observable<V1Committee> {
    return this.CommitteeServiceUpdateCommitteeResponse(params).pipe(
      __map(_r => _r.body as V1Committee)
    );
  }

  /**
   * Deletes a committee. Fails with FAILED_PRECONDITION if the committee is
   * still referenced by submissions.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:delete
   *   Domain: organization-scoped
   * @param name_4 The resource name of the committee.
   * Format: organizations/{organization}/committees/{committee}
   * @return A successful response.
   */
  CommitteeServiceDeleteCommitteeResponse(name4: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name4))}`,
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
   * Deletes a committee. Fails with FAILED_PRECONDITION if the committee is
   * still referenced by submissions.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:delete
   *   Domain: organization-scoped
   * @param name_4 The resource name of the committee.
   * Format: organizations/{organization}/committees/{committee}
   * @return A successful response.
   */
  CommitteeServiceDeleteCommittee(name4: string): __Observable<{}> {
    return this.CommitteeServiceDeleteCommitteeResponse(name4).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Gets a single committee by resource name.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param name_9 The resource name of the committee.
   * Format: organizations/{organization}/committees/{committee}
   * @return A successful response.
   */
  CommitteeServiceGetCommitteeResponse(name9: string): __Observable<__StrictHttpResponse<V1Committee>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name9))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Committee>;
      })
    );
  }
  /**
   * Gets a single committee by resource name.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param name_9 The resource name of the committee.
   * Format: organizations/{organization}/committees/{committee}
   * @return A successful response.
   */
  CommitteeServiceGetCommittee(name9: string): __Observable<V1Committee> {
    return this.CommitteeServiceGetCommitteeResponse(name9).pipe(
      __map(_r => _r.body as V1Committee)
    );
  }

  /**
   * Lists committees with pagination and optional filters.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param params The `CommitteeServiceService.CommitteeServiceListCommitteesParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListCommittees call.
   *
   * - `page_size`: Maximum number of committees to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"AStA\"".
   *
   * @return A successful response.
   */
  CommitteeServiceListCommitteesResponse(params: CommitteeServiceService.CommitteeServiceListCommitteesParams): __Observable<__StrictHttpResponse<V1ListCommitteesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/committees`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListCommitteesResponse>;
      })
    );
  }
  /**
   * Lists committees with pagination and optional filters.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param params The `CommitteeServiceService.CommitteeServiceListCommitteesParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListCommittees call.
   *
   * - `page_size`: Maximum number of committees to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"AStA\"".
   *
   * @return A successful response.
   */
  CommitteeServiceListCommittees(params: CommitteeServiceService.CommitteeServiceListCommitteesParams): __Observable<V1ListCommitteesResponse> {
    return this.CommitteeServiceListCommitteesResponse(params).pipe(
      __map(_r => _r.body as V1ListCommitteesResponse)
    );
  }

  /**
   * Creates a new committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:create
   *   Domain: organization-scoped
   * @param params The `CommitteeServiceService.CommitteeServiceCreateCommitteeParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `committee`: The committee to create.
   *
   * - `committee_id`: The ID to use for the committee. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  CommitteeServiceCreateCommitteeResponse(params: CommitteeServiceService.CommitteeServiceCreateCommitteeParams): __Observable<__StrictHttpResponse<V1Committee>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.committee;
    if (params.committeeId != null) __params = __params.set('committee_id', params.committeeId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/committees`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Committee>;
      })
    );
  }
  /**
   * Creates a new committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:create
   *   Domain: organization-scoped
   * @param params The `CommitteeServiceService.CommitteeServiceCreateCommitteeParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `committee`: The committee to create.
   *
   * - `committee_id`: The ID to use for the committee. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  CommitteeServiceCreateCommittee(params: CommitteeServiceService.CommitteeServiceCreateCommitteeParams): __Observable<V1Committee> {
    return this.CommitteeServiceCreateCommitteeResponse(params).pipe(
      __map(_r => _r.body as V1Committee)
    );
  }
}

module CommitteeServiceService {

  /**
   * Parameters for CommitteeServiceUpdateCommittee
   */
  export interface CommitteeServiceUpdateCommitteeParams {

    /**
     * The resource name of the committee.
     * Format: organizations/{organization}/committees/{committee}
     */
    committeeName: string;

    /**
     * The committee to update.
     */
    committee: {uid?: string, display_name: string, display_description?: string, allow_scope_selection?: boolean, payment_accounts?: Array<V1CommitteePaymentAccount>, update_time?: string, create_time?: string};
  }

  /**
   * Parameters for CommitteeServiceListCommittees
   */
  export interface CommitteeServiceListCommitteesParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * A page token from a previous ListCommittees call.
     */
    pageToken?: string;

    /**
     * Maximum number of committees to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "display_name", "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: display_name.
     * Example: "display_name=\"AStA\"".
     */
    filter?: string;
  }

  /**
   * Parameters for CommitteeServiceCreateCommittee
   */
  export interface CommitteeServiceCreateCommitteeParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The committee to create.
     */
    committee: V1Committee;

    /**
     * The ID to use for the committee. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent organization.
     */
    committeeId?: string;
  }
}

export { CommitteeServiceService }
