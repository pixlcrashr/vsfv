/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1BudgetRevisionAccountValue } from '../models/v1budget-revision-account-value';
import { V1ListBudgetRevisionAccountValuesResponse } from '../models/v1list-budget-revision-account-values-response';

/**
 * BudgetRevisionAccountValueService provides read-only access to the
 * per-account values captured within a BudgetRevision. All resources in this
 * service are immutable and server-managed.
 */
@Injectable({
  providedIn: 'root',
})
class BudgetRevisionAccountValueServiceService extends __BaseService {
  static readonly BudgetRevisionAccountValueServiceGetBudgetRevisionAccountValuePath = '/v1/{name_8}';
  static readonly BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesPath = '/v1/{parent_1}/accountValues';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single budget revision account value by resource name.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param name_8 The resource name of the budget revision account value.
   * Format: organizations/{organization}/budgets/{budget}/revisions/{revision}/accountValues/{account_value}
   * @return A successful response.
   */
  BudgetRevisionAccountValueServiceGetBudgetRevisionAccountValueResponse(name8: string): __Observable<__StrictHttpResponse<V1BudgetRevisionAccountValue>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
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
        return _r as __StrictHttpResponse<V1BudgetRevisionAccountValue>;
      })
    );
  }
  /**
   * Gets a single budget revision account value by resource name.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param name_8 The resource name of the budget revision account value.
   * Format: organizations/{organization}/budgets/{budget}/revisions/{revision}/accountValues/{account_value}
   * @return A successful response.
   */
  BudgetRevisionAccountValueServiceGetBudgetRevisionAccountValue(name8: string): __Observable<V1BudgetRevisionAccountValue> {
    return this.BudgetRevisionAccountValueServiceGetBudgetRevisionAccountValueResponse(name8).pipe(
      __map(_r => _r.body as V1BudgetRevisionAccountValue)
    );
  }

  /**
   * Lists the account values captured in a revision, with pagination.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param params The `BudgetRevisionAccountValueServiceService.BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesParams` containing the following parameters:
   *
   * - `parent_1`: The parent revision resource name.
   *   Format: organizations/{organization}/budgets/{budget}/revisions/{revision}
   *
   * - `page_token`: A page token from a previous ListBudgetRevisionAccountValues call.
   *
   * - `page_size`: Maximum number of account values to return. The service may return fewer.
   *   If unspecified, at most 50 are returned. Maximum value is 200.
   *
   * - `order_by`: Order by expression (e.g. "account", "value desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account.
   *   Example: "account=\"organizations/{organization}/accounts/{account}\"".
   *
   * @return A successful response.
   */
  BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesResponse(params: BudgetRevisionAccountValueServiceService.BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesParams): __Observable<__StrictHttpResponse<V1ListBudgetRevisionAccountValuesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent1))}/accountValues`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListBudgetRevisionAccountValuesResponse>;
      })
    );
  }
  /**
   * Lists the account values captured in a revision, with pagination.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param params The `BudgetRevisionAccountValueServiceService.BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesParams` containing the following parameters:
   *
   * - `parent_1`: The parent revision resource name.
   *   Format: organizations/{organization}/budgets/{budget}/revisions/{revision}
   *
   * - `page_token`: A page token from a previous ListBudgetRevisionAccountValues call.
   *
   * - `page_size`: Maximum number of account values to return. The service may return fewer.
   *   If unspecified, at most 50 are returned. Maximum value is 200.
   *
   * - `order_by`: Order by expression (e.g. "account", "value desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: account.
   *   Example: "account=\"organizations/{organization}/accounts/{account}\"".
   *
   * @return A successful response.
   */
  BudgetRevisionAccountValueServiceListBudgetRevisionAccountValues(params: BudgetRevisionAccountValueServiceService.BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesParams): __Observable<V1ListBudgetRevisionAccountValuesResponse> {
    return this.BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesResponse(params).pipe(
      __map(_r => _r.body as V1ListBudgetRevisionAccountValuesResponse)
    );
  }
}

module BudgetRevisionAccountValueServiceService {

  /**
   * Parameters for BudgetRevisionAccountValueServiceListBudgetRevisionAccountValues
   */
  export interface BudgetRevisionAccountValueServiceListBudgetRevisionAccountValuesParams {

    /**
     * The parent revision resource name.
     * Format: organizations/{organization}/budgets/{budget}/revisions/{revision}
     */
    parent1: string;

    /**
     * A page token from a previous ListBudgetRevisionAccountValues call.
     */
    pageToken?: string;

    /**
     * Maximum number of account values to return. The service may return fewer.
     * If unspecified, at most 50 are returned. Maximum value is 200.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "account", "value desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: account.
     * Example: "account=\"organizations/{organization}/accounts/{account}\"".
     */
    filter?: string;
  }
}

export { BudgetRevisionAccountValueServiceService }
