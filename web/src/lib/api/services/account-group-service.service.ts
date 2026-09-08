/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1AccountGroup } from '../models/v1account-group';
import { V1ListAccountGroupsResponse } from '../models/v1list-account-groups-response';
@Injectable({
  providedIn: 'root',
})
class AccountGroupServiceService extends __BaseService {
  static readonly AccountGroupServiceUpdateAccountGroupPath = '/v1/{account_group.name}';
  static readonly AccountGroupServiceGetAccountGroupPath = '/v1/{name_1}';
  static readonly AccountGroupServiceDeleteAccountGroupPath = '/v1/{name}';
  static readonly AccountGroupServiceListAccountGroupsPath = '/v1/{parent}/accountGroups';
  static readonly AccountGroupServiceCreateAccountGroupPath = '/v1/{parent}/accountGroups';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing account group.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:update
   *   Domain: organization-scoped
   * @param params The `AccountGroupServiceService.AccountGroupServiceUpdateAccountGroupParams` containing the following parameters:
   *
   * - `account_group.name`: The resource name of the account group.
   *   Format: organizations/{organization}/accountGroups/{account_group}
   *
   * - `account_group`: The account group to update.
   *
   * @return A successful response.
   */
  AccountGroupServiceUpdateAccountGroupResponse(params: AccountGroupServiceService.AccountGroupServiceUpdateAccountGroupParams): __Observable<__StrictHttpResponse<V1AccountGroup>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.accountGroup;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.accountGroupName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1AccountGroup>;
      })
    );
  }
  /**
   * Updates an existing account group.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:update
   *   Domain: organization-scoped
   * @param params The `AccountGroupServiceService.AccountGroupServiceUpdateAccountGroupParams` containing the following parameters:
   *
   * - `account_group.name`: The resource name of the account group.
   *   Format: organizations/{organization}/accountGroups/{account_group}
   *
   * - `account_group`: The account group to update.
   *
   * @return A successful response.
   */
  AccountGroupServiceUpdateAccountGroup(params: AccountGroupServiceService.AccountGroupServiceUpdateAccountGroupParams): __Observable<V1AccountGroup> {
    return this.AccountGroupServiceUpdateAccountGroupResponse(params).pipe(
      __map(_r => _r.body as V1AccountGroup)
    );
  }

  /**
   * Gets a single account group by resource name.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param name_1 The resource name of the account group.
   * Format: organizations/{organization}/accountGroups/{account_group}
   * @return A successful response.
   */
  AccountGroupServiceGetAccountGroupResponse(name1: string): __Observable<__StrictHttpResponse<V1AccountGroup>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
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
        return _r as __StrictHttpResponse<V1AccountGroup>;
      })
    );
  }
  /**
   * Gets a single account group by resource name.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param name_1 The resource name of the account group.
   * Format: organizations/{organization}/accountGroups/{account_group}
   * @return A successful response.
   */
  AccountGroupServiceGetAccountGroup(name1: string): __Observable<V1AccountGroup> {
    return this.AccountGroupServiceGetAccountGroupResponse(name1).pipe(
      __map(_r => _r.body as V1AccountGroup)
    );
  }

  /**
   * Permanently deletes an account group.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:delete
   *   Domain: organization-scoped
   * @param name The resource name of the account group.
   * Format: organizations/{organization}/accountGroups/{account_group}
   * @return A successful response.
   */
  AccountGroupServiceDeleteAccountGroupResponse(name: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name))}`,
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
   * Permanently deletes an account group.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:delete
   *   Domain: organization-scoped
   * @param name The resource name of the account group.
   * Format: organizations/{organization}/accountGroups/{account_group}
   * @return A successful response.
   */
  AccountGroupServiceDeleteAccountGroup(name: string): __Observable<{}> {
    return this.AccountGroupServiceDeleteAccountGroupResponse(name).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists account groups with pagination.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param params The `AccountGroupServiceService.AccountGroupServiceListAccountGroupsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListAccountGroups call.
   *
   * - `page_size`: Maximum number of account groups to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"Overhead\"".
   *
   * @return A successful response.
   */
  AccountGroupServiceListAccountGroupsResponse(params: AccountGroupServiceService.AccountGroupServiceListAccountGroupsParams): __Observable<__StrictHttpResponse<V1ListAccountGroupsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accountGroups`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListAccountGroupsResponse>;
      })
    );
  }
  /**
   * Lists account groups with pagination.
   * Authorization:
   *   Scope: accountGroups:read
   *   Permission: accountGroups:read
   *   Domain: organization-scoped
   * @param params The `AccountGroupServiceService.AccountGroupServiceListAccountGroupsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListAccountGroups call.
   *
   * - `page_size`: Maximum number of account groups to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"Overhead\"".
   *
   * @return A successful response.
   */
  AccountGroupServiceListAccountGroups(params: AccountGroupServiceService.AccountGroupServiceListAccountGroupsParams): __Observable<V1ListAccountGroupsResponse> {
    return this.AccountGroupServiceListAccountGroupsResponse(params).pipe(
      __map(_r => _r.body as V1ListAccountGroupsResponse)
    );
  }

  /**
   * Creates a new account group.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:create
   *   Domain: organization-scoped
   * @param params The `AccountGroupServiceService.AccountGroupServiceCreateAccountGroupParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `account_group`: The account group to create.
   *
   * - `account_group_id`: The ID to use for the account group. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  AccountGroupServiceCreateAccountGroupResponse(params: AccountGroupServiceService.AccountGroupServiceCreateAccountGroupParams): __Observable<__StrictHttpResponse<V1AccountGroup>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.accountGroup;
    if (params.accountGroupId != null) __params = __params.set('account_group_id', params.accountGroupId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accountGroups`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1AccountGroup>;
      })
    );
  }
  /**
   * Creates a new account group.
   * Authorization:
   *   Scope: accountGroups:write
   *   Permission: accountGroups:create
   *   Domain: organization-scoped
   * @param params The `AccountGroupServiceService.AccountGroupServiceCreateAccountGroupParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `account_group`: The account group to create.
   *
   * - `account_group_id`: The ID to use for the account group. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  AccountGroupServiceCreateAccountGroup(params: AccountGroupServiceService.AccountGroupServiceCreateAccountGroupParams): __Observable<V1AccountGroup> {
    return this.AccountGroupServiceCreateAccountGroupResponse(params).pipe(
      __map(_r => _r.body as V1AccountGroup)
    );
  }
}

module AccountGroupServiceService {

  /**
   * Parameters for AccountGroupServiceUpdateAccountGroup
   */
  export interface AccountGroupServiceUpdateAccountGroupParams {

    /**
     * The resource name of the account group.
     * Format: organizations/{organization}/accountGroups/{account_group}
     */
    accountGroupName: string;

    /**
     * The account group to update.
     */
    accountGroup: {uid?: string, display_name: string, display_description?: string, update_time?: string, create_time?: string, etag?: string};
  }

  /**
   * Parameters for AccountGroupServiceListAccountGroups
   */
  export interface AccountGroupServiceListAccountGroupsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * A page token from a previous ListAccountGroups call.
     */
    pageToken?: string;

    /**
     * Maximum number of account groups to return. The service may return fewer.
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
     * Example: "display_name=\"Overhead\"".
     */
    filter?: string;
  }

  /**
   * Parameters for AccountGroupServiceCreateAccountGroup
   */
  export interface AccountGroupServiceCreateAccountGroupParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The account group to create.
     */
    accountGroup: V1AccountGroup;

    /**
     * The ID to use for the account group. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent organization.
     */
    accountGroupId?: string;
  }
}

export { AccountGroupServiceService }
