import { Injectable, computed, inject, signal } from '@angular/core';
import { Account, AccountGroupAssignment, AccountGroupOperation } from '../../../shared/models';
import { AccountWithOperation } from './account-group-edit.data-service';
import { AccountHierarchyService } from '../../../shared/services/account-hierarchy.service';

export interface AccountGroupRow {
  accountId: string;
  displayCode: string;
  displayName: string;
  fullCode: string;
  depth: number;
  isArchived: boolean;
  operation: AccountGroupOperation;
  assignmentId: string | null;
  account: Account;
}

@Injectable()
export class AccountGroupEditService {
  private readonly hierarchy = inject(AccountHierarchyService);

  private readonly accountsWithOps = signal<AccountWithOperation[]>([]);

  setAccountsWithOperations(accounts: AccountWithOperation[]): void {
    this.accountsWithOps.set(accounts);
  }

  /**
   * Applies a locally persisted operation change for one account without
   * reloading the whole list. `assignmentId` is the id returned by the
   * backend (null when the assignment was removed with 'I').
   */
  applyOperation(accountId: string, operation: AccountGroupOperation, assignmentId: string | null): void {
    this.accountsWithOps.update((items) =>
      items.map((item) => {
        if (item.account.id !== accountId) {
          return item;
        }
        if (operation === 'I' || !assignmentId) {
          return { ...item, assignment: null };
        }
        const assignment: AccountGroupAssignment = item.assignment
          ? { ...item.assignment, id: assignmentId, operation }
          : {
              id: assignmentId,
              accountId,
              accountCode: item.account.code,
              accountName: item.account.name,
              operation,
              targetValue: '0',
              actualValue: '0',
            };
        return { ...item, assignment };
      }),
    );
  }

  /**
   * Accounts in the canonical hierarchy order (depth-first, siblings
   * naturally sorted by code — identical to the /accounts list), with the
   * depth coming from the shared account hierarchy service.
   */
  readonly rows = computed((): AccountGroupRow[] => {
    const items = this.accountsWithOps();
    const itemByAccountId = new Map(items.map((item) => [item.account.id, item]));
    const ordered = this.hierarchy.flatten(items.map((item) => item.account));

    return ordered.map((account) => {
      const item = itemByAccountId.get(account.id)!;
      return {
        accountId: account.id,
        displayCode: account.code,
        displayName: account.name,
        fullCode: account.fullCode,
        depth: account.depth,
        isArchived: account.isArchived,
        operation: item.assignment?.operation ?? 'I',
        assignmentId: item.assignment?.id ?? null,
        account: item.account,
      };
    });
  });
}
