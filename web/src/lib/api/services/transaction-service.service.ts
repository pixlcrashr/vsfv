/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1Transaction } from '../models/v1transaction';
import { V1ListTransactionsResponse } from '../models/v1list-transactions-response';
import { V1Decimal } from '../models/v1decimal';
@Injectable({
  providedIn: 'root',
})
class TransactionServiceService extends __BaseService {
  static readonly TransactionServiceGetTransactionPath = '/v1/{name_15}';
  static readonly TransactionServiceDeleteTransactionPath = '/v1/{name_9}';
  static readonly TransactionServiceListTransactionsPath = '/v1/{parent}/transactions';
  static readonly TransactionServiceCreateTransactionPath = '/v1/{parent}/transactions';
  static readonly TransactionServiceUpdateTransactionPath = '/v1/{transaction.name}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single transaction by resource name.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param name_15 The resource name of the transaction.
   * Format: organizations/{organization}/transactions/{transaction}
   * @return A successful response.
   */
  TransactionServiceGetTransactionResponse(name15: string): __Observable<__StrictHttpResponse<V1Transaction>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name15))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Transaction>;
      })
    );
  }
  /**
   * Gets a single transaction by resource name.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param name_15 The resource name of the transaction.
   * Format: organizations/{organization}/transactions/{transaction}
   * @return A successful response.
   */
  TransactionServiceGetTransaction(name15: string): __Observable<V1Transaction> {
    return this.TransactionServiceGetTransactionResponse(name15).pipe(
      __map(_r => _r.body as V1Transaction)
    );
  }

  /**
   * Permanently deletes a transaction.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:delete
   *   Domain: organization-scoped
   * @param name_9 The resource name of the transaction.
   * Format: organizations/{organization}/transactions/{transaction}
   * @return A successful response.
   */
  TransactionServiceDeleteTransactionResponse(name9: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
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
        return _r as __StrictHttpResponse<{}>;
      })
    );
  }
  /**
   * Permanently deletes a transaction.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:delete
   *   Domain: organization-scoped
   * @param name_9 The resource name of the transaction.
   * Format: organizations/{organization}/transactions/{transaction}
   * @return A successful response.
   */
  TransactionServiceDeleteTransaction(name9: string): __Observable<{}> {
    return this.TransactionServiceDeleteTransactionResponse(name9).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists transactions with keyset pagination and optional filters.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param params The `TransactionServiceService.TransactionServiceListTransactionsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListTransactions call.
   *
   * - `page_size`: Maximum number of transactions to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "booked_at desc", "amount").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: credit_ledger_account, debit_ledger_account,
   *   booked_at, document_date, amount.
   *   Example: "credit_ledger_account=\"organizations/{organization}/ledgerAccounts/{ledger_account}\" AND booked_at>=\"2025-01-01T00:00:00Z\"".
   *
   * @return A successful response.
   */
  TransactionServiceListTransactionsResponse(params: TransactionServiceService.TransactionServiceListTransactionsParams): __Observable<__StrictHttpResponse<V1ListTransactionsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/transactions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListTransactionsResponse>;
      })
    );
  }
  /**
   * Lists transactions with keyset pagination and optional filters.
   * Authorization:
   *   Scope: transactions:read
   *   Permission: transactions:read
   *   Domain: organization-scoped
   * @param params The `TransactionServiceService.TransactionServiceListTransactionsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListTransactions call.
   *
   * - `page_size`: Maximum number of transactions to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "booked_at desc", "amount").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: credit_ledger_account, debit_ledger_account,
   *   booked_at, document_date, amount.
   *   Example: "credit_ledger_account=\"organizations/{organization}/ledgerAccounts/{ledger_account}\" AND booked_at>=\"2025-01-01T00:00:00Z\"".
   *
   * @return A successful response.
   */
  TransactionServiceListTransactions(params: TransactionServiceService.TransactionServiceListTransactionsParams): __Observable<V1ListTransactionsResponse> {
    return this.TransactionServiceListTransactionsResponse(params).pipe(
      __map(_r => _r.body as V1ListTransactionsResponse)
    );
  }

  /**
   * Creates a new transaction.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:create
   *   Domain: organization-scoped
   * @param params The `TransactionServiceService.TransactionServiceCreateTransactionParams` containing the following parameters:
   *
   * - `transaction`: The transaction to create.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `transaction_id`: The ID to use for the transaction. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  TransactionServiceCreateTransactionResponse(params: TransactionServiceService.TransactionServiceCreateTransactionParams): __Observable<__StrictHttpResponse<V1Transaction>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.transaction;

    if (params.transactionId != null) __params = __params.set('transaction_id', params.transactionId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/transactions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Transaction>;
      })
    );
  }
  /**
   * Creates a new transaction.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:create
   *   Domain: organization-scoped
   * @param params The `TransactionServiceService.TransactionServiceCreateTransactionParams` containing the following parameters:
   *
   * - `transaction`: The transaction to create.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `transaction_id`: The ID to use for the transaction. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  TransactionServiceCreateTransaction(params: TransactionServiceService.TransactionServiceCreateTransactionParams): __Observable<V1Transaction> {
    return this.TransactionServiceCreateTransactionResponse(params).pipe(
      __map(_r => _r.body as V1Transaction)
    );
  }

  /**
   * Updates an existing transaction.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:update
   *   Domain: organization-scoped
   * @param params The `TransactionServiceService.TransactionServiceUpdateTransactionParams` containing the following parameters:
   *
   * - `transaction.name`: The resource name of the transaction.
   *   Format: organizations/{organization}/transactions/{transaction}
   *
   * - `transaction`: The transaction to update.
   *
   * @return A successful response.
   */
  TransactionServiceUpdateTransactionResponse(params: TransactionServiceService.TransactionServiceUpdateTransactionParams): __Observable<__StrictHttpResponse<V1Transaction>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.transaction;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.transactionName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Transaction>;
      })
    );
  }
  /**
   * Updates an existing transaction.
   * Authorization:
   *   Scope: transactions:write
   *   Permission: transactions:update
   *   Domain: organization-scoped
   * @param params The `TransactionServiceService.TransactionServiceUpdateTransactionParams` containing the following parameters:
   *
   * - `transaction.name`: The resource name of the transaction.
   *   Format: organizations/{organization}/transactions/{transaction}
   *
   * - `transaction`: The transaction to update.
   *
   * @return A successful response.
   */
  TransactionServiceUpdateTransaction(params: TransactionServiceService.TransactionServiceUpdateTransactionParams): __Observable<V1Transaction> {
    return this.TransactionServiceUpdateTransactionResponse(params).pipe(
      __map(_r => _r.body as V1Transaction)
    );
  }
}

module TransactionServiceService {

  /**
   * Parameters for TransactionServiceListTransactions
   */
  export interface TransactionServiceListTransactionsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * A page token from a previous ListTransactions call.
     */
    pageToken?: string;

    /**
     * Maximum number of transactions to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "booked_at desc", "amount").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: credit_ledger_account, debit_ledger_account,
     * booked_at, document_date, amount.
     * Example: "credit_ledger_account=\"organizations/{organization}/ledgerAccounts/{ledger_account}\" AND booked_at>=\"2025-01-01T00:00:00Z\"".
     */
    filter?: string;
  }

  /**
   * Parameters for TransactionServiceCreateTransaction
   */
  export interface TransactionServiceCreateTransactionParams {

    /**
     * The transaction to create.
     */
    transaction: V1Transaction;

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The ID to use for the transaction. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent organization.
     */
    transactionId?: string;
  }

  /**
   * Parameters for TransactionServiceUpdateTransaction
   */
  export interface TransactionServiceUpdateTransactionParams {

    /**
     * The resource name of the transaction.
     * Format: organizations/{organization}/transactions/{transaction}
     */
    transactionName: string;

    /**
     * The transaction to update.
     */
    transaction: {uid?: string, credit_ledger_account: string, debit_ledger_account: string, amount: V1Decimal, description?: string, reference?: string, booked_at: string, document_date: string, document_id?: string, update_time?: string, create_time?: string, etag?: string};
  }
}

export { TransactionServiceService }
