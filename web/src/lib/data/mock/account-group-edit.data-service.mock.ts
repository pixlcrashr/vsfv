import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Account, AccountGroupOperation, AuditLogHistoryEntry } from '../../../app/shared/models';
import {
  AccountGroupEditDataService,
  AccountGroupDetails,
  AccountWithOperation,
} from '../../../app/routes/account-groups/account-group-edit/account-group-edit.data-service';
import { MockAuditHistory } from './_shared-audit-history';

@Injectable()
export class MockAccountGroupEditDataService extends AccountGroupEditDataService {
  private allAccounts: Account[];
  private readonly auditHistory = new MockAuditHistory();

  constructor() {
    super();
    // Create root accounts (depth 0)
    const root1 = this.createAccount('1', '1', 'Aktiva', null, false);
    const root2 = this.createAccount('2', '2', 'Passiva', null, false);
    const root3 = this.createAccount('3', '3', 'Archiviert', null, true);

    // Create level 1 accounts (depth 1)
    const acc1_1 = this.createAccount('1.1', '1.1', 'Kasse', root1.id, false);
    const acc1_2 = this.createAccount('1.2', '1.2', 'Bank', root1.id, false);
    const acc2_1 = this.createAccount('2.1', '2.1', 'Personal', root2.id, false);
    const acc2_2 = this.createAccount('2.2', '2.2', 'Sachkosten', root2.id, false);

    // Create level 2 accounts (depth 2)
    const acc2_1_1 = this.createAccount('2.1.1', '2.1.1', 'Gehälter', acc2_1.id, false);
    const acc2_1_2 = this.createAccount('2.1.2', '2.1.2', 'Sozialabgaben', acc2_1.id, false);
    const acc2_1_3 = this.createAccount('2.1.3', '2.1.3', 'Weiterbildung', acc2_1.id, false);
    const acc2_2_1 = this.createAccount('2.2.1', '2.2.1', 'Büromaterial', acc2_2.id, false);
    const acc2_2_2 = this.createAccount('2.2.2', '2.2.2', 'IT-Ausstattung', acc2_2.id, false);

    // Archived accounts
    const acc3_1 = this.createAccount('3.1', '3.1', 'Altes Konto', root3.id, true);
    const acc3_2 = this.createAccount('3.2', '3.2', 'Nicht mehr verwendet', root3.id, true);

    this.allAccounts = [
      root1, acc1_1, acc1_2,
      root2, acc2_1, acc2_1_1, acc2_1_2, acc2_1_3,
      acc2_2, acc2_2_1, acc2_2_2,
      root3, acc3_1, acc3_2,
    ];
  }

  private get groupData(): AccountGroupDetails {
    return {
      id: faker.string.uuid(),
      name: 'Personalkosten',
      description: 'Alle personalbezogenen Konten',
      assignmentCount: 3,
      assignments: [
        {
          id: faker.string.uuid(),
          accountId: this.allAccounts.find(a => a.code === '2.1.1')!.id,
          accountCode: '2.1.1',
          accountName: 'Gehälter',
          operation: 'A',
          targetValue: '0',
          actualValue: '0',
        },
        {
          id: faker.string.uuid(),
          accountId: this.allAccounts.find(a => a.code === '2.1.2')!.id,
          accountCode: '2.1.2',
          accountName: 'Sozialabgaben',
          operation: 'A',
          targetValue: '0',
          actualValue: '0',
        },
        {
          id: faker.string.uuid(),
          accountId: this.allAccounts.find(a => a.code === '2.1.3')!.id,
          accountCode: '2.1.3',
          accountName: 'Weiterbildung',
          operation: 'S',
          targetValue: '0',
          actualValue: '0',
        },
      ],
    };
  }

  private savedGroupData: AccountGroupDetails | null = null;

  private groupResource(organizationId: string, id: string): string {
    return `organizations/${organizationId}/accountGroups/${id}`;
  }

  getGroup(organizationId: string, id: string): Observable<AccountGroupDetails> {
    if (!this.savedGroupData) {
      this.savedGroupData = { ...this.groupData, id };
    }
    return of({ ...this.savedGroupData }).pipe(delay(300));
  }

  updateGroup(organizationId: string, id: string, name: string, description: string): Observable<AccountGroupDetails> {
    if (this.savedGroupData) {
      const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];
      if (this.savedGroupData.name !== name) {
        changes.push({ field: 'display_name', oldValue: this.savedGroupData.name, newValue: name });
      }
      if (this.savedGroupData.description !== description) {
        changes.push({ field: 'display_description', oldValue: this.savedGroupData.description, newValue: description });
      }
      if (changes.length > 0) {
        this.auditHistory.record(this.groupResource(organizationId, id), 'UPDATE', changes);
      }

      this.savedGroupData.name = name;
      this.savedGroupData.description = description;
    }
    return of({ ...this.groupData, id, name, description }).pipe(delay(300));
  }

  getAllAccountsWithOperations(organizationId: string, groupId: string): Observable<AccountWithOperation[]> {
    const accountsWithOps: AccountWithOperation[] = this.allAccounts.map((account) => {
      const assignment = this.groupData.assignments.find((a) => a.accountId === account.id) || null;
      return { account, assignment };
    });
    return of(accountsWithOps).pipe(delay(200));
  }

  updateAccountOperation(
    organizationId: string,
    groupId: string,
    accountId: string,
    operation: AccountGroupOperation,
    assignmentId?: string | null,
  ): Observable<string | null> {
    if (!this.savedGroupData) {
      this.savedGroupData = { ...this.groupData };
    }

    const existingIndex = this.savedGroupData.assignments.findIndex((a) =>
      assignmentId ? a.id === assignmentId : a.accountId === accountId,
    );
    const account = this.allAccounts.find((a) => a.id === accountId);

    if (!account) {
      return of(null).pipe(delay(100));
    }

    const recordAssignment = (
      assignmentId: string,
      action: 'CREATE' | 'UPDATE' | 'DELETE',
      changes: Array<{ field: string; oldValue?: string; newValue?: string }>,
    ): void => {
      this.auditHistory.record(
        `${this.groupResource(organizationId, groupId)}/assignments/${assignmentId}`,
        action,
        changes,
      );
    };

    if (operation === 'I') {
      // Remove assignment if set to 'I' (ignored)
      if (existingIndex !== -1) {
        const removed = this.savedGroupData.assignments[existingIndex];
        this.savedGroupData.assignments.splice(existingIndex, 1);
        this.savedGroupData.assignmentCount--;
        recordAssignment(removed.id, 'DELETE', [
          { field: 'account_id', oldValue: accountId },
          { field: 'negate', oldValue: String(removed.operation === 'S') },
        ]);
      }
      return of(null).pipe(delay(200));
    }

    let resultId: string;
    // Add or update assignment for 'A' or 'S'
    if (existingIndex !== -1) {
      const previous = this.savedGroupData.assignments[existingIndex].operation;
      this.savedGroupData.assignments[existingIndex].operation = operation;
      resultId = this.savedGroupData.assignments[existingIndex].id;
      recordAssignment(resultId, 'UPDATE', [
        { field: 'negate', oldValue: String(previous === 'S'), newValue: String(operation === 'S') },
      ]);
    } else {
      const newAssignmentId = faker.string.uuid();
      this.savedGroupData.assignments.push({
        id: newAssignmentId,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        operation,
        targetValue: '0',
        actualValue: '0',
      });
      this.savedGroupData.assignmentCount++;
      resultId = newAssignmentId;
      recordAssignment(newAssignmentId, 'CREATE', [
        { field: 'account_id', newValue: accountId },
        { field: 'negate', newValue: String(operation === 'S') },
      ]);
    }

    return of(resultId).pipe(delay(200));
  }

  deleteGroup(organizationId: string, id: string): Observable<void> {
    // Simulate deletion with delay
    return of(undefined).pipe(delay(500));
  }

  getAuditLog(organizationId: string, accountGroupId: string): Observable<AuditLogHistoryEntry[]> {
    return of(this.auditHistory.list(this.groupResource(organizationId, accountGroupId))).pipe(delay(300));
  }

  private createAccount(
    code: string,
    fullCode: string,
    name: string,
    parentAccountId: string | null,
    isArchived: boolean
  ): Account {
    return {
      id: faker.string.uuid(),
      code,
      fullCode,
      name,
      description: '',
      isArchived,
      parentAccountId,
    };
  }
}
