/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1UserIdentity } from '../models/v1user-identity';
import { V1ListUserIdentitiesResponse } from '../models/v1list-user-identities-response';

/**
 * UserIdentityService provides a read-only view of the OAuth2 / SSO
 * connections linked to a user. No credentials are ever returned.
 */
@Injectable({
  providedIn: 'root',
})
class UserIdentityServiceService extends __BaseService {
  static readonly UserIdentityServiceGetUserIdentityPath = '/v1/{name_18}';
  static readonly UserIdentityServiceListUserIdentitiesPath = '/v1/{parent}/identities';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single identity record.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param name_18 The resource name of the identity.
   * Format: users/{user}/identities/{identity}
   * @return A successful response.
   */
  UserIdentityServiceGetUserIdentityResponse(name18: string): __Observable<__StrictHttpResponse<V1UserIdentity>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name18))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1UserIdentity>;
      })
    );
  }
  /**
   * Gets a single identity record.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param name_18 The resource name of the identity.
   * Format: users/{user}/identities/{identity}
   * @return A successful response.
   */
  UserIdentityServiceGetUserIdentity(name18: string): __Observable<V1UserIdentity> {
    return this.UserIdentityServiceGetUserIdentityResponse(name18).pipe(
      __map(_r => _r.body as V1UserIdentity)
    );
  }

  /**
   * Lists all identity records for a user.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param params The `UserIdentityServiceService.UserIdentityServiceListUserIdentitiesParams` containing the following parameters:
   *
   * - `parent`: The parent user resource name.
   *   Format: users/{user}
   *
   * - `page_token`: A page token from a previous ListUserIdentities call.
   *
   * - `page_size`: Maximum number of identities to return.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  UserIdentityServiceListUserIdentitiesResponse(params: UserIdentityServiceService.UserIdentityServiceListUserIdentitiesParams): __Observable<__StrictHttpResponse<V1ListUserIdentitiesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/identities`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListUserIdentitiesResponse>;
      })
    );
  }
  /**
   * Lists all identity records for a user.
   * Authorization:
   *   Scope: users:read
   *   Permission: users:read
   *   Domain: global
   * @param params The `UserIdentityServiceService.UserIdentityServiceListUserIdentitiesParams` containing the following parameters:
   *
   * - `parent`: The parent user resource name.
   *   Format: users/{user}
   *
   * - `page_token`: A page token from a previous ListUserIdentities call.
   *
   * - `page_size`: Maximum number of identities to return.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  UserIdentityServiceListUserIdentities(params: UserIdentityServiceService.UserIdentityServiceListUserIdentitiesParams): __Observable<V1ListUserIdentitiesResponse> {
    return this.UserIdentityServiceListUserIdentitiesResponse(params).pipe(
      __map(_r => _r.body as V1ListUserIdentitiesResponse)
    );
  }
}

module UserIdentityServiceService {

  /**
   * Parameters for UserIdentityServiceListUserIdentities
   */
  export interface UserIdentityServiceListUserIdentitiesParams {

    /**
     * The parent user resource name.
     * Format: users/{user}
     */
    parent: string;

    /**
     * A page token from a previous ListUserIdentities call.
     */
    pageToken?: string;

    /**
     * Maximum number of identities to return.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;
  }
}

export { UserIdentityServiceService }
