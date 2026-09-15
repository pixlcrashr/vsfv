import { Component, computed, effect, inject, input } from '@angular/core';
import { MatrixHeader } from '../matrix-header/matrix-header';
import { MatrixData } from '../matrix-data-provider.service';
import { MatrixValueSpan } from "../matrix-value-span/matrix-value-span";
import { MatrixValueInput } from "../matrix-value-input/matrix-value-input";
import { MatrixValueStoreService } from '../matrix-value-store.service';



@Component({
  selector: 'app-matrix-content',
  imports: [MatrixValueSpan, MatrixValueInput],
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      color: var(--color-text-primary);
    }

    .fullwidth {
      width: 100%;
    }

    .fullheight {
      height: 100%;
    }

      table {
        font-size: 10pt;
        /* font-family: "Arial", monospace; */
        background-color: var(--color-bg-primary);
        color: var(--color-text-primary);

        tbody > tr:first-child > :is(td, th) {
        border-color: var(--color-border);
      }

      tbody > tr:nth-child(odd) > td {
        background-color: var(--color-bg-primary);
      }

      tbody > tr:nth-child(even) > td {
        background-color: var(--color-bg-secondary, rgba(127, 127, 127, 0.08));
      }

      thead {
        position: sticky;
        top: 0;
        z-index: 20;

        th {
          background-color: var(--color-bg-primary);
        }
      }

      /* The bold separators below the header and after the account columns are
         drawn as inset shadows on the boundary cells: collapsed-table borders
         on tr/colgroup do not travel with sticky cells, shadows do. */
      thead tr:last-child th,
      thead th[rowspan="3"] {
        box-shadow: inset 0 -4px 0 var(--color-border);
      }

      .account-block-end {
        box-shadow: inset -4px 0 0 var(--color-border);
      }

      thead tr:last-child th.account-block-end {
        box-shadow:
          inset -4px 0 0 var(--color-border),
          inset 0 -4px 0 var(--color-border);
      }

      .sticky-left {
        position: sticky;
        left: 0;
        z-index: 10;
      }

      .account-indent-col {
        width: 1.25rem;
        min-width: 1.25rem;
      }

      .account-name-col {
        min-width: 12rem;
      }

      .account-prefix-width {
        width: 1.25rem;
        min-width: 1.25rem;
        max-width: 1.25rem;
        padding-left: 0;
        padding-right: 0;
      }

      .title-cell {
        min-width: 12rem;
        white-space: nowrap;
      }

      .empty-row {
        height: 20px;
      }

      th, td {
        padding: 2px;
      }

      td {
        vertical-align: middle;
      }

      .budget-column, .revision-column {
        padding: 0px 20px 0px 20px;
      }

      .revision-column {
        vertical-align: top;
      }

      .last-revision-column, .revision-column, .budget-column {
        border-right: 1px solid var(--color-border);
      }

      .value-cell {
        text-align: right;
        padding: 5px 5px 5px 20px;
      }

      td {
        p {
          text-align: right;
          color: var(--color-text-secondary);
        }
      }
    }
  `,
  template: `
    @let header = matrixHeader();
    @let descriptionEnabled = header.isDescriptionButtonSelected();
    @let revisionDescriptionEnabled = header.isRevisionDescriptionButtonSelected();
    @let targetEnabled = header.isTargetButtonSelected();
    @let actualEnabled = header.isActualButtonSelected();
    @let differenceEnabled = header.isDifferenceButtonSelected();
    @let accColSpan = accountColSpan();
    @let selectedBudgets = filteredColumns();
    @let rows = filteredRows();
    @let isEditing = matrixHeader().isEditMode();

    <div class="fullwidth fullheight overflow-auto">
      <table class="table is-narrow">
        <colgroup>
          @for (colIndex of accountCols(); track colIndex) {
            <col [class.account-indent-col]="colIndex < accColSpan - 1" [class.account-name-col]="colIndex === accColSpan - 1" />
          }
          @if (descriptionEnabled) {
            <col />
          }
        </colgroup>
        <thead>
          <tr>
            <th [rowSpan]="2" [colSpan]="accColSpan" class="sticky-left account-block-end">Konto</th>

            @if (descriptionEnabled) {
              <th [rowSpan]="3">Beschreibung</th>
            }

            @for (col of selectedBudgets; track col.budgetId) {
              <th [colSpan]="col.tags.length * revisionColSpan() + (isEditing && !col.isClosed ? 1 : 0)" class="budget-column">
                {{ col.displayName }}
              </th>
            }
          </tr>
          <tr>
            @for (col of selectedBudgets; track col.budgetId) {
              @if (isEditing && !col.isClosed) {
                <th></th>
              }

              @for (tag of col.tags; track tag.tagId) {
                <th [colSpan]="revisionColSpan()" class="revision-column">
                  {{ tag.displayName }}
                  @if (revisionDescriptionEnabled && tag.displayDescription) {
                    <br />
                    <span class="font-normal">{{ tag.displayDescription }}</span>
                  }
                </th>
              }
            }
          </tr>
          <tr>
            @for (colIndex of accountCols(); track colIndex) {
              <th class="sticky-left" [class.account-prefix-width]="colIndex < accColSpan - 1" [class.account-block-end]="colIndex === accColSpan - 1" [style.left]="colIndex * 1.25 + 'rem'"></th>
            }

            @for (col of selectedBudgets; track col.budgetId) {
              @if (isEditing && !col.isClosed) {
                <th>Soll bearbeiten</th>
              }

              @for (tag of col.tags; track tag.tagId) {
                @if (targetEnabled) {
                  <th [class.last-revision-column]="!(actualEnabled || differenceEnabled)">Soll</th>
                }
                @if (actualEnabled) {
                  <th [class.last-revision-column]="!differenceEnabled">Ist</th>
                }
                @if (differenceEnabled) {
                  <th class="last-revision-column">Diff</th>
                }
              }
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.accountId) {
            <tr [class.font-bold]="row.isSumRow || parentAccountIds().has(row.accountId)">
              @for (colIndex of accountCols(); track colIndex) {
                @if (row.depth === colIndex) {
                  <td [colSpan]="accColSpan - colIndex" class="title-cell sticky-left account-block-end" [style.left]="colIndex * 1.25 + 'rem'">
                    {{ row.displayCode }} &mdash; {{ row.displayName }}
                    @if (row.isArchived) {
                      <span class="ml-1.5 px-1 py-0.5 text-[10px] bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded" i18n>Archiviert</span>
                    }
                  </td>
                } @else if (row.depth > colIndex) {
                  <td class="account-prefix-width sticky-left" [style.left]="colIndex * 1.25 + 'rem'"></td>
                }
              }

              @if (descriptionEnabled) {
                <td>{{ row.displayDescription }}</td>
              }

            @for (budgetValues of row.values; track budgetValues.budgetId) {
              @let budgetColumn = selectedBudgets.find(b => b.budgetId === budgetValues.budgetId);
              @if (isEditing && budgetColumn && !budgetColumn.isClosed) {
                <td class="value-cell">
                  @if (row.isSumRow || row.isParent) {
                    <app-matrix-value-span [value]="budgetValues.editableTargetValue()" />
                  } @else if (budgetValues.editableTargetWritableValue) {
                    <app-matrix-value-input
                      [(value)]="budgetValues.editableTargetWritableValue"
                      [hasChanged]="hasChanged(budgetValues.budgetId, row.accountId)"
                      [disabled]="isSaving()"
                      (resetClick)="onResetValue(budgetValues.budgetId, row.accountId)"
                    />
                  }
                </td>
              }

              @for (tagValues of budgetValues.tags; track tagValues.tagId) {
                @if (targetEnabled) {
                  <td [class.last-revision-column]="!(actualEnabled || differenceEnabled)" class="value-cell">
                    <app-matrix-value-span [value]="tagValues.targetValue()" />
                  </td>
                }
                @if (actualEnabled) {
                  <td [class.last-revision-column]="!differenceEnabled" class="value-cell">
                    <app-matrix-value-span [value]="budgetValues.actualValue" />
                  </td>
                }
                @if (differenceEnabled) {
                  <td class="last-revision-column value-cell">
                    <app-matrix-value-span [value]="tagValues.diffValue()" />
                  </td>
                }
              }
            }
            </tr>
            @if (row.isSumRow) {
              <tr class="empty-row">
                @for (colIndex of accountCols(); track colIndex) {
                  <td class="sticky-left" [class.account-prefix-width]="colIndex < accColSpan - 1" [class.account-block-end]="colIndex === accColSpan - 1" [style.left]="colIndex * 1.25 + 'rem'"></td>
                }
                @if (descriptionEnabled) {
                  <td></td>
                }
                @for (col of selectedBudgets; track col.budgetId) {
                  @if (isEditing && !col.isClosed) {
                    <td></td>
                  }

                  @for (tag of col.tags; track tag.tagId) {
                    @if (targetEnabled) {
                      <td [class.last-revision-column]="!(actualEnabled || differenceEnabled)"></td>
                    }
                    @if (actualEnabled) {
                      <td [class.last-revision-column]="!differenceEnabled"></td>
                    }
                    @if (differenceEnabled) {
                      <td class="last-revision-column"></td>
                    }
                  }
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>`,
})
export class MatrixContent {
  private readonly valueStore = inject(MatrixValueStoreService);
  private wasEditing = false;

  matrixHeader = input.required<MatrixHeader>();
  matrixData = input.required<MatrixData>();
  isSaving = input(false);

  parentAccountIds = computed(() => {
    return new Set(
      this.matrixData().accounts
        .filter(account => account.parentAccountId !== null)
        .map(account => account.parentAccountId as string)
    );
  });

  accountColSpan = computed(() => {
    const data = this.matrixData();
    if (data.rows.length === 0) return 1;
    return Math.max(...data.rows.map(x => x.depth)) + 1;
  });
  accountCols = computed(() => Array.from({ length: this.accountColSpan() }, (_, i) => i));

  filteredColumns = computed(() => {
    const selectedIds = this.matrixHeader().selectedBudgetIds();
    const selectedTagIds = this.matrixHeader().selectedTagIds();
    const budgets = this.matrixData().budgets;

    return this.matrixData().columns
      .filter(col => selectedIds.includes(col.budgetId))
      .map(col => {
        const budget = budgets.find(b => b.id === col.budgetId);
        const tags = col.tags.filter(t => selectedTagIds.includes(t.tagId));
        return {
          ...col,
          isClosed: budget?.isClosed ?? false,
          tags: [...tags].reverse()
        };
      });
  });

  filteredRows = computed(() => {
    const selectedAccountIds = this.matrixHeader().selectedAccountIds();
    const selectedBudgetIds = this.matrixHeader().selectedBudgetIds();
    const selectedTagIds = this.matrixHeader().selectedTagIds();

    return this.matrixData().rows
      .filter(row => {
        if (row.isSumRow && row.sourceAccountId) {
          return selectedAccountIds.includes(row.sourceAccountId);
        }

        return selectedAccountIds.includes(row.accountId);
      })
      .map(row => ({
        ...row,
        values: row.values
          .filter(v => selectedBudgetIds.includes(v.budgetId))
          .map(v => {
            const tags = v.tags.filter(t => selectedTagIds.includes(t.tagId));
            return { ...v, tags: [...tags].reverse() };
          })
      }));
  });

  revisionColSpan = computed(() => {
    const target = this.matrixHeader().isTargetButtonSelected();
    const actual = this.matrixHeader().isActualButtonSelected();
    const difference = this.matrixHeader().isDifferenceButtonSelected();

    return Math.max((target ? 1 : 0) + (actual ? 1 : 0) + (difference ? 1 : 0), 1);
  });

  hasChanged(budgetId: string, accountId: string): boolean {
    return this.valueStore.hasChanged(budgetId, accountId);
  }

  onResetValue(budgetId: string, accountId: string): void {
    this.valueStore.resetToOriginal(budgetId, accountId);
  }

  constructor() {
    effect(() => {
      console.log(this.matrixData());
    });

    effect(() => {
      const isEditing = this.matrixHeader().isEditMode();

      if (this.wasEditing && !isEditing) {
        this.valueStore.resetAllToOriginal();
      }

      this.wasEditing = isEditing;
    });
  }
}
