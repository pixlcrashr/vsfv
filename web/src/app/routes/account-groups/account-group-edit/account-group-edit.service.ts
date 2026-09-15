import { Injectable, computed, signal } from '@angular/core';
import { Account, AccountGroupAssignment, AccountGroupOperation } from '../../../shared/models';
import { AccountWithOperation } from './account-group-edit.data-service';
import { naturalCompare } from '../../../shared/utils/account-sort.utils';

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

  readonly maxDepth = computed(() => {
    const accounts = this.accountsWithOps();
    if (accounts.length === 0) return 0;
    return Math.max(...accounts.map(x => this.computeDepth(x.account)));
  });

  readonly accountCols = computed(() =>
    Array.from({ length: this.maxDepth() + 1 }, (_, i) => i)
  );

  private computeDepth(account: Account): number {
    return account.fullCode.split('.').length - 1;
  }

  readonly rows = computed((): AccountGroupRow[] => {
    const accounts = this.accountsWithOps();

    return accounts
      .map(item => ({
        accountId: item.account.id,
        displayCode: item.account.code,
        displayName: item.account.name,
        fullCode: item.account.fullCode,
        depth: this.computeDepth(item.account),
        isArchived: item.account.isArchived,
        operation: item.assignment?.operation ?? 'I',
        assignmentId: item.assignment?.id ?? null,
        account: item.account,
      }))
      // fullCode is the dotted code path, so a natural sort yields the
      // tree order (2 before 2.2 before 2.10 before 3).
      .sort((a, b) => naturalCompare(a.fullCode, b.fullCode));
  });
}
