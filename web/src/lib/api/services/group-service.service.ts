/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1ListGroupsResponse } from '../models/v1list-groups-response';
import { V1Group } from '../models/v1group';
import { GroupServiceAddUserToGroupBody } from '../models/group-service-add-user-to-group-body';
import { GroupServiceRemoveUserFromGroupBody } from '../models/group-service-remove-user-from-group-body';

/**
 * GroupService manages groups and their per-organization permission policies.
 */
@Injectable({
  providedIn: 'root',
})
class GroupServiceService extends __BaseService {
  static readonly GroupServiceListGroupsPath = '/v1/groups';
  static readonly GroupServiceCreateGroupPath = '/v1/groups';
  static readonly GroupServiceUpdateGroupPath = '/v1/{group.name}';
  static readonly GroupServiceDeleteGroupPath = '/v1/{name_4}';
  static readonly GroupServiceGetGroupPath = '/v1/{name_9}';
  static readonly GroupServiceAddUserToGroupPath = '/v1/{name}:addUser';
  static readonly GroupServiceRemoveUserFromGroupPath = '/v1/{name}:removeUser';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Lists groups with pagination.
   * Authorization:
   *   Scope: groups:read
   *   Permission: groups:read
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceListGroupsParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListGroups call.
   *
   * - `page_size`: Maximum number of groups to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *
   * @return A successful response.
   */
  GroupServiceListGroupsResponse(params: GroupServiceService.GroupServiceListGroupsParams): __Observable<__StrictHttpResponse<V1ListGroupsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/groups`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListGroupsResponse>;
      })
    );
  }
  /**
   * Lists groups with pagination.
   * Authorization:
   *   Scope: groups:read
   *   Permission: groups:read
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceListGroupsParams` containing the following parameters:
   *
   * - `page_token`: A page token from a previous ListGroups call.
   *
   * - `page_size`: Maximum number of groups to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *
   * @return A successful response.
   */
  GroupServiceListGroups(params: GroupServiceService.GroupServiceListGroupsParams): __Observable<V1ListGroupsResponse> {
    return this.GroupServiceListGroupsResponse(params).pipe(
      __map(_r => _r.body as V1ListGroupsResponse)
    );
  }

  /**
   * Creates a new group.
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:create
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceCreateGroupParams` containing the following parameters:
   *
   * - `group`: The group to create.
   *
   * - `group_id`: The ID to use for the group. If not provided, a system-generated UUID
   *   will be used. Must be unique across all groups.
   *
   * @return A successful response.
   */
  GroupServiceCreateGroupResponse(params: GroupServiceService.GroupServiceCreateGroupParams): __Observable<__StrictHttpResponse<V1Group>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.group;
    if (params.groupId != null) __params = __params.set('group_id', params.groupId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/groups`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Group>;
      })
    );
  }
  /**
   * Creates a new group.
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:create
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceCreateGroupParams` containing the following parameters:
   *
   * - `group`: The group to create.
   *
   * - `group_id`: The ID to use for the group. If not provided, a system-generated UUID
   *   will be used. Must be unique across all groups.
   *
   * @return A successful response.
   */
  GroupServiceCreateGroup(params: GroupServiceService.GroupServiceCreateGroupParams): __Observable<V1Group> {
    return this.GroupServiceCreateGroupResponse(params).pipe(
      __map(_r => _r.body as V1Group)
    );
  }

  /**
   * Updates an existing group.
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:update
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceUpdateGroupParams` containing the following parameters:
   *
   * - `group.name`: The resource name of the group.
   *   Format: groups/{group}
   *
   * - `group`: The group to update.
   *
   * @return A successful response.
   */
  GroupServiceUpdateGroupResponse(params: GroupServiceService.GroupServiceUpdateGroupParams): __Observable<__StrictHttpResponse<V1Group>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.group;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.groupName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Group>;
      })
    );
  }
  /**
   * Updates an existing group.
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:update
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceUpdateGroupParams` containing the following parameters:
   *
   * - `group.name`: The resource name of the group.
   *   Format: groups/{group}
   *
   * - `group`: The group to update.
   *
   * @return A successful response.
   */
  GroupServiceUpdateGroup(params: GroupServiceService.GroupServiceUpdateGroupParams): __Observable<V1Group> {
    return this.GroupServiceUpdateGroupResponse(params).pipe(
      __map(_r => _r.body as V1Group)
    );
  }

  /**
   * Permanently deletes a group.
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:delete
   *   Domain: global
   * @param name_4 The resource name of the group.
   * Format: groups/{group}
   * @return A successful response.
   */
  GroupServiceDeleteGroupResponse(name4: string): __Observable<__StrictHttpResponse<{}>> {
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
   * Permanently deletes a group.
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:delete
   *   Domain: global
   * @param name_4 The resource name of the group.
   * Format: groups/{group}
   * @return A successful response.
   */
  GroupServiceDeleteGroup(name4: string): __Observable<{}> {
    return this.GroupServiceDeleteGroupResponse(name4).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Gets a single group by resource name.
   * Authorization:
   *   Scope: groups:read
   *   Permission: groups:read
   *   Domain: global
   * @param name_9 The resource name of the group.
   * Format: groups/{group}
   * @return A successful response.
   */
  GroupServiceGetGroupResponse(name9: string): __Observable<__StrictHttpResponse<V1Group>> {
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
        return _r as __StrictHttpResponse<V1Group>;
      })
    );
  }
  /**
   * Gets a single group by resource name.
   * Authorization:
   *   Scope: groups:read
   *   Permission: groups:read
   *   Domain: global
   * @param name_9 The resource name of the group.
   * Format: groups/{group}
   * @return A successful response.
   */
  GroupServiceGetGroup(name9: string): __Observable<V1Group> {
    return this.GroupServiceGetGroupResponse(name9).pipe(
      __map(_r => _r.body as V1Group)
    );
  }

  /**
   * Adds a user to a group (custom method, AIP-136).
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:update
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceAddUserToGroupParams` containing the following parameters:
   *
   * - `name`: The resource name of the group.
   *   Format: groups/{group}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  GroupServiceAddUserToGroupResponse(params: GroupServiceService.GroupServiceAddUserToGroupParams): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:addUser`,
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
   * Adds a user to a group (custom method, AIP-136).
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:update
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceAddUserToGroupParams` containing the following parameters:
   *
   * - `name`: The resource name of the group.
   *   Format: groups/{group}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  GroupServiceAddUserToGroup(params: GroupServiceService.GroupServiceAddUserToGroupParams): __Observable<{}> {
    return this.GroupServiceAddUserToGroupResponse(params).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Removes a user from a group (custom method, AIP-136).
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:update
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceRemoveUserFromGroupParams` containing the following parameters:
   *
   * - `name`: The resource name of the group.
   *   Format: groups/{group}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  GroupServiceRemoveUserFromGroupResponse(params: GroupServiceService.GroupServiceRemoveUserFromGroupParams): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:removeUser`,
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
   * Removes a user from a group (custom method, AIP-136).
   * Authorization:
   *   Scope: groups:write
   *   Permission: groups:update
   *   Domain: global
   * @param params The `GroupServiceService.GroupServiceRemoveUserFromGroupParams` containing the following parameters:
   *
   * - `name`: The resource name of the group.
   *   Format: groups/{group}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  GroupServiceRemoveUserFromGroup(params: GroupServiceService.GroupServiceRemoveUserFromGroupParams): __Observable<{}> {
    return this.GroupServiceRemoveUserFromGroupResponse(params).pipe(
      __map(_r => _r.body as {})
    );
  }
}

module GroupServiceService {

  /**
   * Parameters for GroupServiceListGroups
   */
  export interface GroupServiceListGroupsParams {

    /**
     * A page token from a previous ListGroups call.
     */
    pageToken?: string;

    /**
     * Maximum number of groups to return. The service may return fewer.
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
     */
    filter?: string;
  }

  /**
   * Parameters for GroupServiceCreateGroup
   */
  export interface GroupServiceCreateGroupParams {

    /**
     * The group to create.
     */
    group: V1Group;

    /**
     * The ID to use for the group. If not provided, a system-generated UUID
     * will be used. Must be unique across all groups.
     */
    groupId?: string;
  }

  /**
   * Parameters for GroupServiceUpdateGroup
   */
  export interface GroupServiceUpdateGroupParams {

    /**
     * The resource name of the group.
     * Format: groups/{group}
     */
    groupName: string;

    /**
     * The group to update.
     */
    group: {uid?: string, display_name: string, display_description?: string, organizations?: Array<string>, permissions?: Array<string>, update_time?: string, create_time?: string, etag?: string};
  }

  /**
   * Parameters for GroupServiceAddUserToGroup
   */
  export interface GroupServiceAddUserToGroupParams {

    /**
     * The resource name of the group.
     * Format: groups/{group}
     */
    name: string;
    body: GroupServiceAddUserToGroupBody;
  }

  /**
   * Parameters for GroupServiceRemoveUserFromGroup
   */
  export interface GroupServiceRemoveUserFromGroupParams {

    /**
     * The resource name of the group.
     * Format: groups/{group}
     */
    name: string;
    body: GroupServiceRemoveUserFromGroupBody;
  }
}

export { GroupServiceService }
