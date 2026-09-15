import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import {
  MatrixDataService,
  MatrixEditableValuesByBudget
} from './matrix.data-service';
import { MatrixValueStoreService } from './matrix-value-store.service';
import { forkJoin, map, Observable } from 'rxjs';
import { Decimal } from 'decimal.js';
import { naturalCompare } from '../../shared/utils/account-sort.utils';



export interface BudgetTag {
  id: string;
  displayName: string;
  displayDescription: string;
  createdAt: Date;
}

export interface Budget {
  id: string;
  displayName: string;
  displayDescription: string;
  isClosed: boolean;
  tags: BudgetTag[];
}

export interface Account {
  id: string;
  name: string;
  displayCode: string;
  displayDescription: string;
  depth: number;
  parentAccountId: string | null;
  isArchived: boolean;
}

export interface MatrixColumn {
  budgetId: string;
  displayName: string;
  displayDescription: string;
  date: Date;
  tags: {
    tagId: string;
    displayName: string;
    displayDescription: string;
    createdAt: Date;
  }[];
}

export interface MatrixRow {
  accountId: string;
  depth: number;
  displayName: string;
  displayCode: string;
  displayDescription: string;
  isSumRow: boolean;
  sourceAccountId: string | null;
  isParent: boolean;
  isArchived: boolean;
  values: {
    budgetId: string;
    /**
     * Actual values are not expected to change once the page was opened, so
     * they stay plain Decimals.
     */
    actualValue: Decimal;
    editableTargetValue: Signal<Decimal>;
    editableTargetWritableValue?: WritableSignal<Decimal>;
    tags: {
      tagId: string;
      isLatest: boolean;
      /**
       * Target value per budget revision. The matrix component replaces these
       * with a signal chain that sums the leaf values below group accounts, so
       * the latest revision reflects pending edits live.
       */
      targetValue: Signal<Decimal>;
      /** Target minus actual; recomputed when the target signal changes. */
      diffValue: Signal<Decimal>;
    }[]
  }[]
}

export interface MatrixData {
  columns: MatrixColumn[];
  rows: MatrixRow[];
  accounts: Account[];
  budgets: Budget[];
}

@Injectable()
export class MatrixDataProviderService {
  private matrixDataService = inject(MatrixDataService);
  private valueStore = inject(MatrixValueStoreService);

  private getBudgetAccountTagKey(budgetId: string, accountId: string, tagId: string): string {
    return `${budgetId}-${accountId}-${tagId}`;
  }

  private getBudgetAccountKey(budgetId: string, accountId: string): string {
    return `${budgetId}-${accountId}`;
  }

  private isLeafAccount(account: Account, accounts: Account[]): boolean {
    return !accounts.some(a => a.parentAccountId === account.id);
  }

  private getTargetRevisionValue(
    targetValuesByBudgetAccountTag: Map<string, Decimal>,
    budgetId: string,
    accountId: string,
    tagId: string
  ): Decimal {
    return targetValuesByBudgetAccountTag.get(this.getBudgetAccountTagKey(budgetId, accountId, tagId)) ?? new Decimal(0);
  }

  private getActualBudgetValue(
    actualValuesByBudgetAccount: Map<string, Decimal>,
    budgetId: string,
    accountId: string
  ): Decimal {
    return actualValuesByBudgetAccount.get(this.getBudgetAccountKey(budgetId, accountId)) ?? new Decimal(0);
  }

  getMatrixData(organizationId: string): Observable<MatrixData> {
    return forkJoin([
      this.matrixDataService.listBudgets(organizationId),
      this.matrixDataService.listAccounts(organizationId),
      this.matrixDataService.listMatrixTargetValues(organizationId),
      this.matrixDataService.listMatrixActualValues(organizationId),
      this.matrixDataService.listMatrixEditableValues(organizationId)
    ]).pipe(
      map(([budgets, accounts, targetValues, actualValues, editableValuesByBudget]) => {
        const accountById = new Map(accounts.map(account => [account.id, account]));
        const childrenByParentId = new Map<string | null, Account[]>();
        const leafAccounts = accounts.filter(account => this.isLeafAccount(account, accounts));
        const depthSortedAccounts = [...accounts].sort((a, b) => b.depth - a.depth);

        accounts.forEach(account => {
          const siblings = childrenByParentId.get(account.parentAccountId) ?? [];
          siblings.push(account);
          childrenByParentId.set(account.parentAccountId, siblings);
        });

        // Sort siblings naturally by display code (1, 2, 10 — not 1, 10, 2) and
        // flatten depth-first, so the flat order drives both the matrix row tree
        // and the header account list.
        const compareByDisplayCode = (a: Account, b: Account) => naturalCompare(a.displayCode, b.displayCode);

        for (const siblings of childrenByParentId.values()) {
          siblings.sort(compareByDisplayCode);
        }

        const sortedAccounts: Account[] = [];
        const appendedAccountIds = new Set<string>();
        const appendWithDescendants = (account: Account): void => {
          if (appendedAccountIds.has(account.id)) {
            return;
          }
          appendedAccountIds.add(account.id);
          sortedAccounts.push(account);
          (childrenByParentId.get(account.id) ?? []).forEach(appendWithDescendants);
        };
        (childrenByParentId.get(null) ?? []).forEach(appendWithDescendants);
        // Accounts whose parent is not part of the list render at the end, like
        // the unvisited rows below.
        accounts
          .filter(account => !appendedAccountIds.has(account.id))
          .sort(compareByDisplayCode)
          .forEach(appendWithDescendants);

        const targetValuesByBudgetAccountTag = new Map<string, Decimal>();
        Object.entries(targetValues).forEach(([tagId, accountMap]) => {
          const budget = budgets.find(b => b.tags.some(t => t.id === tagId));
          if (!budget) {
            return;
          }

          Object.entries(accountMap).forEach(([accountId, value]) => {
            const account = accountById.get(accountId);
            if (!account || !this.isLeafAccount(account, accounts)) {
              return;
            }

            targetValuesByBudgetAccountTag.set(
              this.getBudgetAccountTagKey(budget.id, accountId, tagId),
              value.targetValue
            );
          });
        });

        depthSortedAccounts.forEach(account => {
          const children = childrenByParentId.get(account.id) ?? [];
          if (children.length === 0) {
            return;
          }

          budgets.forEach(budget => {
            budget.tags.forEach(tag => {
              const sum = children.reduce(
                (acc, child) => acc.plus(this.getTargetRevisionValue(targetValuesByBudgetAccountTag, budget.id, child.id, tag.id)),
                new Decimal(0)
              );

              targetValuesByBudgetAccountTag.set(this.getBudgetAccountTagKey(budget.id, account.id, tag.id), sum);
            });
          });
        });

        const actualValuesByBudgetAccount = new Map<string, Decimal>();
        Object.entries(actualValues).forEach(([budgetId, accountMap]) => {
          Object.entries(accountMap).forEach(([accountId, value]) => {
            const account = accountById.get(accountId);
            if (!account || !this.isLeafAccount(account, accounts)) {
              return;
            }

            actualValuesByBudgetAccount.set(
              this.getBudgetAccountKey(budgetId, accountId),
              value.actualValue
            );
          });
        });

        depthSortedAccounts.forEach(account => {
          const children = childrenByParentId.get(account.id) ?? [];
          if (children.length === 0) {
            return;
          }

          budgets.forEach(budget => {
            const sum = children.reduce(
              (acc, child) => acc.plus(this.getActualBudgetValue(actualValuesByBudgetAccount, budget.id, child.id)),
              new Decimal(0)
            );

            actualValuesByBudgetAccount.set(this.getBudgetAccountKey(budget.id, account.id), sum);
          });
        });

        const editableValuesLookup = new Map<string, MatrixEditableValuesByBudget['editableValues']>(
          editableValuesByBudget.map(item => [item.budgetId, item.editableValues])
        );

        budgets.forEach(budget => {
          const budgetEditableValues = editableValuesLookup.get(budget.id) ?? {};
          const latestTag = budget.tags[budget.tags.length - 1];

          leafAccounts.forEach(account => {
            const rawEditableValue = budgetEditableValues[account.id];
            const fallback = latestTag
              ? this.getTargetRevisionValue(targetValuesByBudgetAccountTag, budget.id, account.id, latestTag.id)
              : new Decimal(0);

            const editableValue = rawEditableValue === undefined
              ? fallback
              : rawEditableValue;

            this.valueStore.updateEditableTargetValue(budget.id, account.id, editableValue, true);
          });
        });

        depthSortedAccounts.forEach(account => {
          const children = childrenByParentId.get(account.id) ?? [];
          if (children.length === 0) {
            return;
          }

          budgets.forEach(budget => {
            const childSignals = children.map(child =>
              this.valueStore.getEditableTargetValue(budget.id, child.id)
            );

            this.valueStore.setEditableTargetAggregateValue(budget.id, account.id, childSignals);
          });
        });

        const columns: MatrixColumn[] = budgets.map(budget => ({
          budgetId: budget.id,
          displayName: budget.displayName,
          displayDescription: budget.displayDescription,
          date: new Date(), // Mock date
          tags: budget.tags.map(tag => ({
            tagId: tag.id,
            displayName: tag.displayName,
            displayDescription: tag.displayDescription,
            createdAt: tag.createdAt
          }))
        }));

        const rows: MatrixRow[] = sortedAccounts.map(account => {
          const isParent = (childrenByParentId.get(account.id) ?? []).length > 0;

          return {
            accountId: account.id,
            depth: account.depth,
            displayCode: account.displayCode,
            displayName: account.name,
            displayDescription: account.displayDescription,
            isSumRow: false,
            sourceAccountId: null,
            isParent,
            isArchived: account.isArchived,
            values: budgets.map(budget => {
              const editableTargetValue = this.valueStore.getEditableTargetValue(budget.id, account.id);
              const editableTargetWritableValue = 'set' in editableTargetValue
                ? editableTargetValue as WritableSignal<Decimal>
                : undefined;
              const actualValue = this.getActualBudgetValue(actualValuesByBudgetAccount, budget.id, account.id);

              return {
                budgetId: budget.id,
                actualValue,
                editableTargetValue,
                editableTargetWritableValue,
                tags: budget.tags.map((tag, index) => {
                  const staticTargetValue = this.getTargetRevisionValue(
                    targetValuesByBudgetAccountTag,
                    budget.id,
                    account.id,
                    tag.id
                  );
                  const targetValueSignal = signal(staticTargetValue);

                  return {
                    tagId: tag.id,
                    isLatest: index === budget.tags.length - 1,
                    targetValue: targetValueSignal,
                    diffValue: computed(() => targetValueSignal().minus(actualValue))
                  };
                })
              };
            })
          };
        });

        const rowByAccountId = new Map(rows.map(row => [row.accountId, row]));

        const visited = new Set<string>();
        const buildRowsForAccount = (account: Account): MatrixRow[] => {
          const row = rowByAccountId.get(account.id);
          if (!row) {
            return [];
          }

          visited.add(account.id);

          const children = childrenByParentId.get(account.id) ?? [];
          if (children.length === 0) {
            return [row];
          }

          const descendants = children.flatMap(child => buildRowsForAccount(child));

          const sumRow: MatrixRow = {
            accountId: `${row.accountId}__sum`,
            sourceAccountId: row.accountId,
            depth: row.depth,
            displayCode: row.displayCode,
            displayName: `Summe ${row.displayName}`,
            displayDescription: row.displayDescription,
            isSumRow: true,
            isParent: false,
            isArchived: row.isArchived,
            values: row.values
          };

          return [row, ...descendants, sumRow];
        };

        const rootAccounts = childrenByParentId.get(null) ?? [];
        const rowsWithSums = rootAccounts.flatMap(root => buildRowsForAccount(root));

        rows.forEach(row => {
          if (!visited.has(row.accountId)) {
            rowsWithSums.push(row);
          }
        });

        return {
          columns,
          rows: rowsWithSums,
          budgets,
          accounts: sortedAccounts
        };
      })
    );
  }
}
