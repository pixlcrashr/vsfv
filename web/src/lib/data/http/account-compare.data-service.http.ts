import { Injectable, inject } from '@angular/core';
import { Observable, of, map, expand, reduce, EMPTY, forkJoin, switchMap, toArray } from 'rxjs';
import { AccountServiceService } from '../../api/services/account-service.service';
import { BudgetServiceService } from '../../api/services/budget-service.service';
import { TransactionServiceService } from '../../api/services/transaction-service.service';
import { TransactionAssignmentServiceService } from '../../api/services/transaction-assignment-service.service';
import { V1ListTransactionsResponse } from '../../api/models/v1list-transactions-response';
import { V1Transaction } from '../../api/models/v1transaction';
import {
  AccountCompareDataService,
  BudgetOption,
  CompareAccountOption,
  CompareAccountTransaction,
} from '../../../app/routes/accounts/account-compare/account-compare.data-service';
import { typeDateToDate } from './_mappers';

@Injectable()
export class HttpAccountCompareDataService extends AccountCompareDataService {
  private readonly accountSvc = inject(AccountServiceService);
  private readonly budgetSvc = inject(BudgetServiceService);
  private readonly txnSvc = inject(TransactionServiceService);
  private readonly assignmentSvc = inject(TransactionAssignmentServiceService);

  listBudgets(organizationId: string): Observable<BudgetOption[]> {
    return this.budgetSvc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }).pipe(
      map((resp) =>
        (resp.budgets ?? []).map((b) => ({
          id: b.uid ?? '',
          name: b.display_name,
          year: typeDateToDate(b.period_start).getFullYear(),
        })),
      ),
    );
  }

  listAccounts(organizationId: string, _budgetId: string): Observable<CompareAccountOption[]> {
    const parent = `organizations/${organizationId}`;
    const pageSize = 200; // server maximum; anything larger is clamped

    // show_deleted: archived accounts stay in the list so the parent chain of
    // active accounts remains intact and the full hierarchy is selectable.
    const fetchPage = (pageToken?: string) =>
      this.accountSvc.AccountServiceListAccounts({ parent, pageSize, pageToken, showDeleted: true });

    return fetchPage(undefined).pipe(
      expand((resp) => {
        const next = resp.next_page_token;
        return next ? fetchPage(next) : EMPTY;
      }),
      map((resp) => resp.accounts ?? []),
      toArray(),
      map((pages) =>
        pages.flat().map((a) => ({
          id: a.uid ?? '',
          code: a.display_code,
          name: a.display_name,
          parentAccountId: a.parent_account ? a.parent_account.split('/').pop() ?? null : null,
        })),
      ),
    );
  }

  listTransactions(
    organizationId: string,
    budgetId: string,
    accountId: string,
  ): Observable<CompareAccountTransaction[]> {
    const orgParent = `organizations/${organizationId}`;
    const accountName = `${orgParent}/accounts/${accountId}`;
    const budgetName = `${orgParent}/budgets/${budgetId}`;

    return this.budgetSvc.BudgetServiceGetBudget(budgetName).pipe(
      switchMap((budget) => {
        const periodStart = typeDateToDate(budget.period_start);
        const periodEnd = typeDateToDate(budget.period_end);
        const startFilter = periodStart.toISOString();
        const endFilter = periodEnd.toISOString();
        const filterExpr = `booked_at>="${startFilter}" AND booked_at<="${endFilter}"`;

        return this.txnSvc.TransactionServiceListTransactions({
          parent: orgParent,
          pageSize: 100,
          filter: filterExpr,
        }).pipe(
          expand((resp: V1ListTransactionsResponse) =>
            resp.next_page_token
              ? this.txnSvc.TransactionServiceListTransactions({
                  parent: orgParent,
                  pageSize: 100,
                  filter: filterExpr,
                  pageToken: resp.next_page_token,
                })
              : EMPTY,
          ),
          reduce((all: V1Transaction[], resp: V1ListTransactionsResponse) =>
            all.concat(resp.transactions ?? []), []),
        );
      }),
      switchMap((transactions) => {
        if (transactions.length === 0) return of([]);

        return forkJoin(
          transactions.map((t) => {
            const txnName = t.name ?? `${orgParent}/transactions/${t.uid}`;
            return this.assignmentSvc.TransactionAssignmentServiceListTransactionAssignments({
              parent1: txnName,
              pageSize: 100,
              filter: `account="${accountName}"`,
            }).pipe(
              map((assignmentResp) => ({
                transaction: t,
                hasAssignment: (assignmentResp.assignments ?? []).length > 0,
              })),
            );
          }),
        ).pipe(
          map((results) => results.filter((r) => r.hasAssignment).map((r) => r.transaction)),
        );
      }),
      map((transactions) =>
        transactions.map((t) => ({
          id: t.uid ?? '',
          documentDate: new Date(t.document_date),
          amount: t.amount?.value ?? '',
          debitAccountCode: t.debit_ledger_account,
          creditAccountCode: t.credit_ledger_account,
          description: t.description ?? '',
        })),
      ),
    );
  }
}
