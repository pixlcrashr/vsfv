/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1ListOrganizationsResponse } from '../models/v1list-organizations-response';
import { V1Organization } from '../models/v1organization';
import { V1CheckOrganizationIdResponse } from '../models/v1check-organization-id-response';
import { V1CheckOrganizationIdRequest } from '../models/v1check-organization-id-request';
import { V1Month } from '../models/v1month';

/**
 * OrganizationService manages organizations.
 */
@Injectable({
  providedIn: 'root',
})
class OrganizationServiceService extends __BaseService {
  static readonly OrganizationServiceListOrganizationsPath = '/v1/organizations';
  static readonly OrganizationServiceCreateOrganizationPath = '/v1/organizations';
  static readonly OrganizationServiceCheckOrganizationIdPath = '/v1/organizations:checkId';
  static readonly OrganizationServiceGetOrganizationPath = '/v1/{name_12}';
  static readonly OrganizationServiceDeleteOrganizationPath = '/v1/{name_6}';
  static readonly OrganizationServiceUpdateOrganizationPath = '/v1/{organization.name}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Lists organizations with pagination.
   * Authorization:
   *   Scope: organizations:read
   *   Permission: organizations:read
   *   Domain: global
   * @param params The `OrganizationServiceService.OrganizationServiceListOrganizationsParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListOrganizations call.
   *
   * - `page_size`: Maximum number of organizations to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"Acme\"".
   *
   * @return A successful response.
   */
  OrganizationServiceListOrganizationsResponse(params: OrganizationServiceService.OrganizationServiceListOrganizationsParams): __Observable<__StrictHttpResponse<V1ListOrganizationsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/organizations`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListOrganizationsResponse>;
      })
    );
  }
  /**
   * Lists organizations with pagination.
   * Authorization:
   *   Scope: organizations:read
   *   Permission: organizations:read
   *   Domain: global
   * @param params The `OrganizationServiceService.OrganizationServiceListOrganizationsParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListOrganizations call.
   *
   * - `page_size`: Maximum number of organizations to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"Acme\"".
   *
   * @return A successful response.
   */
  OrganizationServiceListOrganizations(params: OrganizationServiceService.OrganizationServiceListOrganizationsParams): __Observable<V1ListOrganizationsResponse> {
    return this.OrganizationServiceListOrganizationsResponse(params).pipe(
      __map(_r => _r.body as V1ListOrganizationsResponse)
    );
  }

  /**
   * Creates a new organization.
   * Authorization:
   *   Scope: organizations:write
   *   Permission: organizations:create
   *   Domain: global
   * @param params The `OrganizationServiceService.OrganizationServiceCreateOrganizationParams` containing the following parameters:
   *
   * - `organization`: The organization to create.
   *
   * - `organization_id`: The ID to use for the organization. If not provided, a system-generated
   *   UUID will be used. Must be unique across all organizations.
   *
   * @return A successful response.
   */
  OrganizationServiceCreateOrganizationResponse(params: OrganizationServiceService.OrganizationServiceCreateOrganizationParams): __Observable<__StrictHttpResponse<V1Organization>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.organization;
    if (params.organizationId != null) __params = __params.set('organization_id', params.organizationId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/organizations`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Organization>;
      })
    );
  }
  /**
   * Creates a new organization.
   * Authorization:
   *   Scope: organizations:write
   *   Permission: organizations:create
   *   Domain: global
   * @param params The `OrganizationServiceService.OrganizationServiceCreateOrganizationParams` containing the following parameters:
   *
   * - `organization`: The organization to create.
   *
   * - `organization_id`: The ID to use for the organization. If not provided, a system-generated
   *   UUID will be used. Must be unique across all organizations.
   *
   * @return A successful response.
   */
  OrganizationServiceCreateOrganization(params: OrganizationServiceService.OrganizationServiceCreateOrganizationParams): __Observable<V1Organization> {
    return this.OrganizationServiceCreateOrganizationResponse(params).pipe(
      __map(_r => _r.body as V1Organization)
    );
  }

  /**
   * Checks whether an organization ID (slug) is available for use.
   * Authorization:
   *   Scope: organizations:read
   *   Permission: organizations:read
   *   Domain: global
   * @param body undefined
   * @return A successful response.
   */
  OrganizationServiceCheckOrganizationIdResponse(body: V1CheckOrganizationIdRequest): __Observable<__StrictHttpResponse<V1CheckOrganizationIdResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/organizations:checkId`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1CheckOrganizationIdResponse>;
      })
    );
  }
  /**
   * Checks whether an organization ID (slug) is available for use.
   * Authorization:
   *   Scope: organizations:read
   *   Permission: organizations:read
   *   Domain: global
   * @param body undefined
   * @return A successful response.
   */
  OrganizationServiceCheckOrganizationId(body: V1CheckOrganizationIdRequest): __Observable<V1CheckOrganizationIdResponse> {
    return this.OrganizationServiceCheckOrganizationIdResponse(body).pipe(
      __map(_r => _r.body as V1CheckOrganizationIdResponse)
    );
  }

  /**
   * Gets a single organization by resource name.
   * Authorization:
   *   Scope: organizations:read
   *   Permission: organizations:read
   *   Domain: global
   * @param name_12 The resource name of the organization.
   * Format: organizations/{organization}
   * @return A successful response.
   */
  OrganizationServiceGetOrganizationResponse(name12: string): __Observable<__StrictHttpResponse<V1Organization>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name12))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Organization>;
      })
    );
  }
  /**
   * Gets a single organization by resource name.
   * Authorization:
   *   Scope: organizations:read
   *   Permission: organizations:read
   *   Domain: global
   * @param name_12 The resource name of the organization.
   * Format: organizations/{organization}
   * @return A successful response.
   */
  OrganizationServiceGetOrganization(name12: string): __Observable<V1Organization> {
    return this.OrganizationServiceGetOrganizationResponse(name12).pipe(
      __map(_r => _r.body as V1Organization)
    );
  }

  /**
   * Permanently deletes an organization.
   * Authorization:
   *   Scope: organizations:write
   *   Permission: organizations:delete
   *   Domain: global
   * @param name_6 The resource name of the organization.
   * Format: organizations/{organization}
   * @return A successful response.
   */
  OrganizationServiceDeleteOrganizationResponse(name6: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name6))}`,
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
   * Permanently deletes an organization.
   * Authorization:
   *   Scope: organizations:write
   *   Permission: organizations:delete
   *   Domain: global
   * @param name_6 The resource name of the organization.
   * Format: organizations/{organization}
   * @return A successful response.
   */
  OrganizationServiceDeleteOrganization(name6: string): __Observable<{}> {
    return this.OrganizationServiceDeleteOrganizationResponse(name6).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Updates an existing organization.
   * Authorization:
   *   Scope: organizations:write
   *   Permission: organizations:update
   *   Domain: global
   * @param params The `OrganizationServiceService.OrganizationServiceUpdateOrganizationParams` containing the following parameters:
   *
   * - `organization.name`: The resource name of the organization.
   *   Format: organizations/{organization}
   *
   * - `organization`: The organization to update.
   *
   * @return A successful response.
   */
  OrganizationServiceUpdateOrganizationResponse(params: OrganizationServiceService.OrganizationServiceUpdateOrganizationParams): __Observable<__StrictHttpResponse<V1Organization>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.organization;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.organizationName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Organization>;
      })
    );
  }
  /**
   * Updates an existing organization.
   * Authorization:
   *   Scope: organizations:write
   *   Permission: organizations:update
   *   Domain: global
   * @param params The `OrganizationServiceService.OrganizationServiceUpdateOrganizationParams` containing the following parameters:
   *
   * - `organization.name`: The resource name of the organization.
   *   Format: organizations/{organization}
   *
   * - `organization`: The organization to update.
   *
   * @return A successful response.
   */
  OrganizationServiceUpdateOrganization(params: OrganizationServiceService.OrganizationServiceUpdateOrganizationParams): __Observable<V1Organization> {
    return this.OrganizationServiceUpdateOrganizationResponse(params).pipe(
      __map(_r => _r.body as V1Organization)
    );
  }
}

module OrganizationServiceService {

  /**
   * Parameters for OrganizationServiceListOrganizations
   */
  export interface OrganizationServiceListOrganizationsParams {

    /**
     * A page token from a previous ListOrganizations call.
     */
    pageToken?: string;

    /**
     * Maximum number of organizations to return. The service may return fewer.
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
     * Example: "display_name=\"Acme\"".
     */
    filter?: string;
  }

  /**
   * Parameters for OrganizationServiceCreateOrganization
   */
  export interface OrganizationServiceCreateOrganizationParams {

    /**
     * The organization to create.
     */
    organization: V1Organization;

    /**
     * The ID to use for the organization. If not provided, a system-generated
     * UUID will be used. Must be unique across all organizations.
     */
    organizationId?: string;
  }

  /**
   * Parameters for OrganizationServiceUpdateOrganization
   */
  export interface OrganizationServiceUpdateOrganizationParams {

    /**
     * The resource name of the organization.
     * Format: organizations/{organization}
     */
    organizationName: string;

    /**
     * The organization to update.
     */
    organization: {uid?: string, display_name: string, display_description?: string, start_month: V1Month, update_time?: string, create_time?: string, etag?: string};
  }
}

export { OrganizationServiceService }
