import { Component, computed, inject, signal, effect, untracked, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { merge, map, distinctUntilChanged, filter } from 'rxjs';
import { Decimal } from 'decimal.js';
import { MatrixHeader, ExportButtonClickArgs } from "./matrix-header/matrix-header";
import { MatrixContent } from "./matrix-content/matrix-content";
import { MatrixValueStoreService } from './matrix-value-store.service';
import { MatrixValuesCacheService } from './matrix-values-cache.service';
import {
  MatrixData,
  MatrixDataProviderService,
  MatrixStructure,
} from './matrix-data-provider.service';
import { MatrixDataService, MatrixBudgetValueUpdate } from './matrix.data-service';
import { LoadingSpinnerComponent, NotificationService } from '../../shared/components';
import {
  ConfirmDialogComponent,
  ConfirmDialogInput,
  ConfirmDialogOutput,
} from '../../shared/dialogs/confirm-dialog/confirm-dialog.component';
import { HasPermissionPipe } from '../../../lib/authz/has-permission.pipe';
import { Permission, Permissions } from '../../../lib/authz/permissions';
import {
  ExportMatrixDialogComponent,
  ExportMatrixDialogInput,
  ExportMatrixDialogOutput,
} from '../../shared/dialogs/export-matrix-dialog/export-matrix-dialog.component';



@Component({
  selector: 'app-matrix',
  imports: [MatrixHeader, MatrixContent, LoadingSpinnerComponent, HasPermissionPipe],
  providers: [MatrixValueStoreService, MatrixDataProviderService],
  template: `
    <div class="flex flex-col h-full w-full min-w-[700px]">
      <app-matrix-header
        #matrixHeader
        [budgets]="budgets()"
        [accounts]="accounts()"
        [isLoading]="isLoading()"
        [isSaving]="isSaving()"
        [hasPendingChanges]="hasPendingChanges()"
        [canSave]="Permissions.MATRIX_UPDATE | hasPermission"
        [(selectedBudgetIds)]="selectedBudgetIds"
        [(selectedTagIds)]="selectedTagIds"
        [(selectedAccountIds)]="selectedAccountIds"
        (saveClick)="onSave()"
        (refreshClick)="onRefresh()"
        (exportButtonClick)="onExport($event)"
      />
      <div class="flex-grow overflow-auto">
        @if (isLoading() && !hasLoadedData()) {
          <app-loading-spinner i18n-text text="Matrix wird geladen..." [fullPage]="true" />
        } @else {
          @let data = matrixData();
          <app-matrix-content [matrixHeader]="matrixHeader" [matrixData]="data" [isSaving]="isSaving()" />
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
  `,
})
export class Matrix {
  private readonly route = inject(ActivatedRoute);
  private readonly dataProvider = inject(MatrixDataProviderService);
  private readonly dataService = inject(MatrixDataService);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  protected readonly valueStore = inject(MatrixValueStoreService);
  private readonly valuesCache = inject(MatrixValuesCacheService);

  private orgId = '';

  isLoading = signal(true);
  isSaving = signal(false);
  hasLoadedData = signal(false);
  readonly Permissions = Permissions;

  /** Selection-independent structure (budgets, revisions, accounts). */
  private structure: MatrixStructure | null = null;

  matrixData = signal<MatrixData>({
    columns: [],
    rows: [],
    budgets: [],
    accounts: []
  });

  budgets = computed(() => this.matrixData().budgets);
  accounts = computed(() => this.matrixData().accounts);

  hasPendingChanges = computed(() =>
    this.matrixData().rows.some(row =>
      row.values.some(v => this.valueStore.hasChanged(v.budgetId, row.accountId))
    )
  );

  selectedBudgetIds = signal<string[]>([]);
  selectedTagIds = signal<string[]>([]);
  selectedAccountIds = signal<string[]>([]);

  private readonly groupAccountValueSignals = new Map<string, Signal<Decimal>>();

  private groupAccountValueKey(budgetId: string, tagId: string, accountId: string): string {
    return `${budgetId}|${tagId}|${accountId}`;
  }

  /**
   * Group accounts (parent accounts in the account tree) carry no stored values
   * of their own — the API only ever returns leaf values — so their value for a
   * single budget revision must be computed locally as the sum of all leaf
   * values below them. The sums are built as a signal chain: every group
   * account's signal adds up its immediate children's signals, so a parent
   * group containing subgroups refers to the subgroup's signal instead of
   * re-walking all leaves. Leaves use the per-revision target signals carried
   * on their matrix rows.
   */
  getGroupAccountValue(budgetId: string, tagId: string, accountId: string): Signal<Decimal> | undefined {
    return this.groupAccountValueSignals.get(this.groupAccountValueKey(budgetId, tagId, accountId));
  }

  private buildGroupAccountValueSignals(): void {
    this.groupAccountValueSignals.clear();

    const data = this.matrixData();

    const childrenByParentId = new Map<string | null, string[]>();
    for (const account of data.accounts) {
      const siblings = childrenByParentId.get(account.parentAccountId) ?? [];
      siblings.push(account.id);
      childrenByParentId.set(account.parentAccountId, siblings);
    }

    const rowByAccountId = new Map(
      data.rows.filter(row => !row.isSumRow).map(row => [row.accountId, row])
    );

    const leafTargetSignal = (budgetId: string, tagId: string, accountId: string): Signal<Decimal> | undefined =>
      rowByAccountId.get(accountId)
        ?.values.find(v => v.budgetId === budgetId)
        ?.tags.find(t => t.tagId === tagId)
        ?.targetValue;

    // (budgetId, tagId) pairs actually carried by the rows — the selection.
    const selectedPairs: Array<{ budgetId: string; tagId: string }> = [];
    for (const row of data.rows) {
      if (row.isSumRow) {
        continue;
      }
      for (const value of row.values) {
        for (const tag of value.tags) {
          if (!selectedPairs.some(p => p.budgetId === value.budgetId && p.tagId === tag.tagId)) {
            selectedPairs.push({ budgetId: value.budgetId, tagId: tag.tagId });
          }
        }
      }
      break;
    }

    // Build deepest-first so a parent group's computed signal can reference the
    // subgroup signals that were created for its children beforehand.
    const depthSortedAccounts = [...data.accounts].sort((a, b) => b.depth - a.depth);

    for (const account of depthSortedAccounts) {
      const children = childrenByParentId.get(account.id) ?? [];
      if (children.length === 0) {
        continue; // leaf accounts keep the per-revision signals from their rows
      }

      for (const { budgetId, tagId } of selectedPairs) {
        const childSignals = children
          .map(childId =>
            this.groupAccountValueSignals.get(this.groupAccountValueKey(budgetId, tagId, childId))
            ?? leafTargetSignal(budgetId, tagId, childId)
          )
          .filter((s): s is Signal<Decimal> => !!s);

        this.groupAccountValueSignals.set(
          this.groupAccountValueKey(budgetId, tagId, account.id),
          computed(() =>
            childSignals.reduce((sum, childSignal) => sum.plus(childSignal()), new Decimal(0))
          )
        );
      }
    }

    // Expose the computed signals on the matrix rows so the table renders them.
    // Sum rows carry their source account's id because they duplicate group
    // rows. Diff values are rebuilt against the static actual value.
    this.matrixData.update(d => ({
      ...d,
      rows: d.rows.map(row => {
        const sourceAccountId = (row.isSumRow ? row.sourceAccountId : null) ?? row.accountId;

        return {
          ...row,
          values: row.values.map(value => ({
            ...value,
            tags: value.tags.map(tag => {
              const targetValueSignal = this.groupAccountValueSignals.get(
                this.groupAccountValueKey(value.budgetId, tag.tagId, sourceAccountId)
              );

              return targetValueSignal
                ? {
                    ...tag,
                    targetValue: targetValueSignal,
                    diffValue: computed(() => targetValueSignal().minus(value.actualValue)),
                  }
                : tag;
            })
          }))
        };
      })
    }));
  }

  private readonly configKey = computed(() => `vsfv:matrix-config:${this.orgId}`);

  private saveConfigToStorage(): void {
    const key = this.configKey();
    if (!key) return;
    const config = {
      selectedBudgetIds: this.selectedBudgetIds(),
      selectedTagIds: this.selectedTagIds(),
      selectedAccountIds: this.selectedAccountIds(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(config));
    } catch {}
  }

  private loadConfigFromStorage(): { selectedBudgetIds: string[]; selectedTagIds: string[]; selectedAccountIds: string[] } | null {
    const key = this.configKey();
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  constructor() {
    // Any selection change loads the values that are not cached yet.
    // The effect must depend on the selection signals only: the rebuild reads
    // and writes matrixData, so running it tracked would make every rebuild
    // re-trigger the effect — an infinite loop that freezes the page whenever
    // the change can be served synchronously from the cache (e.g. deselecting
    // a budget whose values were already loaded).
    effect(() => {
      this.selectedBudgetIds();
      this.selectedTagIds();
      this.selectedAccountIds();
      this.saveConfigToStorage();

      if (this.structure) {
        untracked(() => this.ensureValues());
      }
    });

    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe((id) => {
      this.orgId = id;
      this.isLoading.set(true);
      this.hasLoadedData.set(false);
      this.structure = null;
      this.matrixData.set({ columns: [], rows: [], budgets: [], accounts: [] });
      this.buildGroupAccountValueSignals();
      this.valuesCache.clear();
      this.dataProvider.reset();
      this.valueStore.resetAllToOriginal();
      const saved = this.loadConfigFromStorage();
      this.selectedBudgetIds.set(saved?.selectedBudgetIds ?? []);
      this.selectedTagIds.set(saved?.selectedTagIds ?? []);
      this.selectedAccountIds.set(saved?.selectedAccountIds ?? []);
      this.loadStructure(saved);
    });
  }

  private loadStructure(saved: ReturnType<Matrix['loadConfigFromStorage']>): void {
    this.dataProvider.getStructure(this.orgId).subscribe({
      next: (structure) => {
        this.structure = structure;
        // Setting the selection triggers the selection effect, which calls
        // ensureValues for the (possibly defaulted) selection.
        this.applyDefaultSelection(structure, saved);
        this.saveConfigToStorage();
      },
      error: () => this.isLoading.set(false),
    });
  }

  /**
   * Applies the saved selection (validated against the structure) or the
   * defaults: the latest budget (by period start) with its latest revision
   * (by revision date), and every account except archived ones.
   */
  private applyDefaultSelection(
    structure: MatrixStructure,
    saved: ReturnType<Matrix['loadConfigFromStorage']>,
  ): void {
    const savedBudgetIds = (saved?.selectedBudgetIds ?? []).filter(id =>
      structure.budgets.some(b => b.id === id)
    );
    if (savedBudgetIds.length > 0) {
      this.selectedBudgetIds.set(savedBudgetIds);
    } else if (structure.budgets.length > 0) {
      const latestBudget = [...structure.budgets].sort(
        (a, b) => b.periodStart.getTime() - a.periodStart.getTime()
      )[0];
      this.selectedBudgetIds.set(latestBudget ? [latestBudget.id] : []);
    } else {
      this.selectedBudgetIds.set([]);
    }

    const savedTagIds = (saved?.selectedTagIds ?? []).filter(id =>
      structure.budgets.some(b => b.tags.some(t => t.id === id))
    );
    if (savedTagIds.length > 0) {
      this.selectedTagIds.set(savedTagIds);
    } else {
      // Latest revision (by date, falling back to creation) of the first
      // selected budget.
      const budget = structure.budgets.find(b => this.selectedBudgetIds().includes(b.id));
      const latestTag = budget
        ? [...budget.tags].sort((a, b) =>
            (b.date.getTime() || b.createdAt.getTime()) - (a.date.getTime() || a.createdAt.getTime())
          )[0]
        : undefined;
      this.selectedTagIds.set(latestTag ? [latestTag.id] : []);
    }

    // Keep every account selected except archived ones (also archived
    // accounts from a persisted selection are dropped).
    const savedAccountIds = (saved?.selectedAccountIds ?? []).filter(id =>
      structure.accounts.some(a => a.id === id && !a.isArchived)
    );
    if (savedAccountIds.length > 0) {
      this.selectedAccountIds.set(savedAccountIds);
    } else {
      this.selectedAccountIds.set(
        structure.accounts.filter(a => !a.isArchived).map(a => a.id)
      );
    }
  }

  /**
   * Fetches the values for the selected budgets/revisions that are not cached
   * yet, then rebuilds the matrix. Already cached values are served from the
   * cache, so selecting an additional revision only requests that revision.
   */
  private ensureValues(): void {
    const structure = this.structure;
    if (!structure) {
      return;
    }

    const selectedBudgetIds = this.selectedBudgetIds().filter(id =>
      structure.budgets.some(b => b.id === id)
    );
    const selectedRevisions = structure.budgets
      .flatMap(b => b.tags)
      .filter(tag => this.selectedTagIds().includes(tag.id));

    const missingBudgetIds = selectedBudgetIds.filter(id => !this.valuesCache.hasBudget(id));
    const missingRevisions = selectedRevisions.filter(tag => !this.valuesCache.hasRevision(tag.id));

    if (missingBudgetIds.length === 0 && missingRevisions.length === 0) {
      this.rebuildMatrix();
      return;
    }

    this.isLoading.set(true);

    this.dataProvider.loadValues(this.orgId, missingBudgetIds, missingRevisions).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.rebuildMatrix();
      },
      error: () => {
        this.isLoading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Matrix-Werte`);
        this.rebuildMatrix();
      },
    });
  }

  private rebuildMatrix(): void {
    if (!this.structure) {
      return;
    }

    this.matrixData.set(this.dataProvider.buildMatrixData(
      this.structure,
      this.selectedBudgetIds(),
      this.selectedTagIds(),
    ));
    this.buildGroupAccountValueSignals();
    this.hasLoadedData.set(true);
    this.isLoading.set(false);
  }

  /** Re-fetches the values of the currently selected budgets and revisions. */
  onRefresh(): void {
    const proceed = () => {
      this.valuesCache.clear();
      this.dataProvider.reset();
      this.valueStore.resetAllToOriginal();
      this.ensureValues();
    };

    if (this.hasPendingChanges()) {
      const dialogRef = this.dialog.open<ConfirmDialogOutput, ConfirmDialogInput>(
        ConfirmDialogComponent,
        {
          backdropClass: 'cdk-overlay-dark-backdrop',
          width: '500px',
          data: {
            title: $localize`Änderungen verwerfen?`,
            message: $localize`Beim Aktualisieren werden nicht gespeicherte Änderungen verworfen und die ausgewählten Werte neu geladen.`,
            confirmLabel: $localize`Aktualisieren`,
          },
        }
      );

      dialogRef.closed.subscribe((result) => {
        if (result?.confirmed) {
          proceed();
        }
      });
      return;
    }

    proceed();
  }

  onSave(): void {
    const allChangedValues = this.valueStore.getAllChangedValues();

    if (allChangedValues.size === 0) {
      return;
    }

    const updates: MatrixBudgetValueUpdate[] = [];
    allChangedValues.forEach((changedValues, budgetId) => {
      changedValues.forEach(cv => {
        updates.push({
          budgetId,
          accountId: cv.accountId,
          value: cv.value
        });
      });
    });

    this.isSaving.set(true);

    this.dataService.updateMatrixBudgetValues(this.orgId, updates).subscribe({
      next: () => {
        this.valueStore.markAllAsClean();
        this.matrixData.update(d => ({ ...d }));
        this.isSaving.set(false);
      },
      error: () => {
        this.isSaving.set(false);
      }
    });
  }

  onExport(_args: ExportButtonClickArgs): void {
    const dialogRef = this.dialog.open<ExportMatrixDialogOutput, ExportMatrixDialogInput>(
      ExportMatrixDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          organizationId: this.orgId,
          templates: [],
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.confirmed) {
        // TODO: Implement actual export logic once backend supports it
      }
    });
  }
}
