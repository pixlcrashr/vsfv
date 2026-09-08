/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1ListUsersResponse } from '../models/v1list-users-response';
import { V1BatchCheckUserPermissionsResponse } from '../models/v1batch-check-user-permissions-response';
import { V1BatchCheckUserPermissionsRequest } from '../models/v1batch-check-user-permissions-request';
import { V1User } from '../models/v1user';
import { V1CheckUserPermissionsResponse } from '../models/v1check-user-permissions-response';
import { UserServiceCheckUserPermissionsBody } from '../models/user-service-check-user-permissions-body';
import { V1ListUserGroupsResponse } from '../models/v1list-user-groups-response';

/**
 * UserService provides a read-only administrative view of users.
 * Users are created exclusively through the SSO/OAuth2 flow.
 */
@Injectable({
  providedIn: 'root',
})
class UserServiceService extends __BaseService {
  static readonly UserServiceListUsersPath = '/v1/users';
  static readonly UserServiceBatchCheckUserPermissionsPath = '/v1/users:batchCheckPermissions';
  static readonly UserServiceGetUserPath = '/v1/{name_17}';
  static readonly UserServiceCheckUserPermissionsPath = '/v1/{name}:checkPermissions';
  static readonly UserServiceListUserGroupsPath = '/v1/{name}:listGroups';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Lists users with pagination.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param params The `UserServiceService.UserServiceListUsersParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListUsers call.
   *
   * - `page_size`: Maximum number of users to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, email, is_active.
   *
   * @return A successful response.
   */
  UserServiceListUsersResponse(params: UserServiceService.UserServiceListUsersParams): __Observable<__StrictHttpResponse<V1ListUsersResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/users`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListUsersResponse>;
      })
    );
  }
  /**
   * Lists users with pagination.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param params The `UserServiceService.UserServiceListUsersParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListUsers call.
   *
   * - `page_size`: Maximum number of users to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, email, is_active.
   *
   * @return A successful response.
   */
  UserServiceListUsers(params: UserServiceService.UserServiceListUsersParams): __Observable<V1ListUsersResponse> {
    return this.UserServiceListUsersResponse(params).pipe(
      __map(_r => _r.body as V1ListUsersResponse)
    );
  }

  /**
   * Checks permissions for one or more users in one call, each optionally
   * scoped to a different domain (batch custom method, AIP-231).
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param body BatchCheckUserPermissionsRequest checks permissions for one or more users
   * in a single call (AIP-231 batch pattern). Each entry can target a different
   * domain (or the global domain when domain is empty).
   * @return A successful response.
   */
  UserServiceBatchCheckUserPermissionsResponse(body: V1BatchCheckUserPermissionsRequest): __Observable<__StrictHttpResponse<V1BatchCheckUserPermissionsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/users:batchCheckPermissions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1BatchCheckUserPermissionsResponse>;
      })
    );
  }
  /**
   * Checks permissions for one or more users in one call, each optionally
   * scoped to a different domain (batch custom method, AIP-231).
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param body BatchCheckUserPermissionsRequest checks permissions for one or more users
   * in a single call (AIP-231 batch pattern). Each entry can target a different
   * domain (or the global domain when domain is empty).
   * @return A successful response.
   */
  UserServiceBatchCheckUserPermissions(body: V1BatchCheckUserPermissionsRequest): __Observable<V1BatchCheckUserPermissionsResponse> {
    return this.UserServiceBatchCheckUserPermissionsResponse(body).pipe(
      __map(_r => _r.body as V1BatchCheckUserPermissionsResponse)
    );
  }

  /**
   * Gets a single user by resource name.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param name_17 The resource name of the user.
   * Format: users/{user}
   * @return A successful response.
   */
  UserServiceGetUserResponse(name17: string): __Observable<__StrictHttpResponse<V1User>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name17))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1User>;
      })
    );
  }
  /**
   * Gets a single user by resource name.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param name_17 The resource name of the user.
   * Format: users/{user}
   * @return A successful response.
   */
  UserServiceGetUser(name17: string): __Observable<V1User> {
    return this.UserServiceGetUserResponse(name17).pipe(
      __map(_r => _r.body as V1User)
    );
  }

  /**
   * Checks which of the requested permissions a user holds, optionally scoped
   * to a domain (custom method, AIP-136).
   * When domain is empty, permissions are evaluated against the global
   * domain. When set, permissions are evaluated against the specified domain.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param params The `UserServiceService.UserServiceCheckUserPermissionsParams` containing the following parameters:
   *
   * - `name`: The resource name of the user.
   *   Format: users/{user}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  UserServiceCheckUserPermissionsResponse(params: UserServiceService.UserServiceCheckUserPermissionsParams): __Observable<__StrictHttpResponse<V1CheckUserPermissionsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:checkPermissions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1CheckUserPermissionsResponse>;
      })
    );
  }
  /**
   * Checks which of the requested permissions a user holds, optionally scoped
   * to a domain (custom method, AIP-136).
   * When domain is empty, permissions are evaluated against the global
   * domain. When set, permissions are evaluated against the specified domain.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param params The `UserServiceService.UserServiceCheckUserPermissionsParams` containing the following parameters:
   *
   * - `name`: The resource name of the user.
   *   Format: users/{user}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  UserServiceCheckUserPermissions(params: UserServiceService.UserServiceCheckUserPermissionsParams): __Observable<V1CheckUserPermissionsResponse> {
    return this.UserServiceCheckUserPermissionsResponse(params).pipe(
      __map(_r => _r.body as V1CheckUserPermissionsResponse)
    );
  }

  /**
   * Lists the groups a user belongs to (custom method, AIP-136).
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param name The resource name of the user.
   * Format: users/{user}
   * @return A successful response.
   */
  UserServiceListUserGroupsResponse(name: string): __Observable<__StrictHttpResponse<V1ListUserGroupsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name))}:listGroups`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListUserGroupsResponse>;
      })
    );
  }
  /**
   * Lists the groups a user belongs to (custom method, AIP-136).
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param name The resource name of the user.
   * Format: users/{user}
   * @return A successful response.
   */
  UserServiceListUserGroups(name: string): __Observable<V1ListUserGroupsResponse> {
    return this.UserServiceListUserGroupsResponse(name).pipe(
      __map(_r => _r.body as V1ListUserGroupsResponse)
    );
  }
}

module UserServiceService {

  /**
   * Parameters for UserServiceListUsers
   */
  export interface UserServiceListUsersParams {

    /**
     * A page token from a previous ListUsers call.
     */
    pageToken?: string;

    /**
     * Maximum number of users to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "display_name", "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: display_name, email, is_active.
     */
    filter?: string;
  }

  /**
   * Parameters for UserServiceCheckUserPermissions
   */
  export interface UserServiceCheckUserPermissionsParams {

    /**
     * The resource name of the user.
     * Format: users/{user}
     */
    name: string;
    body: UserServiceCheckUserPermissionsBody;
  }
}

export { UserServiceService }
