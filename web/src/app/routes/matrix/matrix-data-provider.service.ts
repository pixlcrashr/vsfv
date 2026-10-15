import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';
import { Decimal } from 'decimal.js';
import {
  MatrixDataService,
  MatrixEditableValuesByBudget
} from './matrix.data-service';
import { MatrixValueStoreService } from './matrix-value-store.service';
import { MatrixValuesCacheService } from './matrix-values-cache.service';
import {
  AccountHierarchyIndex,
  AccountHierarchyService,
  AccountWithDepth,
} from '../../shared/services/account-hierarchy.service';

export interface BudgetTag {
  id: string;
  /** Full resource name of the revision, e.g. organizations/{org}/budgets/{budget}/revisions/{revision}. */
  name: string;
  displayName: string;
  displayDescription: string;
  /** Revision date; revisions are ordered and defaulted by this date. */
  date: Date;
  createdAt: Date;
}

export interface Budget {
  id: string;
  displayName: string;
  displayDescription: string;
  isClosed: boolean;
  /** Budget period start; the latest budget is the default selection. */
  periodStart: Date;
  /** Revisions ordered by revision date descending (newest first). */
  tags: BudgetTag[];
}

export interface Account {
  id: string;
  /** Sort key for the hierarchy; equals displayCode. */
  code: string;
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
  }[];
}

export interface MatrixData {
  columns: MatrixColumn[];
  rows: MatrixRow[];
  accounts: AccountWithDepth<Account>[];
  budgets: Budget[];
}

/** Structure of the matrix, loaded once per organization. */
export interface MatrixStructure {
  budgets: Budget[];
  /** Accounts in canonical hierarchy order, depth annotated. */
  accounts: AccountWithDepth<Account>[];
  index: AccountHierarchyIndex<Account>;
}

@Injectable()
export class MatrixDataProviderService {
  private matrixDataService = inject(MatrixDataService);
  private valueStore = inject(MatrixValueStoreService);
  private valuesCache = inject(MatrixValuesCacheService);
  private hierarchy = inject(AccountHierarchyService);

  /** Budgets whose editable values were already seeded into the value store. */
  private initializedBudgets = new Set<string>();

  /** Drops per-organization state (call when the organization changes). */
  reset(): void {
    this.initializedBudgets.clear();
  }

  /**
   * Loads the selection-independent structure: budgets with their revisions
   * and the account hierarchy in canonical order.
   */
  getStructure(organizationId: string): Observable<MatrixStructure> {
    return forkJoin([
      this.matrixDataService.listBudgets(organizationId),
      this.matrixDataService.listAccounts(organizationId),
    ]).pipe(
      map(([budgets, accounts]) => {
        const index = this.hierarchy.index(accounts);
        return { budgets, accounts: index.ordered, index };
      }),
    );
  }

  /**
   * Fetches the values for the given budgets and revisions (resource names
   * included) and puts them into the route-scoped cache. Callers pass only
   * what is missing; already cached budgets/revisions are not requested
   * again.
   */
  loadValues(
    organizationId: string,
    budgetIds: string[],
    revisions: BudgetTag[],
  ): Observable<void> {
    const editable$: Observable<void> = budgetIds.length > 0
      ? this.matrixDataService.listMatrixEditableValues(organizationId, budgetIds).pipe(
          map((rows: MatrixEditableValuesByBudget[]) => {
            for (const row of rows) {
              this.valuesCache.putEditable(row.budgetId, new Map(Object.entries(row.editableValues)));
            }
          }),
        )
      : of(void 0);

    const target$: Observable<void> = revisions.length > 0
      ? this.matrixDataService.listMatrixTargetValues(organizationId, revisions.map(r => r.name)).pipe(
          map((values) => {
            for (const revision of revisions) {
              const perAccount = values[revision.id] ?? {};
              const mapped = new Map<string, Decimal>();
              for (const [accountId, value] of Object.entries(perAccount)) {
                mapped.set(accountId, value.targetValue);
              }
              this.valuesCache.putTarget(revision.id, mapped);
            }
          }),
        )
      : of(void 0);

    const actual$: Observable<void> = budgetIds.length > 0
      ? this.matrixDataService.listMatrixActualValues(organizationId, budgetIds).pipe(
          map((values) => {
            for (const budgetId of budgetIds) {
              const perAccount = values[budgetId] ?? {};
              const mapped = new Map<string, Decimal>();
              for (const [accountId, value] of Object.entries(perAccount)) {
                mapped.set(accountId, value.actualValue);
              }
              this.valuesCache.putActual(budgetId, mapped);
            }
          }),
        )
      : of(void 0);

    return forkJoin([editable$, target$, actual$]).pipe(map(() => void 0));
  }

  /**
   * Builds the matrix for the current selection. Rows carry values for the
   * selected budgets and revisions only; everything comes from the values
   * cache.
   */
  buildMatrixData(
    structure: MatrixStructure,
    selectedBudgetIds: string[],
    selectedTagIds: string[],
  ): MatrixData {
    const { budgets, index } = structure;
    const cache = this.valuesCache.snapshot();

    // Preserve the budgets-array order for columns and row values.
    const selectedBudgets = budgets.filter(budget => selectedBudgetIds.includes(budget.id));
    const selectedTagsByBudgetId = new Map<string, BudgetTag[]>(
      selectedBudgets.map(budget => [budget.id, budget.tags.filter(tag => selectedTagIds.includes(tag.id))]),
    );

    const targetByKey = new Map<string, Decimal>();
    const actualByKey = new Map<string, Decimal>();
    const targetKey = (budgetId: string, tagId: string, accountId: string): string =>
      `${budgetId}|${tagId}|${accountId}`;
    const actualKey = (budgetId: string, accountId: string): string => `${budgetId}|${accountId}`;

    const isLeaf = (account: AccountWithDepth<Account>): boolean => !index.isParent(account.id);

    for (const account of index.ordered) {
      if (!isLeaf(account)) {
        continue;
      }
      for (const budget of selectedBudgets) {
        for (const tag of selectedTagsByBudgetId.get(budget.id) ?? []) {
          targetByKey.set(
            targetKey(budget.id, tag.id, account.id),
            cache.target.get(tag.id)?.get(account.id) ?? new Decimal(0),
          );
        }
        actualByKey.set(
          actualKey(budget.id, account.id),
          cache.actual.get(budget.id)?.get(account.id) ?? new Decimal(0),
        );
      }
    }

    // Group accounts carry no stored values; their cells sum the values of
    // all leaf accounts below them.
    const depthSortedAccounts = [...index.ordered].sort((a, b) => b.depth - a.depth);
    for (const account of depthSortedAccounts) {
      const children = index.childrenOf(account.id);
      if (children.length === 0) {
        continue;
      }
      for (const budget of selectedBudgets) {
        for (const tag of selectedTagsByBudgetId.get(budget.id) ?? []) {
          const sum = children.reduce(
            (acc, child) => acc.plus(targetByKey.get(targetKey(budget.id, tag.id, child.id)) ?? new Decimal(0)),
            new Decimal(0),
          );
          targetByKey.set(targetKey(budget.id, tag.id, account.id), sum);
        }
        const actualSum = children.reduce(
          (acc, child) => acc.plus(actualByKey.get(actualKey(budget.id, child.id)) ?? new Decimal(0)),
          new Decimal(0),
        );
        actualByKey.set(actualKey(budget.id, account.id), actualSum);
      }
    }

    // Seed the editable store values once per budget. Rebuilding for a
    // selection change must not clobber pending edits of already-seeded
    // budgets, so those keep the signals living in the store.
    for (const budget of selectedBudgets) {
      if (this.initializedBudgets.has(budget.id)) {
        continue;
      }
      this.initializedBudgets.add(budget.id);

      const editableValues = cache.editable.get(budget.id);
      const tags = selectedTagsByBudgetId.get(budget.id) ?? [];
      const fallbackTag = tags[0];

      for (const account of index.ordered) {
        if (!isLeaf(account)) {
          continue;
        }
        const rawEditableValue = editableValues?.get(account.id);
        const fallback = fallbackTag
          ? (cache.target.get(fallbackTag.id)?.get(account.id) ?? new Decimal(0))
          : new Decimal(0);
        this.valueStore.updateEditableTargetValue(budget.id, account.id, rawEditableValue ?? fallback, true);
      }
    }

    // Aggregate editable signals for group accounts (sum of child signals).
    for (const account of depthSortedAccounts) {
      const children = index.childrenOf(account.id);
      if (children.length === 0) {
        continue;
      }
      for (const budget of selectedBudgets) {
        const childSignals = children.map(child =>
          this.valueStore.getEditableTargetValue(budget.id, child.id),
        );
        this.valueStore.setEditableTargetAggregateValue(budget.id, account.id, childSignals);
      }
    }

    const columns: MatrixColumn[] = budgets.map(budget => ({
      budgetId: budget.id,
      displayName: budget.displayName,
      displayDescription: budget.displayDescription,
      date: budget.periodStart,
      tags: budget.tags.map(tag => ({
        tagId: tag.id,
        displayName: tag.displayName,
        displayDescription: tag.displayDescription,
        createdAt: tag.createdAt
      }))
    }));

    const rows: MatrixRow[] = index.ordered.map(account => {
      const isParent = index.isParent(account.id);

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
        values: selectedBudgets.map(budget => {
          const editableTargetValue = this.valueStore.getEditableTargetValue(budget.id, account.id);
          const editableTargetWritableValue = 'set' in editableTargetValue
            ? editableTargetValue as WritableSignal<Decimal>
            : undefined;
          const actualValue = actualByKey.get(actualKey(budget.id, account.id)) ?? new Decimal(0);
          const latestTagId = budget.tags[0]?.id;

          return {
            budgetId: budget.id,
            actualValue,
            editableTargetValue,
            editableTargetWritableValue,
            tags: (selectedTagsByBudgetId.get(budget.id) ?? []).map(tag => {
              const staticTargetValue = targetByKey.get(targetKey(budget.id, tag.id, account.id)) ?? new Decimal(0);
              const targetValueSignal = signal(staticTargetValue);

              return {
                tagId: tag.id,
                isLatest: tag.id === latestTagId,
                targetValue: targetValueSignal,
                diffValue: computed(() => targetValueSignal().minus(actualValue))
              };
            })
          };
        })
      };
    });

    const visited = new Set<string>();
    const rowByAccountId = new Map(rows.map(row => [row.accountId, row]));
    const buildRowsForAccount = (account: AccountWithDepth<Account>): MatrixRow[] => {
      const row = rowByAccountId.get(account.id);
      if (!row) {
        return [];
      }

      visited.add(account.id);

      const children = index.childrenOf(account.id);
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

    const rootAccounts = index.childrenOf(null);
    const rowsWithSums = rootAccounts.flatMap(root => buildRowsForAccount(root));

    for (const row of rows) {
      if (!visited.has(row.accountId)) {
        rowsWithSums.push(row);
      }
    }

    return {
      columns,
      rows: rowsWithSums,
      budgets,
      accounts: index.ordered
    };
  }
}
