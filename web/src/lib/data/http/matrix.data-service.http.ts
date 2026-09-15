import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, forkJoin, map, of, switchMap, toArray } from 'rxjs';
import { Decimal } from 'decimal.js';
import { AccountServiceService } from '../../api/services/account-service.service';
import { BudgetServiceService } from '../../api/services/budget-service.service';
import { BudgetRevisionServiceService } from '../../api/services/budget-revision-service.service';
import { BudgetRevisionAccountValueServiceService } from '../../api/services/budget-revision-account-value-service.service';
import { BudgetAccountValueServiceService } from '../../api/services/budget-account-value-service.service';
import { BudgetActualAccountValueServiceService } from '../../api/services/budget-actual-account-value-service.service';
import { V1ListBudgetActualAccountValuesResponse } from '../../api/models/v1list-budget-actual-account-values-response';
import { Account, Budget } from '../../../app/routes/matrix/matrix-data-provider.service';
import {
  MatrixDataService,
  MatrixTargetValues,
  MatrixActualValues,
  MatrixEditableValuesByBudget,
  MatrixBudgetValueUpdate,
} from '../../../app/routes/matrix/matrix.data-service';
import { extractUidFromResourceName } from './_mappers';

@Injectable()
export class HttpMatrixDataService extends MatrixDataService {
  private readonly http = inject(HttpClient);
  private readonly accountSvc = inject(AccountServiceService);
  private readonly budgetSvc = inject(BudgetServiceService);
  private readonly revisionSvc = inject(BudgetRevisionServiceService);
  private readonly revisionValueSvc = inject(BudgetRevisionAccountValueServiceService);
  private readonly budgetValueSvc = inject(BudgetAccountValueServiceService);
  private readonly actualValueSvc = inject(BudgetActualAccountValueServiceService);

  private budgetName(organizationId: string, budgetId: string): string {
    return `organizations/${organizationId}/budgets/${budgetId}`;
  }

  listBudgets(organizationId: string): Observable<Budget[]> {
    return this.budgetSvc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }).pipe(
      switchMap((resp) => {
        const budgets = resp.budgets ?? [];
        if (budgets.length === 0) {
          return of([]);
        }
        return forkJoin(
          budgets.map((b) =>
            this.revisionSvc.BudgetRevisionServiceListBudgetRevisions({
              parent: this.budgetName(organizationId, b.uid ?? ''),
              pageSize: 100,
              orderBy: 'create_time asc',
            }).pipe(
              map((revResp) => ({
                id: b.uid ?? '',
                displayName: b.display_name,
                displayDescription: b.display_description ?? '',
                isClosed: b.is_closed ?? false,
                tags: (revResp.revisions ?? []).map((r) => ({
                  id: r.uid ?? '',
                  displayName: r.display_name ?? '',
                  displayDescription: r.display_description ?? '',
                  createdAt: new Date(r.create_time ?? ''),
                })),
              })),
            ),
          ),
        );
      }),
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
        const accountMap = new Map<string, Account>();
        flat.forEach((a) => {
          accountMap.set(a.uid ?? '', {
            id: a.uid ?? '',
            name: a.display_name,
            displayCode: a.display_code,
            displayDescription: a.display_description ?? '',
            depth: 0,
            parentAccountId: a.parent_account ? a.parent_account.split('/').pop() ?? null : null,
            isArchived: a.is_archived ?? false,
          });
        });

        const computeDepth = (id: string, visited = new Set<string>()): number => {
          if (visited.has(id)) return 0;
          visited.add(id);
          const acc = accountMap.get(id);
          if (!acc || !acc.parentAccountId) return 0;
          return 1 + computeDepth(acc.parentAccountId, visited);
        };

        accountMap.forEach((acc) => {
          acc.depth = computeDepth(acc.id);
        });

        return Array.from(accountMap.values());
      }),
    );
  }

  listMatrixTargetValues(organizationId: string): Observable<MatrixTargetValues> {
    return this.budgetSvc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }).pipe(
      switchMap((resp) => {
        const budgets = resp.budgets ?? [];
        if (budgets.length === 0) {
          return of({} as MatrixTargetValues);
        }
        return forkJoin(
          budgets.map((b) =>
            this.revisionSvc.BudgetRevisionServiceListBudgetRevisions({
              parent: this.budgetName(organizationId, b.uid ?? ''),
              pageSize: 100,
              orderBy: 'create_time asc',
            }).pipe(
              switchMap((revResp) => {
                const revisions = revResp.revisions ?? [];
                if (revisions.length === 0) {
                  return of([] as Array<{ tagId: string; accountId: string; value: Decimal }>);
                }
                return forkJoin(
                  revisions.map((r) =>
                    this.revisionValueSvc
                      .BudgetRevisionAccountValueServiceListBudgetRevisionAccountValues({
                        parent1: `${this.budgetName(organizationId, b.uid ?? '')}/revisions/${r.uid ?? ''}`,
                        pageSize: 500,
                      })
                      .pipe(
                        map((valResp) =>
                          (valResp.account_values ?? []).map((v) => ({
                            tagId: r.uid ?? '',
                            accountId: extractUidFromResourceName(v.account ?? ''),
                            value: new Decimal(v.value?.value ?? '0'),
                          })),
                        ),
                      ),
                  ),
                ).pipe(map((arrays) => arrays.flat()));
              }),
            ),
          ),
        ).pipe(
          map((perBudget) => {
            const result: MatrixTargetValues = {};
            perBudget.flat().forEach(({ tagId, accountId, value }) => {
              if (!result[tagId]) result[tagId] = {};
              result[tagId][accountId] = { targetValue: value };
            });
            return result;
          }),
        );
      }),
    );
  }

  listMatrixActualValues(organizationId: string): Observable<MatrixActualValues> {
    // Use a wildcard budget parent so a single request can return actual values
    // for every budget in the organization. The URL is built manually because
    // the generated client URL-encodes the slashes in the resource name, which
    // breaks the grpc-gateway routing.
    const parent = `organizations/${organizationId}/budgets/-`;
    const pageSize = 200;
    const baseUrl = this.actualValueSvc.rootUrl;

    const fetchPage = (pageToken?: string): Observable<V1ListBudgetActualAccountValuesResponse> => {
      let params = new HttpParams().set('page_size', pageSize.toString());
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

  listMatrixEditableValues(organizationId: string): Observable<MatrixEditableValuesByBudget[]> {
    return this.budgetSvc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }).pipe(
      switchMap((resp) => {
        const budgets = resp.budgets ?? [];
        if (budgets.length === 0) {
          return of([] as MatrixEditableValuesByBudget[]);
        }
        return forkJoin(
          budgets.map((b) =>
            this.budgetValueSvc
              .BudgetAccountValueServiceListBudgetAccountValues({
                parent: this.budgetName(organizationId, b.uid ?? ''),
                pageSize: 500,
              })
              .pipe(
                map((valResp) => ({
                  budgetId: b.uid ?? '',
                  editableValues: Object.fromEntries(
                    (valResp.account_values ?? []).map((v) => [
                      extractUidFromResourceName(v.account),
                      new Decimal(v.value?.value ?? '0'),
                    ]),
                  ),
                })),
              ),
          ),
        );
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
