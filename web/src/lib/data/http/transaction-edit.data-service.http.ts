import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, switchMap, catchError, of } from 'rxjs';
import { TransactionServiceService } from '../../api/services/transaction-service.service';
import { TransactionAssignmentServiceService } from '../../api/services/transaction-assignment-service.service';
import { LedgerAccountServiceService } from '../../api/services/ledger-account-service.service';
import { LedgerYearServiceService } from '../../api/services/ledger-year-service.service';
import { AccountServiceService } from '../../api/services/account-service.service';
import { Transaction, Account, TransactionAssignment } from '../../../app/shared/models';
import { TransactionEditDataService, CreateAssignmentParams, UpdateAssignmentParams } from '../../../app/routes/transactions/transaction-edit/transaction-edit.data-service';
import { mapApiAccount, mapApiTransaction, mapApiTransactionAssignment } from './_mappers';

@Injectable()
export class HttpTransactionEditDataService extends TransactionEditDataService {
  private readonly txnSvc = inject(TransactionServiceService);
  private readonly assignmentSvc = inject(TransactionAssignmentServiceService);
  private readonly ledgerAccountSvc = inject(LedgerAccountServiceService);
  private readonly ledgerYearSvc = inject(LedgerYearServiceService);
  private readonly accountSvc = inject(AccountServiceService);

  private txnName(organizationId: string, uid: string): string {
    return `organizations/${organizationId}/transactions/${uid}`;
  }

  getTransaction(organizationId: string, id: string): Observable<Transaction> {
    const txnName = this.txnName(organizationId, id);
    const parent = `organizations/${organizationId}`;

    return this.txnSvc.TransactionServiceGetTransaction(txnName).pipe(
      switchMap((txn) => {
        const bookedYear = new Date(txn.booked_at).getFullYear();

        return combineLatest([
          this.assignmentSvc.TransactionAssignmentServiceListTransactionAssignments({ parent1: txnName, pageSize: 100 }),
          this.ledgerAccountSvc.LedgerAccountServiceListLedgerAccounts({ parent, pageSize: 100 }),
          this.accountSvc.AccountServiceListAccounts({ parent, pageSize: 100, showDeleted: false }),
          this.ledgerYearSvc.LedgerYearServiceListLedgerYears({ parent, pageSize: 2, filter: `year=${bookedYear}` }).pipe(
            catchError(() => of({ ledger_years: [] })),
          ),
        ]).pipe(
          map(([assignmentsResp, ledgerAccountsResp, accountsResp, ledgerYearsResp]) => {
            const ledgerAccountsMap = new Map(
              (ledgerAccountsResp.ledger_accounts ?? []).map((a) => [a.uid ?? '', a]),
            );
            const accountsMap = new Map(
              (accountsResp.accounts ?? []).map((a) => [a.uid ?? '', a]),
            );

            const debitUid = txn.debit_ledger_account?.split('/').pop() ?? '';
            const creditUid = txn.credit_ledger_account?.split('/').pop() ?? '';

            const debitLedgerAccount = ledgerAccountsMap.get(debitUid);
            const creditLedgerAccount = ledgerAccountsMap.get(creditUid);

            const assignments = (assignmentsResp.assignments ?? []).map((a) => {
              const accountUid = a.account?.split('/').pop() ?? '';
              const acct = accountsMap.get(accountUid);
              return mapApiTransactionAssignment(
                a,
                acct?.display_code ?? '',
                acct?.display_name ?? '',
              );
            });

            const ledgerYear = ledgerYearsResp.ledger_years?.find((y) => y.year === bookedYear);
            const isLedgerClosed = ledgerYear?.is_closed ?? false;

            return mapApiTransaction(
              txn,
              debitLedgerAccount?.code ?? '',
              debitLedgerAccount?.display_name ?? '',
              creditLedgerAccount?.code ?? '',
              creditLedgerAccount?.display_name ?? '',
              assignments,
              isLedgerClosed,
            );
          }),
        );
      }),
    );
  }

  updateTransaction(organizationId: string, id: string, description: string): Observable<Transaction> {
    const name = this.txnName(organizationId, id);
    return this.txnSvc.TransactionServiceGetTransaction(name).pipe(
      switchMap((existing) =>
        this.txnSvc.TransactionServiceUpdateTransaction({
          transactionName: name,
          transaction: {
            ...existing,
            credit_ledger_account: existing.credit_ledger_account,
            debit_ledger_account: existing.debit_ledger_account,
            amount: existing.amount,
            booked_at: existing.booked_at,
            document_date: existing.document_date,
            description,
          },
        }),
      ),
      map((txn) => mapApiTransaction(txn, '', '', '', '', [])),
    );
  }

  listAvailableAccounts(organizationId: string): Observable<Account[]> {
    return this.accountSvc.AccountServiceListAccounts({ parent: `organizations/${organizationId}`, pageSize: 100, showDeleted: false }).pipe(
      map((resp) => (resp.accounts ?? []).map(mapApiAccount)),
    );
  }

  createAssignment(organizationId: string, transactionId: string, params: CreateAssignmentParams): Observable<TransactionAssignment> {
    const parent = this.txnName(organizationId, transactionId);
    const accountName = `organizations/${organizationId}/accounts/${params.accountId}`;
    return this.assignmentSvc.TransactionAssignmentServiceCreateTransactionAssignment({
      parent1: parent,
      assignment: {
        transaction: parent,
        account: accountName,
        value: { value: params.value },
      },
    }).pipe(
      map((a) => mapApiTransactionAssignment(a, '', '')),
    );
  }

  deleteAssignment(organizationId: string, transactionId: string, assignmentId: string): Observable<void> {
    const assignmentName = `organizations/${organizationId}/transactions/${transactionId}/assignments/${assignmentId}`;
    return this.assignmentSvc.TransactionAssignmentServiceDeleteTransactionAssignment(assignmentName).pipe(
      map(() => undefined),
    );
  }

  updateAssignment(organizationId: string, transactionId: string, assignmentId: string, params: UpdateAssignmentParams): Observable<TransactionAssignment> {
    const assignmentName = `organizations/${organizationId}/transactions/${transactionId}/assignments/${assignmentId}`;
    const parent = this.txnName(organizationId, transactionId);
    const accountName = `organizations/${organizationId}/accounts/${params.accountId}`;
    return this.assignmentSvc.TransactionAssignmentServiceUpdateTransactionAssignment({
      assignmentName1: assignmentName,
      assignment: {
        transaction: parent,
        account: accountName,
        value: { value: params.value },
      },
    }).pipe(
      map((a) => mapApiTransactionAssignment(a, '', '')),
    );
  }
}
