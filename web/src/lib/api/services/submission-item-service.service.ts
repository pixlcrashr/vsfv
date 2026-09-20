/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1SubmissionItem } from '../models/v1submission-item';
import { V1DocumentForm } from '../models/v1document-form';
import { V1Decimal } from '../models/v1decimal';
import { V1ListSubmissionItemsResponse } from '../models/v1list-submission-items-response';

/**
 * SubmissionItemService manages the bills/receipts and income documents of a
 * submission.
 */
@Injectable({
  providedIn: 'root',
})
class SubmissionItemServiceService extends __BaseService {
  static readonly SubmissionItemServiceUpdateSubmissionItemPath = '/v1/{item.name}';
  static readonly SubmissionItemServiceGetSubmissionItemPath = '/v1/{name_14}';
  static readonly SubmissionItemServiceDeleteSubmissionItemPath = '/v1/{name_8}';
  static readonly SubmissionItemServiceListSubmissionItemsPath = '/v1/{parent}/items';
  static readonly SubmissionItemServiceCreateSubmissionItemPath = '/v1/{parent}/items';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing item. Only allowed while the submission is in DRAFT,
   * PENDING or FURTHER_INFO_REQUIRED state, and only by the submitter or the
   * treasury.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionItemServiceService.SubmissionItemServiceUpdateSubmissionItemParams` containing the following parameters:
   *
   * - `item.name`: The resource name of the item.
   *   Format: organizations/{organization}/submissions/{submission}/items/{item}
   *
   * - `item`: The item to update.
   *
   * @return A successful response.
   */
  SubmissionItemServiceUpdateSubmissionItemResponse(params: SubmissionItemServiceService.SubmissionItemServiceUpdateSubmissionItemParams): __Observable<__StrictHttpResponse<V1SubmissionItem>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.item;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.itemName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1SubmissionItem>;
      })
    );
  }
  /**
   * Updates an existing item. Only allowed while the submission is in DRAFT,
   * PENDING or FURTHER_INFO_REQUIRED state, and only by the submitter or the
   * treasury.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionItemServiceService.SubmissionItemServiceUpdateSubmissionItemParams` containing the following parameters:
   *
   * - `item.name`: The resource name of the item.
   *   Format: organizations/{organization}/submissions/{submission}/items/{item}
   *
   * - `item`: The item to update.
   *
   * @return A successful response.
   */
  SubmissionItemServiceUpdateSubmissionItem(params: SubmissionItemServiceService.SubmissionItemServiceUpdateSubmissionItemParams): __Observable<V1SubmissionItem> {
    return this.SubmissionItemServiceUpdateSubmissionItemResponse(params).pipe(
      __map(_r => _r.body as V1SubmissionItem)
    );
  }

  /**
   * Gets a single item by resource name.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param name_14 The resource name of the item.
   * Format: organizations/{organization}/submissions/{submission}/items/{item}
   * @return A successful response.
   */
  SubmissionItemServiceGetSubmissionItemResponse(name14: string): __Observable<__StrictHttpResponse<V1SubmissionItem>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name14))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1SubmissionItem>;
      })
    );
  }
  /**
   * Gets a single item by resource name.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param name_14 The resource name of the item.
   * Format: organizations/{organization}/submissions/{submission}/items/{item}
   * @return A successful response.
   */
  SubmissionItemServiceGetSubmissionItem(name14: string): __Observable<V1SubmissionItem> {
    return this.SubmissionItemServiceGetSubmissionItemResponse(name14).pipe(
      __map(_r => _r.body as V1SubmissionItem)
    );
  }

  /**
   * Removes an item from the submission. Only allowed while the submission is
   * in DRAFT, PENDING or FURTHER_INFO_REQUIRED state, and only by the
   * submitter or the treasury.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:delete or submissions:update_own
   *   Domain: organization-scoped
   * @param name_8 The resource name of the item.
   * Format: organizations/{organization}/submissions/{submission}/items/{item}
   * @return A successful response.
   */
  SubmissionItemServiceDeleteSubmissionItemResponse(name8: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name8))}`,
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
   * Removes an item from the submission. Only allowed while the submission is
   * in DRAFT, PENDING or FURTHER_INFO_REQUIRED state, and only by the
   * submitter or the treasury.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:delete or submissions:update_own
   *   Domain: organization-scoped
   * @param name_8 The resource name of the item.
   * Format: organizations/{organization}/submissions/{submission}/items/{item}
   * @return A successful response.
   */
  SubmissionItemServiceDeleteSubmissionItem(name8: string): __Observable<{}> {
    return this.SubmissionItemServiceDeleteSubmissionItemResponse(name8).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists the items of a submission.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param params The `SubmissionItemServiceService.SubmissionItemServiceListSubmissionItemsParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `page_token`: A page token from a previous ListSubmissionItems call.
   *
   * - `page_size`: Maximum number of items to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  SubmissionItemServiceListSubmissionItemsResponse(params: SubmissionItemServiceService.SubmissionItemServiceListSubmissionItemsParams): __Observable<__StrictHttpResponse<V1ListSubmissionItemsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/items`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListSubmissionItemsResponse>;
      })
    );
  }
  /**
   * Lists the items of a submission.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param params The `SubmissionItemServiceService.SubmissionItemServiceListSubmissionItemsParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `page_token`: A page token from a previous ListSubmissionItems call.
   *
   * - `page_size`: Maximum number of items to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  SubmissionItemServiceListSubmissionItems(params: SubmissionItemServiceService.SubmissionItemServiceListSubmissionItemsParams): __Observable<V1ListSubmissionItemsResponse> {
    return this.SubmissionItemServiceListSubmissionItemsResponse(params).pipe(
      __map(_r => _r.body as V1ListSubmissionItemsResponse)
    );
  }

  /**
   * Creates a new item. Only allowed while the submission is in DRAFT,
   * PENDING or FURTHER_INFO_REQUIRED state, and only by the submitter or the
   * treasury.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:create or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionItemServiceService.SubmissionItemServiceCreateSubmissionItemParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `item`: The item to create.
   *
   * - `item_id`: The ID to use for the item. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent submission.
   *
   * @return A successful response.
   */
  SubmissionItemServiceCreateSubmissionItemResponse(params: SubmissionItemServiceService.SubmissionItemServiceCreateSubmissionItemParams): __Observable<__StrictHttpResponse<V1SubmissionItem>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.item;
    if (params.itemId != null) __params = __params.set('item_id', params.itemId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/items`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1SubmissionItem>;
      })
    );
  }
  /**
   * Creates a new item. Only allowed while the submission is in DRAFT,
   * PENDING or FURTHER_INFO_REQUIRED state, and only by the submitter or the
   * treasury.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:create or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionItemServiceService.SubmissionItemServiceCreateSubmissionItemParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `item`: The item to create.
   *
   * - `item_id`: The ID to use for the item. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent submission.
   *
   * @return A successful response.
   */
  SubmissionItemServiceCreateSubmissionItem(params: SubmissionItemServiceService.SubmissionItemServiceCreateSubmissionItemParams): __Observable<V1SubmissionItem> {
    return this.SubmissionItemServiceCreateSubmissionItemResponse(params).pipe(
      __map(_r => _r.body as V1SubmissionItem)
    );
  }
}

module SubmissionItemServiceService {

  /**
   * Parameters for SubmissionItemServiceUpdateSubmissionItem
   */
  export interface SubmissionItemServiceUpdateSubmissionItemParams {

    /**
     * The resource name of the item.
     * Format: organizations/{organization}/submissions/{submission}/items/{item}
     */
    itemName: string;

    /**
     * The item to update.
     */
    item: {uid?: string, public_id?: string, category?: string, document_form?: V1DocumentForm, source?: string, description?: string, amount: V1Decimal, original_receive_time?: string, original_received_by?: string};
  }

  /**
   * Parameters for SubmissionItemServiceListSubmissionItems
   */
  export interface SubmissionItemServiceListSubmissionItemsParams {

    /**
     * The parent submission resource name.
     * Format: organizations/{organization}/submissions/{submission}
     */
    parent: string;

    /**
     * A page token from a previous ListSubmissionItems call.
     */
    pageToken?: string;

    /**
     * Maximum number of items to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;
  }

  /**
   * Parameters for SubmissionItemServiceCreateSubmissionItem
   */
  export interface SubmissionItemServiceCreateSubmissionItemParams {

    /**
     * The parent submission resource name.
     * Format: organizations/{organization}/submissions/{submission}
     */
    parent: string;

    /**
     * The item to create.
     */
    item: V1SubmissionItem;

    /**
     * The ID to use for the item. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent submission.
     */
    itemId?: string;
  }
}

export { SubmissionItemServiceService }
