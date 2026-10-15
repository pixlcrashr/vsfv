import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, forkJoin, map, of, switchMap, toArray } from 'rxjs';
import { Decimal } from 'decimal.js';
import { AccountServiceService } from '../../api/services/account-service.service';
import { BudgetServiceService } from '../../api/services/budget-service.service';
import { BudgetRevisionServiceService } from '../../api/services/budget-revision-service.service';
import { BudgetAccountValueServiceService } from '../../api/services/budget-account-value-service.service';
import { BudgetActualAccountValueServiceService } from '../../api/services/budget-actual-account-value-service.service';
import { V1ListBudgetActualAccountValuesResponse } from '../../api/models/v1list-budget-actual-account-values-response';
import { V1BudgetRevision } from '../../api/models/v1budget-revision';
import { Account, Budget } from '../../../app/routes/matrix/matrix-data-provider.service';
import {
  MatrixDataService,
  MatrixTargetValues,
  MatrixActualValues,
  MatrixEditableValuesByBudget,
  MatrixBudgetValueUpdate,
} from '../../../app/routes/matrix/matrix.data-service';
import { extractUidFromResourceName, typeDateToDate } from './_mappers';

@Injectable()
export class HttpMatrixDataService extends MatrixDataService {
  private readonly http = inject(HttpClient);
  private readonly accountSvc = inject(AccountServiceService);
  private readonly budgetSvc = inject(BudgetServiceService);
  private readonly revisionSvc = inject(BudgetRevisionServiceService);
  private readonly budgetValueSvc = inject(BudgetAccountValueServiceService);
  private readonly actualValueSvc = inject(BudgetActualAccountValueServiceService);

  private budgetName(organizationId: string, budgetId: string): string {
    return `organizations/${organizationId}/budgets/${budgetId}`;
  }

  listBudgets(organizationId: string): Observable<Budget[]> {
    // Budgets and their revisions are fetched in parallel: a single
    // wildcard-parent request covers the revisions of every budget.
    return forkJoin([
      this.budgetSvc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }),
      this.listAllRevisions(organizationId),
    ]).pipe(
      map(([budgetsResp, revisions]) => {
        const revisionsByBudgetId = new Map<string, V1BudgetRevision[]>();
        for (const r of revisions) {
          const budgetId = extractUidFromResourceName(r.budget ?? '');
          if (!budgetId) {
            continue;
          }
          const list = revisionsByBudgetId.get(budgetId) ?? [];
          list.push(r);
          revisionsByBudgetId.set(budgetId, list);
        }

        return (budgetsResp.budgets ?? []).map((b) => ({
          id: b.uid ?? '',
          displayName: b.display_name,
          displayDescription: b.display_description ?? '',
          isClosed: b.is_closed ?? false,
          periodStart: typeDateToDate(b.period_start),
          tags: (revisionsByBudgetId.get(b.uid ?? '') ?? []).map((r) => ({
            id: r.uid ?? '',
            name: r.name ?? '',
            displayName: r.display_name ?? '',
            displayDescription: r.display_description ?? '',
            date: r.date ? typeDateToDate(r.date) : new Date(r.create_time ?? ''),
            createdAt: new Date(r.create_time ?? ''),
          })),
        }));
      }),
    );
  }

  /**
   * Lists the revisions of every budget of the organization in one (paged)
   * request, ordered by revision date descending (newest first). The matrix
   * relies on this order for the selection menu and the "latest" revision.
   */
  private listAllRevisions(organizationId: string) {
    const parent = `organizations/${organizationId}/budgets/-`;
    const pageSize = 100; // server maximum; anything larger is clamped

    const fetchPage = (pageToken?: string) =>
      this.revisionSvc.BudgetRevisionServiceListBudgetRevisions({ parent, pageSize, pageToken, orderBy: 'date desc' });

    return fetchPage(undefined).pipe(
      expand((resp) => {
        const next = resp.next_page_token;
        return next ? fetchPage(next) : EMPTY;
      }),
      map((resp) => resp.revisions ?? []),
      toArray(),
      map((pages) => pages.flat()),
    );
  }

  listAccounts(organizationId: string): Observable<Account[]> {
    const parent = `organizations/${organizationId}`;
    const pageSize = 200; // server maximum; anything larger is clamped

    const fetchPage = (pageToken?: string) =>
      this.accountSvc.AccountServiceListAccounts({
        parent,
        pageSize,
        pageToken,
        showDeleted: true,
      });

    return fetchPage(undefined).pipe(
      expand((resp) => {
        const next = resp.next_page_token;
        return next ? fetchPage(next) : EMPTY;
      }),
      map((resp) => resp.accounts ?? []),
      toArray(),
      map((pages) => {
        const flat = pages.flat();
        return flat.map((a) => ({
          id: a.uid ?? '',
          code: a.display_code ?? '',
          name: a.display_name,
          displayCode: a.display_code,
          displayDescription: a.display_description ?? '',
          // Depth and ordering are computed by the shared account hierarchy
          // service in the data provider.
          depth: 0,
          parentAccountId: a.parent_account ? a.parent_account.split('/').pop() ?? null : null,
          isArchived: a.is_archived ?? false,
        }));
      }),
    );
  }

  /**
   * Fetches the target values of all given revisions with a single (paged)
   * request against the wildcard parent organizations/{org}/budgets/-/revisions/-,
   * selecting the revisions via the `revision` filter.
   */
  listMatrixTargetValues(organizationId: string, revisionNames: string[]): Observable<MatrixTargetValues> {
    if (revisionNames.length === 0) {
      return of({} as MatrixTargetValues);
    }

    // The URL is built manually because the generated client URL-encodes the
    // slashes in the resource name, which breaks the grpc-gateway routing.
    const parent = `organizations/${organizationId}/budgets/-/revisions/-`;
    const pageSize = 500; // server maximum
    const filter = revisionNames.map((name) => `revision="${name}"`).join(' OR ');
    const baseUrl = this.budgetValueSvc.rootUrl;

    const fetchPage = (pageToken?: string) => {
      let params = new HttpParams()
        .set('page_size', pageSize.toString())
        .set('filter', filter);
      if (pageToken) {
        params = params.set('page_token', pageToken);
      }
      return this.http.get<{ account_values?: Array<{ revision?: string; account?: string; value?: { value?: string } }>; next_page_token?: string }>(
        `${baseUrl}/v1/${parent}/accountValues`,
        { params },
      );
    };

    return fetchPage(undefined).pipe(
      expand((resp) => {
        const next = resp.next_page_token;
        return next ? fetchPage(next) : EMPTY;
      }),
      map((resp) => resp.account_values ?? []),
      toArray(),
      map((pages) => {
        const result: MatrixTargetValues = {};
        for (const value of pages.flat()) {
          const tagId = extractUidFromResourceName(value.revision ?? '');
          const accountId = extractUidFromResourceName(value.account ?? '');
          if (!tagId || !accountId) {
            continue;
          }
          result[tagId] ??= {};
          result[tagId][accountId] = { targetValue: new Decimal(value.value?.value ?? '0') };
        }
        return result;
      }),
    );
  }

  listMatrixActualValues(organizationId: string, budgetIds: string[]): Observable<MatrixActualValues> {
    // Use a wildcard budget parent so a single request can return actual values
    // for the requested budgets. The URL is built manually because the
    // generated client URL-encodes the slashes in the resource name, which
    // breaks the grpc-gateway routing.
    const parent = `organizations/${organizationId}/budgets/-`;
    const pageSize = 500; // server maximum
    const baseUrl = this.actualValueSvc.rootUrl;

    const fetchPage = (pageToken?: string): Observable<V1ListBudgetActualAccountValuesResponse> => {
      let params = new HttpParams().set('page_size', pageSize.toString());
      if (budgetIds.length > 0) {
        params = params.set(
          'filter',
          budgetIds.map((id) => `budget="${this.budgetName(organizationId, id)}"`).join(' OR '),
        );
      }
      if (pageToken) {
        params = params.set('page_token', pageToken);
      }
      return this.http.get<V1ListBudgetActualAccountValuesResponse>(
        `${baseUrl}/v1/${parent}/actualAccountValues`,
        { params },
      );
    };

    return fetchPage(undefined).pipe(
      expand((resp) => {
        const next = resp.next_page_token;
        return next ? fetchPage(next) : EMPTY;
      }),
      map((resp) => resp.actual_account_values ?? []),
      toArray(),
      map((pages) => {
        const result: MatrixActualValues = {};
        pages.flat().forEach((v) => {
          const budgetId = extractUidFromResourceName(v.budget ?? '');
          const accountId = extractUidFromResourceName(v.account ?? '');
          if (!budgetId || !accountId) {
            return;
          }
          result[budgetId] ??= {};
          result[budgetId][accountId] = { actualValue: new Decimal(v.value?.value ?? '0') };
        });
        return result;
      }),
    );
  }

  listMatrixEditableValues(organizationId: string, budgetIds: string[]): Observable<MatrixEditableValuesByBudget[]> {
    if (budgetIds.length === 0) {
      return of([] as MatrixEditableValuesByBudget[]);
    }

    // A single wildcard-parent request covers every selected budget.
    const parent = `organizations/${organizationId}/budgets/-`;
    const pageSize = 500; // server maximum
    const filter = budgetIds.map((id) => `budget="${this.budgetName(organizationId, id)}"`).join(' OR ');

    const fetchPage = (pageToken?: string) =>
      this.budgetValueSvc.BudgetAccountValueServiceListBudgetAccountValues({ parent, pageSize, pageToken, filter });

    return fetchPage(undefined).pipe(
      expand((resp) => {
        const next = resp.next_page_token;
        return next ? fetchPage(next) : EMPTY;
      }),
      map((resp) => resp.account_values ?? []),
      toArray(),
      map((pages) => {
        const byBudget = new Map<string, Map<string, Decimal>>();
        for (const value of pages.flat()) {
          const budgetId = extractUidFromResourceName(value.budget ?? '');
          const accountId = extractUidFromResourceName(value.account ?? '');
          if (!budgetId || !accountId) {
            continue;
          }
          let perAccount = byBudget.get(budgetId);
          if (!perAccount) {
            perAccount = new Map();
            byBudget.set(budgetId, perAccount);
          }
          perAccount.set(accountId, new Decimal(value.value?.value ?? '0'));
        }
        return Array.from(byBudget.entries()).map(([budgetId, values]) => ({
          budgetId,
          editableValues: Object.fromEntries(values),
        }));
      }),
    );
  }

  updateMatrixBudgetValues(organizationId: string, updates: MatrixBudgetValueUpdate[]): Observable<void> {
    if (updates.length === 0) {
      return of(undefined);
    }

    const byBudget = new Map<string, MatrixBudgetValueUpdate[]>();
    for (const update of updates) {
      const list = byBudget.get(update.budgetId) ?? [];
      list.push(update);
      byBudget.set(update.budgetId, list);
    }

    return forkJoin(
      Array.from(byBudget.entries()).map(([budgetId, budgetUpdates]) =>
        this.budgetValueSvc.BudgetAccountValueServiceBatchUpdateBudgetAccountValues({
          parent: this.budgetName(organizationId, budgetId),
          body: {
            requests: budgetUpdates.map((u) => ({
              account_value: {
                name: `${this.budgetName(organizationId, budgetId)}/accountValues/${u.accountId}`,
                account: `organizations/${organizationId}/accounts/${u.accountId}`,
                value: { value: u.value.toString() },
              },
              allow_missing: true,
            })),
          },
        }),
      ),
    ).pipe(map(() => undefined));
  }
}
