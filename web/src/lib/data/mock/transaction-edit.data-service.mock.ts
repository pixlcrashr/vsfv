import { Injectable } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Transaction, Account, TransactionAssignment } from '../../../app/shared/models';
import { TransactionEditDataService, CreateAssignmentParams, UpdateAssignmentParams } from '../../../app/routes/transactions/transaction-edit/transaction-edit.data-service';

@Injectable()
export class MockTransactionEditDataService extends TransactionEditDataService {
  private transaction: Transaction = {
    id: faker.string.uuid(),
    documentDate: faker.date.recent({ days: 30 }),
    bookedAt: new Date(),
    updatedAt: new Date(),
    amount: '1500.00',
    debitLedgerAccountId: faker.string.uuid(),
    debitAccountCode: '1100',
    debitAccountName: 'Bank',
    creditLedgerAccountId: faker.string.uuid(),
    creditAccountCode: '3100',
    creditAccountName: 'Mitgliedsbeiträge',
    description: 'Mitgliedsbeitrag Q1',
    assignedAccountId: null,
    isLedgerClosed: false,
    accountAssignments: [
      {
        id: faker.string.uuid(),
        accountId: faker.string.uuid(),
        accountCode: '2.1.1',
        accountName: 'Gehälter',
        value: '1500.00',
      },
    ],
  };

  getTransaction(organizationId: string, id: string): Observable<Transaction> {
    return of({ ...this.transaction, id }).pipe(delay(300));
  }

  updateTransaction(organizationId: string, id: string, description: string): Observable<Transaction> {
    this.transaction.description = description;
    this.transaction.updatedAt = new Date();
    return of({ ...this.transaction, id }).pipe(delay(300));
  }

  listAvailableAccounts(organizationId: string): Observable<Account[]> {
    return of([
      this.createAccount('2.1.3', 'Weiterbildung'),
      this.createAccount('2.2.1', 'Büromaterial'),
      this.createAccount('2.2.2', 'IT-Ausstattung'),
      this.createAccount('2.3.1', 'Veranstaltungsräume'),
    ]).pipe(delay(200));
  }

  private createAccount(code: string, name: string): Account {
    return {
      id: faker.string.uuid(),
      code,
      fullCode: code,
      displayFullCode: code,
      displayFullName: name,
      name,
      description: '',
      isArchived: false,
      parentAccountId: null,
    };
  }

  createAssignment(organizationId: string, transactionId: string, params: CreateAssignmentParams): Observable<TransactionAssignment> {
    const existing = this.transaction.accountAssignments.find(a => a.accountId === params.accountId);
    if (existing) {
      return throwError(() => new Error('transaction assignment for this account already exists')).pipe(delay(200));
    }
    const assignment: TransactionAssignment = {
      id: faker.string.uuid(),
      accountId: params.accountId,
      accountCode: '',
      accountName: '',
      value: params.value,
    };
    this.transaction.accountAssignments.push(assignment);
    return of(assignment).pipe(delay(200));
  }

  deleteAssignment(organizationId: string, transactionId: string, assignmentId: string): Observable<void> {
    this.transaction.accountAssignments = this.transaction.accountAssignments.filter(a => a.id !== assignmentId);
    return of(undefined).pipe(delay(200));
  }

  updateAssignment(organizationId: string, transactionId: string, assignmentId: string, params: UpdateAssignmentParams): Observable<TransactionAssignment> {
    const assignment = this.transaction.accountAssignments.find(a => a.id === assignmentId);
    if (assignment) {
      assignment.accountId = params.accountId;
      assignment.value = params.value;
    }
    return of(assignment ?? {
      id: assignmentId,
      accountId: params.accountId,
      accountCode: '',
      accountName: '',
      value: params.value,
    }).pipe(delay(200));
  }
}
