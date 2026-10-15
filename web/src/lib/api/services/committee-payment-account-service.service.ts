/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1CommitteePaymentAccount } from '../models/v1committee-payment-account';
import { V1ListCommitteePaymentAccountsResponse } from '../models/v1list-committee-payment-accounts-response';
import { V1PaymentAccountKind } from '../models/v1payment-account-kind';

/**
 * CommitteePaymentAccountService manages the payment accounts held by a
 * committee.
 */
@Injectable({
  providedIn: 'root',
})
class CommitteePaymentAccountServiceService extends __BaseService {
  static readonly CommitteePaymentAccountServiceGetCommitteePaymentAccountPath = '/v1/{name_11}';
  static readonly CommitteePaymentAccountServiceDeleteCommitteePaymentAccountPath = '/v1/{name_6}';
  static readonly CommitteePaymentAccountServiceListCommitteePaymentAccountsPath = '/v1/{parent}/paymentAccounts';
  static readonly CommitteePaymentAccountServiceCreateCommitteePaymentAccountPath = '/v1/{parent}/paymentAccounts';
  static readonly CommitteePaymentAccountServiceUpdateCommitteePaymentAccountPath = '/v1/{payment_account.name}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single payment account by resource name.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param name_11 The resource name of the payment account.
   * Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
   * @return A successful response.
   */
  CommitteePaymentAccountServiceGetCommitteePaymentAccountResponse(name11: string): __Observable<__StrictHttpResponse<V1CommitteePaymentAccount>> {
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
        return _r as __StrictHttpResponse<V1CommitteePaymentAccount>;
      })
    );
  }
  /**
   * Gets a single payment account by resource name.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param name_11 The resource name of the payment account.
   * Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
   * @return A successful response.
   */
  CommitteePaymentAccountServiceGetCommitteePaymentAccount(name11: string): __Observable<V1CommitteePaymentAccount> {
    return this.CommitteePaymentAccountServiceGetCommitteePaymentAccountResponse(name11).pipe(
      __map(_r => _r.body as V1CommitteePaymentAccount)
    );
  }

  /**
   * Deletes a payment account. Submissions that reference the account keep
   * their stored label snapshot.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param name_6 The resource name of the payment account.
   * Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
   * @return A successful response.
   */
  CommitteePaymentAccountServiceDeleteCommitteePaymentAccountResponse(name6: string): __Observable<__StrictHttpResponse<{}>> {
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
   * Deletes a payment account. Submissions that reference the account keep
   * their stored label snapshot.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param name_6 The resource name of the payment account.
   * Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
   * @return A successful response.
   */
  CommitteePaymentAccountServiceDeleteCommitteePaymentAccount(name6: string): __Observable<{}> {
    return this.CommitteePaymentAccountServiceDeleteCommitteePaymentAccountResponse(name6).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists the payment accounts of a committee.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param params The `CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceListCommitteePaymentAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `page_token`: A page token from a previous ListCommitteePaymentAccounts call.
   *
   * - `page_size`: Maximum number of payment accounts to return. The service may return
   *   fewer. If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  CommitteePaymentAccountServiceListCommitteePaymentAccountsResponse(params: CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceListCommitteePaymentAccountsParams): __Observable<__StrictHttpResponse<V1ListCommitteePaymentAccountsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/paymentAccounts`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListCommitteePaymentAccountsResponse>;
      })
    );
  }
  /**
   * Lists the payment accounts of a committee.
   * Authorization:
   *   Scope: committees:read
   *   Permission: committees:read
   *   Domain: organization-scoped
   * @param params The `CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceListCommitteePaymentAccountsParams` containing the following parameters:
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `page_token`: A page token from a previous ListCommitteePaymentAccounts call.
   *
   * - `page_size`: Maximum number of payment accounts to return. The service may return
   *   fewer. If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  CommitteePaymentAccountServiceListCommitteePaymentAccounts(params: CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceListCommitteePaymentAccountsParams): __Observable<V1ListCommitteePaymentAccountsResponse> {
    return this.CommitteePaymentAccountServiceListCommitteePaymentAccountsResponse(params).pipe(
      __map(_r => _r.body as V1ListCommitteePaymentAccountsResponse)
    );
  }

  /**
   * Creates a payment account held by a committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceCreateCommitteePaymentAccountParams` containing the following parameters:
   *
   * - `payment_account`: The payment account to create.
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `payment_account_id`: The ID to use for the payment account. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent committee.
   *
   * @return A successful response.
   */
  CommitteePaymentAccountServiceCreateCommitteePaymentAccountResponse(params: CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceCreateCommitteePaymentAccountParams): __Observable<__StrictHttpResponse<V1CommitteePaymentAccount>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.paymentAccount;

    if (params.paymentAccountId != null) __params = __params.set('payment_account_id', params.paymentAccountId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/paymentAccounts`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1CommitteePaymentAccount>;
      })
    );
  }
  /**
   * Creates a payment account held by a committee.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceCreateCommitteePaymentAccountParams` containing the following parameters:
   *
   * - `payment_account`: The payment account to create.
   *
   * - `parent`: The parent committee resource name.
   *   Format: organizations/{organization}/committees/{committee}
   *
   * - `payment_account_id`: The ID to use for the payment account. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent committee.
   *
   * @return A successful response.
   */
  CommitteePaymentAccountServiceCreateCommitteePaymentAccount(params: CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceCreateCommitteePaymentAccountParams): __Observable<V1CommitteePaymentAccount> {
    return this.CommitteePaymentAccountServiceCreateCommitteePaymentAccountResponse(params).pipe(
      __map(_r => _r.body as V1CommitteePaymentAccount)
    );
  }

  /**
   * Updates an existing payment account.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceUpdateCommitteePaymentAccountParams` containing the following parameters:
   *
   * - `payment_account.name`: The resource name of the payment account.
   *   Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
   *
   * - `payment_account`: The payment account to update.
   *
   * @return A successful response.
   */
  CommitteePaymentAccountServiceUpdateCommitteePaymentAccountResponse(params: CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceUpdateCommitteePaymentAccountParams): __Observable<__StrictHttpResponse<V1CommitteePaymentAccount>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.paymentAccount;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.paymentAccountName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1CommitteePaymentAccount>;
      })
    );
  }
  /**
   * Updates an existing payment account.
   * Authorization:
   *   Scope: committees:write
   *   Permission: committees:update
   *   Domain: organization-scoped
   * @param params The `CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceUpdateCommitteePaymentAccountParams` containing the following parameters:
   *
   * - `payment_account.name`: The resource name of the payment account.
   *   Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
   *
   * - `payment_account`: The payment account to update.
   *
   * @return A successful response.
   */
  CommitteePaymentAccountServiceUpdateCommitteePaymentAccount(params: CommitteePaymentAccountServiceService.CommitteePaymentAccountServiceUpdateCommitteePaymentAccountParams): __Observable<V1CommitteePaymentAccount> {
    return this.CommitteePaymentAccountServiceUpdateCommitteePaymentAccountResponse(params).pipe(
      __map(_r => _r.body as V1CommitteePaymentAccount)
    );
  }
}

module CommitteePaymentAccountServiceService {

  /**
   * Parameters for CommitteePaymentAccountServiceListCommitteePaymentAccounts
   */
  export interface CommitteePaymentAccountServiceListCommitteePaymentAccountsParams {

    /**
     * The parent committee resource name.
     * Format: organizations/{organization}/committees/{committee}
     */
    parent: string;

    /**
     * A page token from a previous ListCommitteePaymentAccounts call.
     */
    pageToken?: string;

    /**
     * Maximum number of payment accounts to return. The service may return
     * fewer. If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;
  }

  /**
   * Parameters for CommitteePaymentAccountServiceCreateCommitteePaymentAccount
   */
  export interface CommitteePaymentAccountServiceCreateCommitteePaymentAccountParams {

    /**
     * The payment account to create.
     */
    paymentAccount: V1CommitteePaymentAccount;

    /**
     * The parent committee resource name.
     * Format: organizations/{organization}/committees/{committee}
     */
    parent: string;

    /**
     * The ID to use for the payment account. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent committee.
     */
    paymentAccountId?: string;
  }

  /**
   * Parameters for CommitteePaymentAccountServiceUpdateCommitteePaymentAccount
   */
  export interface CommitteePaymentAccountServiceUpdateCommitteePaymentAccountParams {

    /**
     * The resource name of the payment account.
     * Format: organizations/{organization}/committees/{committee}/paymentAccounts/{payment_account}
     */
    paymentAccountName: string;

    /**
     * The payment account to update.
     */
    paymentAccount: {uid?: string, committee?: string, kind: V1PaymentAccountKind, display_label: string, create_time?: string};
  }
}

export { CommitteePaymentAccountServiceService }
