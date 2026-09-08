/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1Account } from '../models/v1account';
import { AccountServiceArchiveAccountBody } from '../models/account-service-archive-account-body';
import { V1GetNestedAccountResponse } from '../models/v1get-nested-account-response';
import { AccountServiceRestoreAccountBody } from '../models/account-service-restore-account-body';
import { V1ListAccountsResponse } from '../models/v1list-accounts-response';
import { V1ListNestedAccountsResponse } from '../models/v1list-nested-accounts-response';

/**
 * AccountService manages budget accounts in the chart of accounts.
 */
@Injectable({
  providedIn: 'root',
})
class AccountServiceService extends __BaseService {
  static readonly AccountServiceUpdateAccountPath = '/v1/{account.name}';
  static readonly AccountServiceGetAccountPath = '/v1/{name}';
  static readonly AccountServiceArchiveAccountPath = '/v1/{name}:archive';
  static readonly AccountServiceGetNestedAccountPath = '/v1/{name}:getNested';
  static readonly AccountServiceRestoreAccountPath = '/v1/{name}:restore';
  static readonly AccountServiceListAccountsPath = '/v1/{parent}/accounts';
  static readonly AccountServiceCreateAccountPath = '/v1/{parent}/accounts';
  static readonly AccountServiceListNestedAccountsPath = '/v1/{parent}/accounts:listNested';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Updates an existing account.
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:update
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceUpdateAccountParams` containing the following parameters:
   *
   * - `account.name`: The resource name of the account.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `account`: The account to update.
   *
   * @return A successful response.
   */
  AccountServiceUpdateAccountResponse(params: AccountServiceService.AccountServiceUpdateAccountParams): __Observable<__StrictHttpResponse<V1Account>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.account;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.accountName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Account>;
      })
    );
  }
  /**
   * Updates an existing account.
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:update
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceUpdateAccountParams` containing the following parameters:
   *
   * - `account.name`: The resource name of the account.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `account`: The account to update.
   *
   * @return A successful response.
   */
  AccountServiceUpdateAccount(params: AccountServiceService.AccountServiceUpdateAccountParams): __Observable<V1Account> {
    return this.AccountServiceUpdateAccountResponse(params).pipe(
      __map(_r => _r.body as V1Account)
    );
  }

  /**
   * Gets a single account by resource name.
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param name The resource name of the account.
   * Format: organizations/{organization}/accounts/{account}
   * @return A successful response.
   */
  AccountServiceGetAccountResponse(name: string): __Observable<__StrictHttpResponse<V1Account>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Account>;
      })
    );
  }
  /**
   * Gets a single account by resource name.
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param name The resource name of the account.
   * Format: organizations/{organization}/accounts/{account}
   * @return A successful response.
   */
  AccountServiceGetAccount(name: string): __Observable<V1Account> {
    return this.AccountServiceGetAccountResponse(name).pipe(
      __map(_r => _r.body as V1Account)
    );
  }

  /**
   * Archives an account (soft-delete).
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:archive
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceArchiveAccountParams` containing the following parameters:
   *
   * - `name`: The resource name of the account.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  AccountServiceArchiveAccountResponse(params: AccountServiceService.AccountServiceArchiveAccountParams): __Observable<__StrictHttpResponse<V1Account>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:archive`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Account>;
      })
    );
  }
  /**
   * Archives an account (soft-delete).
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:archive
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceArchiveAccountParams` containing the following parameters:
   *
   * - `name`: The resource name of the account.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  AccountServiceArchiveAccount(params: AccountServiceService.AccountServiceArchiveAccountParams): __Observable<V1Account> {
    return this.AccountServiceArchiveAccountResponse(params).pipe(
      __map(_r => _r.body as V1Account)
    );
  }

  /**
   * Gets a single account's full nested subtree (custom method).
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceGetNestedAccountParams` containing the following parameters:
   *
   * - `name`: The resource name of the root account for the subtree.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `filter`: Filter expression applied to all descendants in the subtree.
   *   Supported fields: is_archived.
   *   Example: "is_archived=false".
   *
   * @return A successful response.
   */
  AccountServiceGetNestedAccountResponse(params: AccountServiceService.AccountServiceGetNestedAccountParams): __Observable<__StrictHttpResponse<V1GetNestedAccountResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:getNested`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1GetNestedAccountResponse>;
      })
    );
  }
  /**
   * Gets a single account's full nested subtree (custom method).
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceGetNestedAccountParams` containing the following parameters:
   *
   * - `name`: The resource name of the root account for the subtree.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `filter`: Filter expression applied to all descendants in the subtree.
   *   Supported fields: is_archived.
   *   Example: "is_archived=false".
   *
   * @return A successful response.
   */
  AccountServiceGetNestedAccount(params: AccountServiceService.AccountServiceGetNestedAccountParams): __Observable<V1GetNestedAccountResponse> {
    return this.AccountServiceGetNestedAccountResponse(params).pipe(
      __map(_r => _r.body as V1GetNestedAccountResponse)
    );
  }

  /**
   * Restores an archived account (undo of ArchiveAccount).
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:restore
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceRestoreAccountParams` containing the following parameters:
   *
   * - `name`: The resource name of the account.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  AccountServiceRestoreAccountResponse(params: AccountServiceService.AccountServiceRestoreAccountParams): __Observable<__StrictHttpResponse<V1Account>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:restore`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Account>;
      })
    );
  }
  /**
   * Restores an archived account (undo of ArchiveAccount).
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:restore
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceRestoreAccountParams` containing the following parameters:
   *
   * - `name`: The resource name of the account.
   *   Format: organizations/{organization}/accounts/{account}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  AccountServiceRestoreAccount(params: AccountServiceService.AccountServiceRestoreAccountParams): __Observable<V1Account> {
    return this.AccountServiceRestoreAccountResponse(params).pipe(
      __map(_r => _r.body as V1Account)
    );
  }

  /**
   * Lists accounts with pagination.
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceListAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: If true, soft-deleted (archived) accounts are included in results.
   *   See AIP-132 for soft-delete guidance.
   *
   * - `page_token`: A page token from a previous ListAccounts call.
   *   Provide this to retrieve the next page.
   *
   * - `page_size`: Maximum number of accounts to return. The service may return fewer.
   *   If unspecified, at most 20 accounts will be returned. Maximum value is 100;
   *   values above 100 will be coerced to 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, display_code, is_archived.
   *   Example: "is_archived=true" or "display_name:foo".
   *
   * @return A successful response.
   */
  AccountServiceListAccountsResponse(params: AccountServiceService.AccountServiceListAccountsParams): __Observable<__StrictHttpResponse<V1ListAccountsResponse>> {
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
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accounts`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListAccountsResponse>;
      })
    );
  }
  /**
   * Lists accounts with pagination.
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceListAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: If true, soft-deleted (archived) accounts are included in results.
   *   See AIP-132 for soft-delete guidance.
   *
   * - `page_token`: A page token from a previous ListAccounts call.
   *   Provide this to retrieve the next page.
   *
   * - `page_size`: Maximum number of accounts to return. The service may return fewer.
   *   If unspecified, at most 20 accounts will be returned. Maximum value is 100;
   *   values above 100 will be coerced to 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, display_code, is_archived.
   *   Example: "is_archived=true" or "display_name:foo".
   *
   * @return A successful response.
   */
  AccountServiceListAccounts(params: AccountServiceService.AccountServiceListAccountsParams): __Observable<V1ListAccountsResponse> {
    return this.AccountServiceListAccountsResponse(params).pipe(
      __map(_r => _r.body as V1ListAccountsResponse)
    );
  }

  /**
   * Creates a new account.
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:create
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceCreateAccountParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `account`: The account to create.
   *
   * - `account_id`: The ID to use for the account. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  AccountServiceCreateAccountResponse(params: AccountServiceService.AccountServiceCreateAccountParams): __Observable<__StrictHttpResponse<V1Account>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.account;
    if (params.accountId != null) __params = __params.set('account_id', params.accountId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accounts`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Account>;
      })
    );
  }
  /**
   * Creates a new account.
   * Authorization:
   *   Scope: accounts:write
   *   Permission: accounts:create
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceCreateAccountParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `account`: The account to create.
   *
   * - `account_id`: The ID to use for the account. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  AccountServiceCreateAccount(params: AccountServiceService.AccountServiceCreateAccountParams): __Observable<V1Account> {
    return this.AccountServiceCreateAccountResponse(params).pipe(
      __map(_r => _r.body as V1Account)
    );
  }

  /**
   * Lists all root accounts with their full nested subtrees (custom method).
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceListNestedAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: is_archived.
   *   Example: "is_archived=true".
   *
   * @return A successful response.
   */
  AccountServiceListNestedAccountsResponse(params: AccountServiceService.AccountServiceListNestedAccountsParams): __Observable<__StrictHttpResponse<V1ListNestedAccountsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/accounts:listNested`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListNestedAccountsResponse>;
      })
    );
  }
  /**
   * Lists all root accounts with their full nested subtrees (custom method).
   * Authorization:
   *   Scope: accounts:read
   *   Permission: accounts:read
   *   Domain: organization-scoped
   * @param params The `AccountServiceService.AccountServiceListNestedAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: is_archived.
   *   Example: "is_archived=true".
   *
   * @return A successful response.
   */
  AccountServiceListNestedAccounts(params: AccountServiceService.AccountServiceListNestedAccountsParams): __Observable<V1ListNestedAccountsResponse> {
    return this.AccountServiceListNestedAccountsResponse(params).pipe(
      __map(_r => _r.body as V1ListNestedAccountsResponse)
    );
  }
}

module AccountServiceService {

  /**
   * Parameters for AccountServiceUpdateAccount
   */
  export interface AccountServiceUpdateAccountParams {

    /**
     * The resource name of the account.
     * Format: organizations/{organization}/accounts/{account}
     */
    accountName: string;

    /**
     * The account to update.
     */
    account: {uid?: string, parent_account?: string, display_name: string, display_code: string, display_description?: string, is_container?: boolean, is_archived?: boolean, update_time?: string, create_time?: string, etag?: string};
  }

  /**
   * Parameters for AccountServiceArchiveAccount
   */
  export interface AccountServiceArchiveAccountParams {

    /**
     * The resource name of the account.
     * Format: organizations/{organization}/accounts/{account}
     */
    name: string;
    body: AccountServiceArchiveAccountBody;
  }

  /**
   * Parameters for AccountServiceGetNestedAccount
   */
  export interface AccountServiceGetNestedAccountParams {

    /**
     * The resource name of the root account for the subtree.
     * Format: organizations/{organization}/accounts/{account}
     */
    name: string;

    /**
     * Filter expression applied to all descendants in the subtree.
     * Supported fields: is_archived.
     * Example: "is_archived=false".
     */
    filter?: string;
  }

  /**
   * Parameters for AccountServiceRestoreAccount
   */
  export interface AccountServiceRestoreAccountParams {

    /**
     * The resource name of the account.
     * Format: organizations/{organization}/accounts/{account}
     */
    name: string;
    body: AccountServiceRestoreAccountBody;
  }

  /**
   * Parameters for AccountServiceListAccounts
   */
  export interface AccountServiceListAccountsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * If true, soft-deleted (archived) accounts are included in results.
     * See AIP-132 for soft-delete guidance.
     */
    showDeleted?: boolean;

    /**
     * A page token from a previous ListAccounts call.
     * Provide this to retrieve the next page.
     */
    pageToken?: string;

    /**
     * Maximum number of accounts to return. The service may return fewer.
     * If unspecified, at most 20 accounts will be returned. Maximum value is 100;
     * values above 100 will be coerced to 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "display_name", "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: display_name, display_code, is_archived.
     * Example: "is_archived=true" or "display_name:foo".
     */
    filter?: string;
  }

  /**
   * Parameters for AccountServiceCreateAccount
   */
  export interface AccountServiceCreateAccountParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The account to create.
     */
    account: V1Account;

    /**
     * The ID to use for the account. If not provided, a system-generated UUID
     * will be used. Must be unique within the parent organization.
     */
    accountId?: string;
  }

  /**
   * Parameters for AccountServiceListNestedAccounts
   */
  export interface AccountServiceListNestedAccountsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: is_archived.
     * Example: "is_archived=true".
     */
    filter?: string;
  }
}

export { AccountServiceService }
