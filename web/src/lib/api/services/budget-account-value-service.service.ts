/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1BudgetAccountValue } from '../models/v1budget-account-value';
import { V1Decimal } from '../models/v1decimal';
import { V1ListBudgetAccountValuesResponse } from '../models/v1list-budget-account-values-response';
import { V1BatchUpdateBudgetAccountValuesResponse } from '../models/v1batch-update-budget-account-values-response';
import { BudgetAccountValueServiceBatchUpdateBudgetAccountValuesBody } from '../models/budget-account-value-service-batch-update-budget-account-values-body';

/**
 * BudgetAccountValueService manages per-account value assignments within a budget.
 */
@Injectable({
  providedIn: 'root',
})
class BudgetAccountValueServiceService extends __BaseService {
  static readonly BudgetAccountValueServiceUpdateBudgetAccountValuePath = '/v1/{account_value.name}';
  static readonly BudgetAccountValueServiceDeleteBudgetAccountValuePath = '/v1/{name_3}';
  static readonly BudgetAccountValueServiceGetBudgetAccountValuePath = '/v1/{name_5}';
  static readonly BudgetAccountValueServiceListBudgetAccountValuesPath = '/v1/{parent}/accountValues';
  static readonly BudgetAccountValueServiceCreateBudgetAccountValuePath = '/v1/{parent}/accountValues';
  static readonly BudgetAccountValueServiceBatchUpdateBudgetAccountValuesPath = '/v1/{parent}/accountValues:batchUpdate';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing budget account value.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:update
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceUpdateBudgetAccountValueParams` containing the following parameters:
   *
   * - `account_value.name`: The resource name of the budget account value.
   *   Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
   *
   * - `account_value`: The budget account value to update.
   *
   * - `allow_missing`: If set to true, and the resource is not found, a new resource will be
   *   created. In this situation, update_mask is ignored.
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceUpdateBudgetAccountValueResponse(params: BudgetAccountValueServiceService.BudgetAccountValueServiceUpdateBudgetAccountValueParams): __Observable<__StrictHttpResponse<V1BudgetAccountValue>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.accountValue;
    if (params.allowMissing != null) __params = __params.set('allow_missing', params.allowMissing.toString());
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.accountValueName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1BudgetAccountValue>;
      })
    );
  }
  /**
   * Updates an existing budget account value.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:update
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceUpdateBudgetAccountValueParams` containing the following parameters:
   *
   * - `account_value.name`: The resource name of the budget account value.
   *   Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
   *
   * - `account_value`: The budget account value to update.
   *
   * - `allow_missing`: If set to true, and the resource is not found, a new resource will be
   *   created. In this situation, update_mask is ignored.
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceUpdateBudgetAccountValue(params: BudgetAccountValueServiceService.BudgetAccountValueServiceUpdateBudgetAccountValueParams): __Observable<V1BudgetAccountValue> {
    return this.BudgetAccountValueServiceUpdateBudgetAccountValueResponse(params).pipe(
      __map(_r => _r.body as V1BudgetAccountValue)
    );
  }

  /**
   * Permanently deletes a budget account value.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:delete
   *   Domain: organization-scoped
   * @param name_3 The resource name of the budget account value.
   * Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
   * @return A successful response.
   */
  BudgetAccountValueServiceDeleteBudgetAccountValueResponse(name3: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name3))}`,
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
   * Permanently deletes a budget account value.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:delete
   *   Domain: organization-scoped
   * @param name_3 The resource name of the budget account value.
   * Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
   * @return A successful response.
   */
  BudgetAccountValueServiceDeleteBudgetAccountValue(name3: string): __Observable<{}> {
    return this.BudgetAccountValueServiceDeleteBudgetAccountValueResponse(name3).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Gets a single budget account value by resource name.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param name_5 The resource name of the budget account value.
   * Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
   * @return A successful response.
   */
  BudgetAccountValueServiceGetBudgetAccountValueResponse(name5: string): __Observable<__StrictHttpResponse<V1BudgetAccountValue>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
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
        return _r as __StrictHttpResponse<V1BudgetAccountValue>;
      })
    );
  }
  /**
   * Gets a single budget account value by resource name.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param name_5 The resource name of the budget account value.
   * Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
   * @return A successful response.
   */
  BudgetAccountValueServiceGetBudgetAccountValue(name5: string): __Observable<V1BudgetAccountValue> {
    return this.BudgetAccountValueServiceGetBudgetAccountValueResponse(name5).pipe(
      __map(_r => _r.body as V1BudgetAccountValue)
    );
  }

  /**
   * Lists account values for a budget.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceListBudgetAccountValuesParams` containing the following parameters:
   *
   * - `parent`: The parent budget resource name.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `page_token`: A page token from a previous ListBudgetAccountValues call.
   *
   * - `page_size`: Maximum number of values to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account.
   *   Example: "account=\"organizations/{organization}/accounts/{account}\"".
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceListBudgetAccountValuesResponse(params: BudgetAccountValueServiceService.BudgetAccountValueServiceListBudgetAccountValuesParams): __Observable<__StrictHttpResponse<V1ListBudgetAccountValuesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accountValues`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListBudgetAccountValuesResponse>;
      })
    );
  }
  /**
   * Lists account values for a budget.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceListBudgetAccountValuesParams` containing the following parameters:
   *
   * - `parent`: The parent budget resource name.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `page_token`: A page token from a previous ListBudgetAccountValues call.
   *
   * - `page_size`: Maximum number of values to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account.
   *   Example: "account=\"organizations/{organization}/accounts/{account}\"".
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceListBudgetAccountValues(params: BudgetAccountValueServiceService.BudgetAccountValueServiceListBudgetAccountValuesParams): __Observable<V1ListBudgetAccountValuesResponse> {
    return this.BudgetAccountValueServiceListBudgetAccountValuesResponse(params).pipe(
      __map(_r => _r.body as V1ListBudgetAccountValuesResponse)
    );
  }

  /**
   * Creates a new budget account value.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:create
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceCreateBudgetAccountValueParams` containing the following parameters:
   *
   * - `parent`: The parent budget resource name.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `account_value`: The budget account value to create.
   *
   * - `budget_account_value_id`: The ID to use for the budget account value. If not provided, a
   *   system-generated UUID will be used. Must be unique within the parent budget.
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceCreateBudgetAccountValueResponse(params: BudgetAccountValueServiceService.BudgetAccountValueServiceCreateBudgetAccountValueParams): __Observable<__StrictHttpResponse<V1BudgetAccountValue>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.accountValue;
    if (params.budgetAccountValueId != null) __params = __params.set('budget_account_value_id', params.budgetAccountValueId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accountValues`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1BudgetAccountValue>;
      })
    );
  }
  /**
   * Creates a new budget account value.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:create
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceCreateBudgetAccountValueParams` containing the following parameters:
   *
   * - `parent`: The parent budget resource name.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `account_value`: The budget account value to create.
   *
   * - `budget_account_value_id`: The ID to use for the budget account value. If not provided, a
   *   system-generated UUID will be used. Must be unique within the parent budget.
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceCreateBudgetAccountValue(params: BudgetAccountValueServiceService.BudgetAccountValueServiceCreateBudgetAccountValueParams): __Observable<V1BudgetAccountValue> {
    return this.BudgetAccountValueServiceCreateBudgetAccountValueResponse(params).pipe(
      __map(_r => _r.body as V1BudgetAccountValue)
    );
  }

  /**
   * Atomically upserts multiple account values for a budget.
   * Existing values for listed account IDs are updated; missing ones are created.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:update
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceBatchUpdateBudgetAccountValuesParams` containing the following parameters:
   *
   * - `parent`: The parent resource shared by all budget account values being updated.
   *   Format: organizations/{organization}/budgets/{budget}
   *   If set, the parent field in each UpdateBudgetAccountValueRequest must
   *   either be empty or match this field.
   *
   * - `body`:
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceBatchUpdateBudgetAccountValuesResponse(params: BudgetAccountValueServiceService.BudgetAccountValueServiceBatchUpdateBudgetAccountValuesParams): __Observable<__StrictHttpResponse<V1BatchUpdateBudgetAccountValuesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accountValues:batchUpdate`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1BatchUpdateBudgetAccountValuesResponse>;
      })
    );
  }
  /**
   * Atomically upserts multiple account values for a budget.
   * Existing values for listed account IDs are updated; missing ones are created.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:update
   *   Domain: organization-scoped
   * @param params The `BudgetAccountValueServiceService.BudgetAccountValueServiceBatchUpdateBudgetAccountValuesParams` containing the following parameters:
   *
   * - `parent`: The parent resource shared by all budget account values being updated.
   *   Format: organizations/{organization}/budgets/{budget}
   *   If set, the parent field in each UpdateBudgetAccountValueRequest must
   *   either be empty or match this field.
   *
   * - `body`:
   *
   * @return A successful response.
   */
  BudgetAccountValueServiceBatchUpdateBudgetAccountValues(params: BudgetAccountValueServiceService.BudgetAccountValueServiceBatchUpdateBudgetAccountValuesParams): __Observable<V1BatchUpdateBudgetAccountValuesResponse> {
    return this.BudgetAccountValueServiceBatchUpdateBudgetAccountValuesResponse(params).pipe(
      __map(_r => _r.body as V1BatchUpdateBudgetAccountValuesResponse)
    );
  }
}

module BudgetAccountValueServiceService {

  /**
   * Parameters for BudgetAccountValueServiceUpdateBudgetAccountValue
   */
  export interface BudgetAccountValueServiceUpdateBudgetAccountValueParams {

    /**
     * The resource name of the budget account value.
     * Format: organizations/{organization}/budgets/{budget}/accountValues/{account_value}
     */
    accountValueName: string;

    /**
     * The budget account value to update.
     */
    accountValue: {uid?: string, budget?: string, account: string, value: V1Decimal, update_time?: string, create_time?: string, etag?: string};

    /**
     * If set to true, and the resource is not found, a new resource will be
     * created. In this situation, update_mask is ignored.
     */
    allowMissing?: boolean;
  }

  /**
   * Parameters for BudgetAccountValueServiceListBudgetAccountValues
   */
  export interface BudgetAccountValueServiceListBudgetAccountValuesParams {

    /**
     * The parent budget resource name.
     * Format: organizations/{organization}/budgets/{budget}
     */
    parent: string;

    /**
     * A page token from a previous ListBudgetAccountValues call.
     */
    pageToken?: string;

    /**
     * Maximum number of values to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "create_time desc").
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
   * Parameters for BudgetAccountValueServiceCreateBudgetAccountValue
   */
  export interface BudgetAccountValueServiceCreateBudgetAccountValueParams {

    /**
     * The parent budget resource name.
     * Format: organizations/{organization}/budgets/{budget}
     */
    parent: string;

    /**
     * The budget account value to create.
     */
    accountValue: V1BudgetAccountValue;

    /**
     * The ID to use for the budget account value. If not provided, a
     * system-generated UUID will be used. Must be unique within the parent budget.
     */
    budgetAccountValueId?: string;
  }

  /**
   * Parameters for BudgetAccountValueServiceBatchUpdateBudgetAccountValues
   */
  export interface BudgetAccountValueServiceBatchUpdateBudgetAccountValuesParams {

    /**
     * The parent resource shared by all budget account values being updated.
     * Format: organizations/{organization}/budgets/{budget}
     * If set, the parent field in each UpdateBudgetAccountValueRequest must
     * either be empty or match this field.
     */
    parent: string;
    body: BudgetAccountValueServiceBatchUpdateBudgetAccountValuesBody;
  }
}

export { BudgetAccountValueServiceService }
