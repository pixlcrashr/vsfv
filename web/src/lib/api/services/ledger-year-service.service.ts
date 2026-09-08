/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1LedgerYear } from '../models/v1ledger-year';
import { LedgerYearServiceCloseLedgerYearBody } from '../models/ledger-year-service-close-ledger-year-body';
import { V1ListLedgerYearsResponse } from '../models/v1list-ledger-years-response';
@Injectable({
  providedIn: 'root',
})
class LedgerYearServiceService extends __BaseService {
  static readonly LedgerYearServiceGetLedgerYearPath = '/v1/{name_11}';
  static readonly LedgerYearServiceCloseLedgerYearPath = '/v1/{name_1}:close';
  static readonly LedgerYearServiceListLedgerYearsPath = '/v1/{parent}/ledgerYears';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single ledger year by resource name.
   * Authorization:
   *   Scope: ledgerYear:read
   *   Permission: ledgerYear:read
   *   Domain: organization-scoped
   * @param name_11 The resource name of the ledger year.
   * Format: organizations/{organization}/ledgerYears/{ledger_year}
   * @return A successful response.
   */
  LedgerYearServiceGetLedgerYearResponse(name11: string): __Observable<__StrictHttpResponse<V1LedgerYear>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name11))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1LedgerYear>;
      })
    );
  }
  /**
   * Gets a single ledger year by resource name.
   * Authorization:
   *   Scope: ledgerYear:read
   *   Permission: ledgerYear:read
   *   Domain: organization-scoped
   * @param name_11 The resource name of the ledger year.
   * Format: organizations/{organization}/ledgerYears/{ledger_year}
   * @return A successful response.
   */
  LedgerYearServiceGetLedgerYear(name11: string): __Observable<V1LedgerYear> {
    return this.LedgerYearServiceGetLedgerYearResponse(name11).pipe(
      __map(_r => _r.body as V1LedgerYear)
    );
  }

  /**
   * Closes a ledger year, preventing new imports.
   * Authorization:
   *   Scope: ledgerYear:write
   *   Permission: ledgerYear:close
   *   Domain: organization-scoped
   * @param params The `LedgerYearServiceService.LedgerYearServiceCloseLedgerYearParams` containing the following parameters:
   *
   * - `name_1`: The resource name of the ledger year to close.
   *   Format: organizations/{organization}/ledgerYears/{ledger_year}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  LedgerYearServiceCloseLedgerYearResponse(params: LedgerYearServiceService.LedgerYearServiceCloseLedgerYearParams): __Observable<__StrictHttpResponse<V1LedgerYear>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name1))}:close`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1LedgerYear>;
      })
    );
  }
  /**
   * Closes a ledger year, preventing new imports.
   * Authorization:
   *   Scope: ledgerYear:write
   *   Permission: ledgerYear:close
   *   Domain: organization-scoped
   * @param params The `LedgerYearServiceService.LedgerYearServiceCloseLedgerYearParams` containing the following parameters:
   *
   * - `name_1`: The resource name of the ledger year to close.
   *   Format: organizations/{organization}/ledgerYears/{ledger_year}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  LedgerYearServiceCloseLedgerYear(params: LedgerYearServiceService.LedgerYearServiceCloseLedgerYearParams): __Observable<V1LedgerYear> {
    return this.LedgerYearServiceCloseLedgerYearResponse(params).pipe(
      __map(_r => _r.body as V1LedgerYear)
    );
  }

  /**
   * Lists ledger years for an organization.
   * Authorization:
   *   Scope: ledgerYear:read
   *   Permission: ledgerYear:read
   *   Domain: organization-scoped
   * @param params The `LedgerYearServiceService.LedgerYearServiceListLedgerYearsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListLedgerYears call.
   *
   * - `page_size`: Maximum number of ledger years to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "year desc", "create_time").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: year, is_closed.
   *   Example: "is_closed=false" or "year=2025".
   *
   * @return A successful response.
   */
  LedgerYearServiceListLedgerYearsResponse(params: LedgerYearServiceService.LedgerYearServiceListLedgerYearsParams): __Observable<__StrictHttpResponse<V1ListLedgerYearsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/ledgerYears`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListLedgerYearsResponse>;
      })
    );
  }
  /**
   * Lists ledger years for an organization.
   * Authorization:
   *   Scope: ledgerYear:read
   *   Permission: ledgerYear:read
   *   Domain: organization-scoped
   * @param params The `LedgerYearServiceService.LedgerYearServiceListLedgerYearsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListLedgerYears call.
   *
   * - `page_size`: Maximum number of ledger years to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "year desc", "create_time").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: year, is_closed.
   *   Example: "is_closed=false" or "year=2025".
   *
   * @return A successful response.
   */
  LedgerYearServiceListLedgerYears(params: LedgerYearServiceService.LedgerYearServiceListLedgerYearsParams): __Observable<V1ListLedgerYearsResponse> {
    return this.LedgerYearServiceListLedgerYearsResponse(params).pipe(
      __map(_r => _r.body as V1ListLedgerYearsResponse)
    );
  }
}

module LedgerYearServiceService {

  /**
   * Parameters for LedgerYearServiceCloseLedgerYear
   */
  export interface LedgerYearServiceCloseLedgerYearParams {

    /**
     * The resource name of the ledger year to close.
     * Format: organizations/{organization}/ledgerYears/{ledger_year}
     */
    name1: string;
    body: LedgerYearServiceCloseLedgerYearBody;
  }

  /**
   * Parameters for LedgerYearServiceListLedgerYears
   */
  export interface LedgerYearServiceListLedgerYearsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * A page token from a previous ListLedgerYears call.
     */
    pageToken?: string;

    /**
     * Maximum number of ledger years to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "year desc", "create_time").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: year, is_closed.
     * Example: "is_closed=false" or "year=2025".
     */
    filter?: string;
  }
}

export { LedgerYearServiceService }
