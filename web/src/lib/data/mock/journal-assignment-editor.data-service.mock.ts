import { Injectable } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Account } from '../../../app/shared/models';
import {
  JournalAssignmentEditorDataService,
  CreateAssignmentParams,
  UpdateAssignmentParams,
} from '../../../app/routes/journal/journal-list/journal-assignment-editor.data-service';
import { JournalAccountAssignment } from '../../../app/routes/journal/journal-list/journal-list.data-service';

@Injectable()
export class MockJournalAssignmentEditorDataService extends JournalAssignmentEditorDataService {
  private readonly accounts: Account[] = [
    this.createAccount('2.1.1', 'Gehälter'),
    this.createAccount('2.1.2', 'Sozialabgaben'),
    this.createAccount('2.1.3', 'Weiterbildung'),
    this.createAccount('2.2.1', 'Büromaterial'),
    this.createAccount('2.2.2', 'IT-Ausstattung'),
    this.createAccount('2.3.1', 'Veranstaltungsräume'),
    this.createAccount('3.1.1', 'Mitgliedsverwaltung'),
  ];

  private readonly assignmentsByTxn = new Map<string, JournalAccountAssignment[]>();

  listAvailableAccounts(_organizationId: string): Observable<Account[]> {
    return of(this.accounts.map((a) => ({ ...a }))).pipe(delay(200));
  }

  createAssignment(
    _organizationId: string,
    transactionId: string,
    params: CreateAssignmentParams,
  ): Observable<JournalAccountAssignment> {
    const list = this.getTxnAssignments(transactionId);
    if (list.length > 0) {
      return throwError(() => new Error('transaction assignment already exists')).pipe(delay(200));
    }
    const account = this.accounts.find((a) => a.id === params.accountId);
    const assignment: JournalAccountAssignment = {
      id: faker.string.uuid(),
      accountId: params.accountId,
      accountCode: account?.code ?? '',
      accountFullCode: account?.fullCode ?? account?.code ?? '',
      accountName: account?.name ?? '',
      value: params.value,
    };
    list.push(assignment);
    return of(assignment).pipe(delay(200));
  }

  updateAssignment(
    _organizationId: string,
    transactionId: string,
    assignmentId: string,
    params: UpdateAssignmentParams,
  ): Observable<JournalAccountAssignment> {
    const list = this.getTxnAssignments(transactionId);
    const existing = list.find((a) => a.id === assignmentId);
    const account = this.accounts.find((a) => a.id === params.accountId);
    if (existing) {
      existing.accountId = params.accountId;
      existing.value = params.value;
      existing.accountCode = account?.code ?? '';
      existing.accountFullCode = account?.fullCode ?? account?.code ?? '';
      existing.accountName = account?.name ?? '';
      return of(existing).pipe(delay(200));
    }
    const fallback: JournalAccountAssignment = {
      id: assignmentId,
      accountId: params.accountId,
      accountCode: account?.code ?? '',
      accountFullCode: account?.fullCode ?? account?.code ?? '',
      accountName: account?.name ?? '',
      value: params.value,
    };
    return of(fallback).pipe(delay(200));
  }

  deleteAssignment(
    _organizationId: string,
    transactionId: string,
    assignmentId: string,
  ): Observable<void> {
    const list = this.getTxnAssignments(transactionId);
    const idx = list.findIndex((a) => a.id === assignmentId);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
    return of(undefined).pipe(delay(200));
  }

  private getTxnAssignments(transactionId: string): JournalAccountAssignment[] {
    let list = this.assignmentsByTxn.get(transactionId);
    if (!list) {
      list = [];
      this.assignmentsByTxn.set(transactionId, list);
    }
    return list;
  }

  private createAccount(code: string, name: string): Account {
    return {
      id: faker.string.uuid(),
      code,
      fullCode: code,
      name,
      description: '',
      isArchived: false,
      isContainer: false,
      parentAccountId: null,
    };
  }
}
