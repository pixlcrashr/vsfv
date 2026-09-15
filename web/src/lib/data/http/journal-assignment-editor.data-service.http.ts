import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TransactionAssignmentServiceService } from '../../api/services/transaction-assignment-service.service';
import { AccountServiceService } from '../../api/services/account-service.service';
import { Account } from '../../../app/shared/models';
import {
  JournalAssignmentEditorDataService,
  CreateAssignmentParams,
  UpdateAssignmentParams,
} from '../../../app/routes/journal/journal-list/journal-assignment-editor.data-service';
import { JournalAccountAssignment } from '../../../app/routes/journal/journal-list/journal-list.data-service';
import { mapApiAccount, extractUidFromResourceName } from './_mappers';
import { V1TransactionAssignment as ApiTransactionAssignment } from '../../api/models';

@Injectable()
export class HttpJournalAssignmentEditorDataService extends JournalAssignmentEditorDataService {
  private readonly assignmentSvc = inject(TransactionAssignmentServiceService);
  private readonly accountSvc = inject(AccountServiceService);

  listAvailableAccounts(organizationId: string): Observable<Account[]> {
    return this.accountSvc
      .AccountServiceListAccounts({
        parent: `organizations/${organizationId}`,
        pageSize: 100,
        showDeleted: false,
      })
      .pipe(map((resp) => (resp.accounts ?? []).map(mapApiAccount)));
  }

  createAssignment(
    organizationId: string,
    transactionId: string,
    params: CreateAssignmentParams,
  ): Observable<JournalAccountAssignment> {
    const parent = `organizations/${organizationId}/transactions/${transactionId}`;
    const accountName = `organizations/${organizationId}/accounts/${params.accountId}`;
    return this.assignmentSvc
      .TransactionAssignmentServiceCreateTransactionAssignment({
        parent1: parent,
        assignment: {
          transaction: parent,
          account: accountName,
          value: { value: params.value },
        },
      })
      .pipe(map((a) => this.enrichAssignment(a, params.accountId)));
  }

  updateAssignment(
    organizationId: string,
    transactionId: string,
    assignmentId: string,
    params: UpdateAssignmentParams,
  ): Observable<JournalAccountAssignment> {
    const assignmentName = `organizations/${organizationId}/transactions/${transactionId}/assignments/${assignmentId}`;
    const parent = `organizations/${organizationId}/transactions/${transactionId}`;
    const accountName = `organizations/${organizationId}/accounts/${params.accountId}`;
    return this.assignmentSvc
      .TransactionAssignmentServiceUpdateTransactionAssignment({
        assignmentName1: assignmentName,
        assignment: {
          transaction: parent,
          account: accountName,
          value: { value: params.value },
        },
      })
      .pipe(map((a) => this.enrichAssignment(a, params.accountId)));
  }

  deleteAssignment(
    organizationId: string,
    transactionId: string,
    assignmentId: string,
  ): Observable<void> {
    const assignmentName = `organizations/${organizationId}/transactions/${transactionId}/assignments/${assignmentId}`;
    return this.assignmentSvc
      .TransactionAssignmentServiceDeleteTransactionAssignment(assignmentName)
      .pipe(map(() => undefined));
  }

  // The API response only contains the account resource name; code/name are
  // resolved by the component from its cached accounts list.
  private enrichAssignment(
    a: ApiTransactionAssignment,
    fallbackAccountId: string,
  ): JournalAccountAssignment {
    const uid = extractUidFromResourceName(a.account ?? '');
    return {
      id: a.uid ?? '',
      accountId: uid || fallbackAccountId,
      accountCode: '',
      accountFullCode: '',
      accountName: '',
      value: a.value?.value ?? '',
    };
  }
}
