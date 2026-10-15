/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1CommitteeMember } from '../models/v1committee-member';
import { V1ListCommitteeMembersResponse } from '../models/v1list-committee-members-response';

/**
 * CommitteeMemberService manages the users assigned to a committee.
 */
@Injectable({
  providedIn: 'root',
})
class CommitteeMemberServiceService extends __BaseService {
  static readonly CommitteeMemberServiceGetCommitteeMemberPath = '/v1/{name_10}';
  static readonly CommitteeMemberServiceDeleteCommitteeMemberPath = '/v1/{name_5}';
  static readonly CommitteeMemberServiceListCommitteeMembersPath = '/v1/{parent}/members';
  static readonly CommitteeMemberServiceCreateCommitteeMemberPath = '/v1/{parent}/members';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single membership by resource name.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param name_10 The resource name of the membership.
   * Format: organizations/{organization}/committees/{committee}/members/{member}
   * @return A successful response.
   */
  CommitteeMemberServiceGetCommitteeMemberResponse(name10: string): __Observable<__StrictHttpResponse<V1CommitteeMember>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
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
        return _r as __StrictHttpResponse<V1CommitteeMember>;
      })
    );
  }
  /**
   * Gets a single membership by resource name.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param name_10 The resource name of the membership.
   * Format: organizations/{organization}/committees/{committee}/members/{member}
   * @return A successful response.
   */
  CommitteeMemberServiceGetCommitteeMember(name10: string): __Observable<V1CommitteeMember> {
    return this.CommitteeMemberServiceGetCommitteeMemberResponse(name10).pipe(
      __map(_r => _r.body as V1CommitteeMember)
    );
  }

  /**
   * Removes a user from a committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param name_5 The resource name of the membership.
   * Format: organizations/{organization}/committees/{committee}/members/{member}
   * @return A successful response.
   */
  CommitteeMemberServiceDeleteCommitteeMemberResponse(name5: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name5))}`,
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
   * Removes a user from a committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param name_5 The resource name of the membership.
   * Format: organizations/{organization}/committees/{committee}/members/{member}
   * @return A successful response.
   */
  CommitteeMemberServiceDeleteCommitteeMember(name5: string): __Observable<{}> {
    return this.CommitteeMemberServiceDeleteCommitteeMemberResponse(name5).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists the memberships of a committee.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param params The `CommitteeMemberServiceService.CommitteeMemberServiceListCommitteeMembersParams` containing the following parameters:
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `page_token`: A page token from a previous ListCommitteeMembers call.
   *
   * - `page_size`: Maximum number of memberships to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  CommitteeMemberServiceListCommitteeMembersResponse(params: CommitteeMemberServiceService.CommitteeMemberServiceListCommitteeMembersParams): __Observable<__StrictHttpResponse<V1ListCommitteeMembersResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/members`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListCommitteeMembersResponse>;
      })
    );
  }
  /**
   * Lists the memberships of a committee.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param params The `CommitteeMemberServiceService.CommitteeMemberServiceListCommitteeMembersParams` containing the following parameters:
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `page_token`: A page token from a previous ListCommitteeMembers call.
   *
   * - `page_size`: Maximum number of memberships to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  CommitteeMemberServiceListCommitteeMembers(params: CommitteeMemberServiceService.CommitteeMemberServiceListCommitteeMembersParams): __Observable<V1ListCommitteeMembersResponse> {
    return this.CommitteeMemberServiceListCommitteeMembersResponse(params).pipe(
      __map(_r => _r.body as V1ListCommitteeMembersResponse)
    );
  }

  /**
   * Assigns a user to a committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteeMemberServiceService.CommitteeMemberServiceCreateCommitteeMemberParams` containing the following parameters:
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `member`: The membership to create. Only `user` is evaluated; all other fields are
   *   managed by the service.
   *
   * - `member_id`: The ID to use for the membership. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent committee.
   *
   * @return A successful response.
   */
  CommitteeMemberServiceCreateCommitteeMemberResponse(params: CommitteeMemberServiceService.CommitteeMemberServiceCreateCommitteeMemberParams): __Observable<__StrictHttpResponse<V1CommitteeMember>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.member;
    if (params.memberId != null) __params = __params.set('member_id', params.memberId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/members`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1CommitteeMember>;
      })
    );
  }
  /**
   * Assigns a user to a committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteeMemberServiceService.CommitteeMemberServiceCreateCommitteeMemberParams` containing the following parameters:
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `member`: The membership to create. Only `user` is evaluated; all other fields are
   *   managed by the service.
   *
   * - `member_id`: The ID to use for the membership. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent committee.
   *
   * @return A successful response.
   */
  CommitteeMemberServiceCreateCommitteeMember(params: CommitteeMemberServiceService.CommitteeMemberServiceCreateCommitteeMemberParams): __Observable<V1CommitteeMember> {
    return this.CommitteeMemberServiceCreateCommitteeMemberResponse(params).pipe(
      __map(_r => _r.body as V1CommitteeMember)
    );
  }
}

module CommitteeMemberServiceService {

  /**
   * Parameters for CommitteeMemberServiceListCommitteeMembers
   */
  export interface CommitteeMemberServiceListCommitteeMembersParams {

    /**
     * The parent committee resource name.
     * Format: organizations/{organization}/committees/{committee}
     */
    parent: string;

    /**
     * A page token from a previous ListCommitteeMembers call.
     */
    pageToken?: string;

    /**
     * Maximum number of memberships to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;
  }

  /**
   * Parameters for CommitteeMemberServiceCreateCommitteeMember
   */
  export interface CommitteeMemberServiceCreateCommitteeMemberParams {

    /**
     * The parent committee resource name.
     * Format: organizations/{organization}/committees/{committee}
     */
    parent: string;

    /**
     * The membership to create. Only `user` is evaluated; all other fields are
     * managed by the service.
     */
    member: V1CommitteeMember;

    /**
     * The ID to use for the membership. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent committee.
     */
    memberId?: string;
  }
}

export { CommitteeMemberServiceService }
