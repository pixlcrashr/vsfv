/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1LedgerAccount } from '../models/v1ledger-account';
import { V1AccountType } from '../models/v1account-type';
import { V1ListLedgerAccountsResponse } from '../models/v1list-ledger-accounts-response';
import { V1BatchGetLedgerAccountsResponse } from '../models/v1batch-get-ledger-accounts-response';
@Injectable({
  providedIn: 'root',
})
class LedgerAccountServiceService extends __BaseService {
  static readonly LedgerAccountServiceUpdateLedgerAccountPath = '/v1/{ledger_account.name}';
  static readonly LedgerAccountServiceGetLedgerAccountPath = '/v1/{name_10}';
  static readonly LedgerAccountServiceDeleteLedgerAccountPath = '/v1/{name_5}';
  static readonly LedgerAccountServiceListLedgerAccountsPath = '/v1/{parent}/ledgerAccounts';
  static readonly LedgerAccountServiceBatchGetLedgerAccountsPath = '/v1/{parent}/ledgerAccounts:batchGet';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing ledger account (e.g., display name).
   * Authorization:
   *   Scope: ledgerAccount:write
   *   Permission: ledgerAccount:update
   *   Domain: organization-scoped
   * @param params The `LedgerAccountServiceService.LedgerAccountServiceUpdateLedgerAccountParams` containing the following parameters:
   *
   * - `ledger_account.name`: The resource name of the ledger account.
   *   Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   *
   * - `ledger_account`: The ledger account to update.
   *
   * @return A successful response.
   */
  LedgerAccountServiceUpdateLedgerAccountResponse(params: LedgerAccountServiceService.LedgerAccountServiceUpdateLedgerAccountParams): __Observable<__StrictHttpResponse<V1LedgerAccount>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.ledgerAccount;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.ledgerAccountName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1LedgerAccount>;
      })
    );
  }
  /**
   * Updates an existing ledger account (e.g., display name).
   * Authorization:
   *   Scope: ledgerAccount:write
   *   Permission: ledgerAccount:update
   *   Domain: organization-scoped
   * @param params The `LedgerAccountServiceService.LedgerAccountServiceUpdateLedgerAccountParams` containing the following parameters:
   *
   * - `ledger_account.name`: The resource name of the ledger account.
   *   Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   *
   * - `ledger_account`: The ledger account to update.
   *
   * @return A successful response.
   */
  LedgerAccountServiceUpdateLedgerAccount(params: LedgerAccountServiceService.LedgerAccountServiceUpdateLedgerAccountParams): __Observable<V1LedgerAccount> {
    return this.LedgerAccountServiceUpdateLedgerAccountResponse(params).pipe(
      __map(_r => _r.body as V1LedgerAccount)
    );
  }

  /**
   * Gets a single ledger account by resource name.
   * Authorization:
   *   Scope: ledgerAccount:read
   *   Permission: ledgerAccount:read
   *   Domain: organization-scoped
   * @param name_10 The resource name of the ledger account.
   * Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   * @return A successful response.
   */
  LedgerAccountServiceGetLedgerAccountResponse(name10: string): __Observable<__StrictHttpResponse<V1LedgerAccount>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name10))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1LedgerAccount>;
      })
    );
  }
  /**
   * Gets a single ledger account by resource name.
   * Authorization:
   *   Scope: ledgerAccount:read
   *   Permission: ledgerAccount:read
   *   Domain: organization-scoped
   * @param name_10 The resource name of the ledger account.
   * Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   * @return A successful response.
   */
  LedgerAccountServiceGetLedgerAccount(name10: string): __Observable<V1LedgerAccount> {
    return this.LedgerAccountServiceGetLedgerAccountResponse(name10).pipe(
      __map(_r => _r.body as V1LedgerAccount)
    );
  }

  /**
   * Permanently deletes a ledger account.
   * Authorization:
   *   Scope: ledgerAccount:write
   *   Permission: ledgerAccount:delete
   *   Domain: organization-scoped
   * @param name_5 The resource name of the ledger account.
   * Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   * @return A successful response.
   */
  LedgerAccountServiceDeleteLedgerAccountResponse(name5: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
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
        return _r as __StrictHttpResponse<{}>;
      })
    );
  }
  /**
   * Permanently deletes a ledger account.
   * Authorization:
   *   Scope: ledgerAccount:write
   *   Permission: ledgerAccount:delete
   *   Domain: organization-scoped
   * @param name_5 The resource name of the ledger account.
   * Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   * @return A successful response.
   */
  LedgerAccountServiceDeleteLedgerAccount(name5: string): __Observable<{}> {
    return this.LedgerAccountServiceDeleteLedgerAccountResponse(name5).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists ledger accounts with pagination.
   * Authorization:
   *   Scope: ledgerAccount:read
   *   Permission: ledgerAccount:read
   *   Domain: organization-scoped
   * @param params The `LedgerAccountServiceService.LedgerAccountServiceListLedgerAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: Include archived/soft-deleted ledger accounts. Default is false.
   *
   * - `page_token`: A page token from a previous ListLedgerAccounts call.
   *
   * - `page_size`: Maximum number of accounts to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "code", "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: code, account_type, display_name.
   *   Example: "account_type=ASSET" or "code:\"1000\"".
   *
   * @return A successful response.
   */
  LedgerAccountServiceListLedgerAccountsResponse(params: LedgerAccountServiceService.LedgerAccountServiceListLedgerAccountsParams): __Observable<__StrictHttpResponse<V1ListLedgerAccountsResponse>> {
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
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/ledgerAccounts`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListLedgerAccountsResponse>;
      })
    );
  }
  /**
   * Lists ledger accounts with pagination.
   * Authorization:
   *   Scope: ledgerAccount:read
   *   Permission: ledgerAccount:read
   *   Domain: organization-scoped
   * @param params The `LedgerAccountServiceService.LedgerAccountServiceListLedgerAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: Include archived/soft-deleted ledger accounts. Default is false.
   *
   * - `page_token`: A page token from a previous ListLedgerAccounts call.
   *
   * - `page_size`: Maximum number of accounts to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "code", "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: code, account_type, display_name.
   *   Example: "account_type=ASSET" or "code:\"1000\"".
   *
   * @return A successful response.
   */
  LedgerAccountServiceListLedgerAccounts(params: LedgerAccountServiceService.LedgerAccountServiceListLedgerAccountsParams): __Observable<V1ListLedgerAccountsResponse> {
    return this.LedgerAccountServiceListLedgerAccountsResponse(params).pipe(
      __map(_r => _r.body as V1ListLedgerAccountsResponse)
    );
  }

  /**
   * Batch gets ledger accounts by resource name.
   * Authorization:
   *   Scope: ledgerAccount:read
   *   Permission: ledgerAccount:read
   *   Domain: organization-scoped
   * @param params The `LedgerAccountServiceService.LedgerAccountServiceBatchGetLedgerAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `names`: The resource names of the ledger accounts to retrieve.
   *   A maximum of 1000 ledger accounts can be retrieved in a batch.
   *   Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   *
   * @return A successful response.
   */
  LedgerAccountServiceBatchGetLedgerAccountsResponse(params: LedgerAccountServiceService.LedgerAccountServiceBatchGetLedgerAccountsParams): __Observable<__StrictHttpResponse<V1BatchGetLedgerAccountsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    (params.names || []).forEach(val => {if (val != null) __params = __params.append('names', val.toString())});
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/ledgerAccounts:batchGet`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1BatchGetLedgerAccountsResponse>;
      })
    );
  }
  /**
   * Batch gets ledger accounts by resource name.
   * Authorization:
   *   Scope: ledgerAccount:read
   *   Permission: ledgerAccount:read
   *   Domain: organization-scoped
   * @param params The `LedgerAccountServiceService.LedgerAccountServiceBatchGetLedgerAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `names`: The resource names of the ledger accounts to retrieve.
   *   A maximum of 1000 ledger accounts can be retrieved in a batch.
   *   Format: organizations/{organization}/ledgerAccounts/{ledger_account}
   *
   * @return A successful response.
   */
  LedgerAccountServiceBatchGetLedgerAccounts(params: LedgerAccountServiceService.LedgerAccountServiceBatchGetLedgerAccountsParams): __Observable<V1BatchGetLedgerAccountsResponse> {
    return this.LedgerAccountServiceBatchGetLedgerAccountsResponse(params).pipe(
      __map(_r => _r.body as V1BatchGetLedgerAccountsResponse)
    );
  }
}

module LedgerAccountServiceService {

  /**
   * Parameters for LedgerAccountServiceUpdateLedgerAccount
   */
  export interface LedgerAccountServiceUpdateLedgerAccountParams {

    /**
     * The resource name of the ledger account.
     * Format: organizations/{organization}/ledgerAccounts/{ledger_account}
     */
    ledgerAccountName: string;

    /**
     * The ledger account to update.
     */
    ledgerAccount: {uid?: string, code: string, account_type: V1AccountType, display_name?: string, display_description?: string, update_time?: string, create_time?: string, etag?: string};
  }

  /**
   * Parameters for LedgerAccountServiceListLedgerAccounts
   */
  export interface LedgerAccountServiceListLedgerAccountsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * Include archived/soft-deleted ledger accounts. Default is false.
     */
    showDeleted?: boolean;

    /**
     * A page token from a previous ListLedgerAccounts call.
     */
    pageToken?: string;

    /**
     * Maximum number of accounts to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "code", "display_name", "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: code, account_type, display_name.
     * Example: "account_type=ASSET" or "code:\"1000\"".
     */
    filter?: string;
  }

  /**
   * Parameters for LedgerAccountServiceBatchGetLedgerAccounts
   */
  export interface LedgerAccountServiceBatchGetLedgerAccountsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The resource names of the ledger accounts to retrieve.
     * A maximum of 1000 ledger accounts can be retrieved in a batch.
     * Format: organizations/{organization}/ledgerAccounts/{ledger_account}
     */
    names: Array<string>;
  }
}

export { LedgerAccountServiceService }
