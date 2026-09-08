/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1Budget } from '../models/v1budget';
import { TypeDate } from '../models/type-date';
import { BudgetServiceCloseBudgetBody } from '../models/budget-service-close-budget-body';
import { V1ListBudgetsResponse } from '../models/v1list-budgets-response';

/**
 * BudgetService manages financial budgets.
 */
@Injectable({
  providedIn: 'root',
})
class BudgetServiceService extends __BaseService {
  static readonly BudgetServiceUpdateBudgetPath = '/v1/{budget.name}';
  static readonly BudgetServiceDeleteBudgetPath = '/v1/{name_2}';
  static readonly BudgetServiceGetBudgetPath = '/v1/{name_4}';
  static readonly BudgetServiceCloseBudgetPath = '/v1/{name}:close';
  static readonly BudgetServiceListBudgetsPath = '/v1/{parent}/budgets';
  static readonly BudgetServiceCreateBudgetPath = '/v1/{parent}/budgets';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing budget.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:update
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceUpdateBudgetParams` containing the following parameters:
   *
   * - `budget.name`: The resource name of the budget.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `budget`: The budget to update.
   *
   * @return A successful response.
   */
  BudgetServiceUpdateBudgetResponse(params: BudgetServiceService.BudgetServiceUpdateBudgetParams): __Observable<__StrictHttpResponse<V1Budget>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.budget;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.budgetName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Budget>;
      })
    );
  }
  /**
   * Updates an existing budget.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:update
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceUpdateBudgetParams` containing the following parameters:
   *
   * - `budget.name`: The resource name of the budget.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `budget`: The budget to update.
   *
   * @return A successful response.
   */
  BudgetServiceUpdateBudget(params: BudgetServiceService.BudgetServiceUpdateBudgetParams): __Observable<V1Budget> {
    return this.BudgetServiceUpdateBudgetResponse(params).pipe(
      __map(_r => _r.body as V1Budget)
    );
  }

  /**
   * Permanently deletes a budget.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:delete
   *   Domain: organization-scoped
   * @param name_2 The resource name of the budget.
   * Format: organizations/{organization}/budgets/{budget}
   * @return A successful response.
   */
  BudgetServiceDeleteBudgetResponse(name2: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name2))}`,
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
   * Permanently deletes a budget.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:delete
   *   Domain: organization-scoped
   * @param name_2 The resource name of the budget.
   * Format: organizations/{organization}/budgets/{budget}
   * @return A successful response.
   */
  BudgetServiceDeleteBudget(name2: string): __Observable<{}> {
    return this.BudgetServiceDeleteBudgetResponse(name2).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Gets a single budget by resource name.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param name_4 The resource name of the budget.
   * Format: organizations/{organization}/budgets/{budget}
   * @return A successful response.
   */
  BudgetServiceGetBudgetResponse(name4: string): __Observable<__StrictHttpResponse<V1Budget>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
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
        return _r as __StrictHttpResponse<V1Budget>;
      })
    );
  }
  /**
   * Gets a single budget by resource name.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param name_4 The resource name of the budget.
   * Format: organizations/{organization}/budgets/{budget}
   * @return A successful response.
   */
  BudgetServiceGetBudget(name4: string): __Observable<V1Budget> {
    return this.BudgetServiceGetBudgetResponse(name4).pipe(
      __map(_r => _r.body as V1Budget)
    );
  }

  /**
   * Closes a budget, marking it as no longer active.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:close
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceCloseBudgetParams` containing the following parameters:
   *
   * - `name`: The resource name of the budget to close.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  BudgetServiceCloseBudgetResponse(params: BudgetServiceService.BudgetServiceCloseBudgetParams): __Observable<__StrictHttpResponse<V1Budget>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:close`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Budget>;
      })
    );
  }
  /**
   * Closes a budget, marking it as no longer active.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:close
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceCloseBudgetParams` containing the following parameters:
   *
   * - `name`: The resource name of the budget to close.
   *   Format: organizations/{organization}/budgets/{budget}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  BudgetServiceCloseBudget(params: BudgetServiceService.BudgetServiceCloseBudgetParams): __Observable<V1Budget> {
    return this.BudgetServiceCloseBudgetResponse(params).pipe(
      __map(_r => _r.body as V1Budget)
    );
  }

  /**
   * Lists budgets with pagination.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceListBudgetsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: If true, closed budgets are included in results.
   *
   * - `page_token`: A page token from a previous ListBudgets call.
   *
   * - `page_size`: Maximum number of budgets to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "period_start desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, is_closed.
   *   Example: "is_closed=false" or "display_name=\"FY2025\"".
   *
   * @return A successful response.
   */
  BudgetServiceListBudgetsResponse(params: BudgetServiceService.BudgetServiceListBudgetsParams): __Observable<__StrictHttpResponse<V1ListBudgetsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.showDeleted != null) __params = __params.set('show_deleted', params.showDeleted.toString());
    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/budgets`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListBudgetsResponse>;
      })
    );
  }
  /**
   * Lists budgets with pagination.
   * Authorization:
   *   Scope: budgets:read
   *   Permission: budgets:read
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceListBudgetsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: If true, closed budgets are included in results.
   *
   * - `page_token`: A page token from a previous ListBudgets call.
   *
   * - `page_size`: Maximum number of budgets to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "period_start desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, is_closed.
   *   Example: "is_closed=false" or "display_name=\"FY2025\"".
   *
   * @return A successful response.
   */
  BudgetServiceListBudgets(params: BudgetServiceService.BudgetServiceListBudgetsParams): __Observable<V1ListBudgetsResponse> {
    return this.BudgetServiceListBudgetsResponse(params).pipe(
      __map(_r => _r.body as V1ListBudgetsResponse)
    );
  }

  /**
   * Creates a new budget.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:create
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceCreateBudgetParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `budget`: The budget to create.
   *
   * - `budget_id`: The ID to use for the budget. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  BudgetServiceCreateBudgetResponse(params: BudgetServiceService.BudgetServiceCreateBudgetParams): __Observable<__StrictHttpResponse<V1Budget>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.budget;
    if (params.budgetId != null) __params = __params.set('budget_id', params.budgetId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/budgets`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Budget>;
      })
    );
  }
  /**
   * Creates a new budget.
   * Authorization:
   *   Scope: budgets:write
   *   Permission: budgets:create
   *   Domain: organization-scoped
   * @param params The `BudgetServiceService.BudgetServiceCreateBudgetParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `budget`: The budget to create.
   *
   * - `budget_id`: The ID to use for the budget. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  BudgetServiceCreateBudget(params: BudgetServiceService.BudgetServiceCreateBudgetParams): __Observable<V1Budget> {
    return this.BudgetServiceCreateBudgetResponse(params).pipe(
      __map(_r => _r.body as V1Budget)
    );
  }
}

module BudgetServiceService {

  /**
   * Parameters for BudgetServiceUpdateBudget
   */
  export interface BudgetServiceUpdateBudgetParams {

    /**
     * The resource name of the budget.
     * Format: organizations/{organization}/budgets/{budget}
     */
    budgetName: string;

    /**
     * The budget to update.
     */
    budget: {uid?: string, display_name: string, display_description?: string, is_closed?: boolean, period_start: TypeDate, period_end: TypeDate, update_time?: string, create_time?: string, etag?: string, is_published?: boolean, publish_actual_values?: boolean, publish_actual_values_until?: TypeDate};
  }

  /**
   * Parameters for BudgetServiceCloseBudget
   */
  export interface BudgetServiceCloseBudgetParams {

    /**
     * The resource name of the budget to close.
     * Format: organizations/{organization}/budgets/{budget}
     */
    name: string;
    body: BudgetServiceCloseBudgetBody;
  }

  /**
   * Parameters for BudgetServiceListBudgets
   */
  export interface BudgetServiceListBudgetsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * If true, closed budgets are included in results.
     */
    showDeleted?: boolean;

    /**
     * A page token from a previous ListBudgets call.
     */
    pageToken?: string;

    /**
     * Maximum number of budgets to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "display_name", "period_start desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: display_name, is_closed.
     * Example: "is_closed=false" or "display_name=\"FY2025\"".
     */
    filter?: string;
  }

  /**
   * Parameters for BudgetServiceCreateBudget
   */
  export interface BudgetServiceCreateBudgetParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The budget to create.
     */
    budget: V1Budget;

    /**
     * The ID to use for the budget. If not provided, a system-generated UUID
     * will be used. Must be unique within the parent organization.
     */
    budgetId?: string;
  }
}

export { BudgetServiceService }
