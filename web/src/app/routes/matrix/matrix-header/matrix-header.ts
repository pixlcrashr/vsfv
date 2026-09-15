import { Component, computed, input, output, signal, model } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFileArrowDown, faPen, faSave, faAngleDown, faAngleUp } from '@fortawesome/free-solid-svg-icons';
import { Account, Budget } from '../matrix-data-provider.service';



export interface ExportButtonClickArgs {
  selectedBudgetIds: string[];
  selectedTagIds: string[];
  selectedAccountIds: string[];
  targetValuesEnabled: boolean;
  actualValuesEnabled: boolean;
  differenceValuesEnabled: boolean;
  accountDescriptionsEnabled: boolean;
  revisionDescriptionsEnabled: boolean;
}

@Component({
  selector: 'app-matrix-header',
  imports: [
    OverlayModule,
    FontAwesomeModule
  ],
  template: `
    <header class="w-full h-10 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 flex items-center justify-between">
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <!-- Toggle buttons: Soll / Ist / Diff -->
        <div class="flex items-center">
          <button
            type="button"
            class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-l cursor-pointer transition-colors relative
                   bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                   enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700
                   disabled:opacity-50 disabled:cursor-not-allowed"
            [class.!bg-blue-600]="isTargetButtonSelected()"
            [class.!text-white]="isTargetButtonSelected()"
            [class.!border-blue-600]="isTargetButtonSelected()"
            [class.z-10]="isTargetButtonSelected()"
            [disabled]="isLoading()"
            (click)="isTargetButtonSelected.set(!isTargetButtonSelected())"
            i18n
          >Soll</button>
          <button
            type="button"
            class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 -ml-px cursor-pointer transition-colors relative
                   bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                   enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700
                   disabled:opacity-50 disabled:cursor-not-allowed"
            [class.!bg-blue-600]="isActualButtonSelected()"
            [class.!text-white]="isActualButtonSelected()"
            [class.!border-blue-600]="isActualButtonSelected()"
            [class.z-10]="isActualButtonSelected()"
            [disabled]="isLoading()"
            (click)="isActualButtonSelected.set(!isActualButtonSelected())"
            i18n
          >Ist</button>
          <button
            type="button"
            class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 -ml-px rounded-r cursor-pointer transition-colors relative
                   bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                   enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700
                   disabled:opacity-50 disabled:cursor-not-allowed"
            [class.!bg-blue-600]="isDifferenceButtonSelected()"
            [class.!text-white]="isDifferenceButtonSelected()"
            [class.!border-blue-600]="isDifferenceButtonSelected()"
            [class.z-10]="isDifferenceButtonSelected()"
            [disabled]="isLoading()"
            (click)="isDifferenceButtonSelected.set(!isDifferenceButtonSelected())"
            i18n
          >Diff.</button>
        </div>

        <!-- Budgets Dropdown -->
        @if (budgets().length > 0) {
          <div class="relative">
            <button
              type="button"
              class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                    enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700 cursor-pointer
                    flex items-center gap-1 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
              [class.!bg-blue-600]="showBudgetsDropdown()"
              [class.!text-white]="showBudgetsDropdown()"
              [class.!border-blue-600]="showBudgetsDropdown()"
              [disabled]="isLoading()"
              cdkOverlayOrigin
              #budgetsTrigger="cdkOverlayOrigin"
              (click)="toggleBudgetsDropdown()"
            >
              <span>
                <ng-container i18n>Budgets</ng-container>
                @if (selectedBudgetIds().length > 0) {
                  ({{ selectedBudgetIds().length }})
                }
              </span>
              <fa-icon [icon]="showBudgetsDropdown() ? faAngleUp : faAngleDown" class="text-[10px]"></fa-icon>
            </button>
            <ng-template
              cdkConnectedOverlay
              [cdkConnectedOverlayOrigin]="budgetsTrigger"
              [cdkConnectedOverlayOpen]="showBudgetsDropdown()"
              [cdkConnectedOverlayOffsetY]="4"
              [cdkConnectedOverlayHasBackdrop]="true"
              [cdkConnectedOverlayBackdropClass]="'cdk-overlay-transparent-backdrop'"
              (backdropClick)="showBudgetsDropdown.set(false)"
            >
              <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-72 overflow-y-auto min-w-[260px]">
              <div class="px-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 h-6">
                <button type="button" class="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer" (click)="selectAllBudgets()" i18n>Alle auswählen</button>
                <div class="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                <button type="button" class="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer" (click)="unselectAllBudgets()" i18n>Alle abwählen</button>
              </div>
              <table class="w-full text-xs">
                  <tbody>
                    @for (budget of budgets(); track budget.id) {
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" (click)="toggleBudgetTags(budget)">
                        <td class="px-2.5 py-1.5 text-gray-900 dark:text-gray-100 font-medium">{{ budget.displayName }}</td>
                        <td class="px-2.5 py-1.5 w-8 text-center">
                          <input
                            #budgetCheckbox
                            type="checkbox"
                            class="cursor-pointer"
                            [checked]="isBudgetFullySelected(budget)"
                            [indeterminate]="isBudgetPartiallySelected(budget)"
                            (click)="$event.stopPropagation(); toggleBudgetTags(budget)"
                          />
                        </td>
                      </tr>
                      @for (tag of budgetTagsNewestFirst(budget); track tag.id) {
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" (click)="toggleTag(tag.id, budget.id)">
                          <td class="py-1 pr-2.5 text-gray-600 dark:text-gray-400" style="padding-left: 20px">└─ {{ tag.displayName }}</td>
                          <td class="px-2.5 py-1 w-8 text-center">
                            <input
                              type="checkbox"
                              class="cursor-pointer"
                              [checked]="selectedTagIds().includes(tag.id)"
                              (click)="$event.stopPropagation(); toggleTag(tag.id, budget.id)"
                            />
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </ng-template>
          </div>
        }

        <!-- Accounts Dropdown -->
        @if (accounts().length > 0) {
          <div class="relative">
            <button
              type="button"
              class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                    enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700 cursor-pointer
                    flex items-center gap-1 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
              [class.!bg-blue-600]="showAccountsDropdown()"
              [class.!text-white]="showAccountsDropdown()"
              [class.!border-blue-600]="showAccountsDropdown()"
              [disabled]="isLoading()"
              cdkOverlayOrigin
              #accountsTrigger="cdkOverlayOrigin"
              (click)="toggleAccountsDropdown()"
            >
              <span>
                <ng-container i18n>Konten</ng-container>
                @if (selectedAccountIds().length > 0) {
                  ({{ selectedAccountIds().length }})
                }
              </span>
              <fa-icon [icon]="showAccountsDropdown() ? faAngleUp : faAngleDown" class="text-[10px]"></fa-icon>
            </button>
            <ng-template
              cdkConnectedOverlay
              [cdkConnectedOverlayOrigin]="accountsTrigger"
              [cdkConnectedOverlayOpen]="showAccountsDropdown()"
              [cdkConnectedOverlayOffsetY]="4"
              [cdkConnectedOverlayHasBackdrop]="true"
              [cdkConnectedOverlayBackdropClass]="'cdk-overlay-transparent-backdrop'"
              (backdropClick)="showAccountsDropdown.set(false)"
            >
              <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-72 overflow-y-auto min-w-[400px]">
              <div class="px-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 h-6">
                <button type="button" class="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer" (click)="selectAllAccounts()" i18n>Alle auswählen</button>
                <div class="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                <button type="button" class="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer" (click)="unselectAllAccounts()" i18n>Alle abwählen</button>
              </div>
              <table class="w-full text-xs">
                  <tbody>
                    @for (account of accounts(); track account.id) {
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700" [class.opacity-60]="account.isArchived">
                        <td class="px-2.5 py-1.5 text-gray-900 dark:text-gray-100">
                          <span [style.padding-left.px]="account.depth * 16">
                            {{ account.depth > 0 ? '└─ ' : '' }}{{ account.displayCode }} | {{ account.name }}
                          </span>
                          @if (account.isArchived) {
                            <span class="ml-1.5 px-1 py-0.5 text-[10px] bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded" i18n>Archiviert</span>
                          }
                        </td>
                        <td class="px-2.5 py-1.5 w-8 text-center">
                          <input
                            type="checkbox"
                            class="cursor-pointer"
                            [checked]="selectedAccountIds().includes(account.id)"
                            (change)="toggleAccount(account.id)"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </ng-template>
          </div>
        }

        <!-- Options Dropdown -->
        <div class="relative">
          <button
            type="button"
            class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                  enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-700 cursor-pointer
                  flex items-center gap-1 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
            [class.!bg-blue-600]="showOptionsDropdown()"
            [class.!text-white]="showOptionsDropdown()"
            [class.!border-blue-600]="showOptionsDropdown()"
            [disabled]="isLoading()"
            cdkOverlayOrigin
            #optionsTrigger="cdkOverlayOrigin"
            (click)="toggleOptionsDropdown()"
          >
            <span>
              <ng-container i18n>Weitere Optionen</ng-container>
            </span>
            <fa-icon [icon]="showOptionsDropdown() ? faAngleUp : faAngleDown" class="text-[10px]"></fa-icon>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="optionsTrigger"
            [cdkConnectedOverlayOpen]="showOptionsDropdown()"
            [cdkConnectedOverlayOffsetY]="4"
            [cdkConnectedOverlayHasBackdrop]="true"
            [cdkConnectedOverlayBackdropClass]="'cdk-overlay-transparent-backdrop'"
            (backdropClick)="showOptionsDropdown.set(false)"
          >
            <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-72 overflow-y-auto min-w-[200px]">
              <table class="w-full text-xs">
                <tbody>
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" (click)="isDescriptionButtonSelected.set(!isDescriptionButtonSelected())">
                    <td class="px-2.5 py-1.5 text-gray-900 dark:text-gray-100" i18n>Kontobeschreibung</td>
                    <td class="px-2.5 py-1.5 w-8 text-center">
                      <input
                        type="checkbox"
                        class="cursor-pointer"
                        [checked]="isDescriptionButtonSelected()"
                        (click)="$event.stopPropagation()"
                        (change)="isDescriptionButtonSelected.set(!isDescriptionButtonSelected())"
                      />
                    </td>
                  </tr>
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" (click)="isRevisionDescriptionButtonSelected.set(!isRevisionDescriptionButtonSelected())">
                    <td class="px-2.5 py-1.5 text-gray-900 dark:text-gray-100" i18n>Revisionsbeschreibung</td>
                    <td class="px-2.5 py-1.5 w-8 text-center">
                      <input
                        type="checkbox"
                        class="cursor-pointer"
                        [checked]="isRevisionDescriptionButtonSelected()"
                        (click)="$event.stopPropagation()"
                        (change)="isRevisionDescriptionButtonSelected.set(!isRevisionDescriptionButtonSelected())"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-template>
        </div>

        <!-- Loading indicator -->
        @if (isLoading()) {
          <div class="flex items-center">
            <span class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          </div>
        }
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-orange-500 dark:border-orange-400
                  bg-white dark:bg-gray-800 text-orange-500 dark:text-orange-400
                  enabled:hover:bg-orange-500 dark:enabled:hover:bg-orange-500 enabled:hover:text-white dark:enabled:hover:text-white
                  transition-colors cursor-pointer flex items-center gap-1
                  disabled:opacity-50 disabled:cursor-not-allowed"
          [class.!bg-orange-500]="isEditMode()"
          [class.dark:!bg-orange-500]="isEditMode()"
          [class.!text-white]="isEditMode()"
          (click)="isEditMode.set(!isEditMode())"
          [disabled]="isSaving()"
          [title]="isEditMode() ? 'Bearbeiten beenden' : 'Bearbeiten'"
        >
          <fa-icon [icon]="faPen"></fa-icon>
          <span>
            @if (isEditMode()) {
              <ng-container i18n>Bearbeiten beenden</ng-container>
            } @else {
              <ng-container i18n>Bearbeiten</ng-container>
            }
          </span>
        </button>

        <!-- Save Button (Only in Edit Mode) -->
        @if (isEditMode() && canSave()) {
          <button
            type="button"
            class="px-2 py-1 text-xs rounded border border-green-600 dark:border-green-500
                  bg-white dark:bg-gray-800 text-green-600 dark:text-green-500
                  enabled:hover:bg-green-600 dark:enabled:hover:bg-green-600 enabled:hover:text-white dark:enabled:hover:text-white
                  cursor-pointer flex items-center gap-1 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
            (click)="saveClick.emit()"
            [disabled]="isLoading() || isSaving() || !hasPendingChanges()"
            title="Speichern"
            i18n-title
          >
            @if (isSaving()) {
              <span class="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></span>
            } @else {
              <fa-icon [icon]="faSave"></fa-icon>
            }
            <span i18n>Speichern</span>
          </button>
        }

        <!-- Export Button -->
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-blue-500 dark:border-blue-400
                 bg-white dark:bg-gray-800 text-blue-500 dark:text-blue-400
                 enabled:hover:bg-blue-500 dark:enabled:hover:bg-blue-500 enabled:hover:text-white dark:enabled:hover:text-white
                 cursor-pointer flex items-center gap-1 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
          (click)="onExportClick()"
          [disabled]="isLoading() || isSaving()"
          i18n
        >
          <fa-icon [icon]="faFileArrowDown"></fa-icon>
          Exportieren
        </button>
      </div>
    </header>
  `,
})
export class MatrixHeader {
  faFileArrowDown = faFileArrowDown;
  faPen = faPen;
  faSave = faSave;
  faAngleDown = faAngleDown;
  faAngleUp = faAngleUp;

  isEditMode = model<boolean>(false);
  isTargetButtonSelected = model<boolean>(true);
  isActualButtonSelected = model<boolean>(false);
  isDifferenceButtonSelected = model<boolean>(false);
  isDescriptionButtonSelected = model<boolean>(false);
  isRevisionDescriptionButtonSelected = model<boolean>(false);
  isLoading = input<boolean>(false);
  isSaving = input<boolean>(false);
  hasPendingChanges = input<boolean>(false);
  canSave = input<boolean>(true);

  selectedBudgetIds = model<string[]>([]);
  selectedTagIds = model<string[]>([]);
  selectedAccountIds = model<string[]>([]);

  exportButtonClick = output<ExportButtonClickArgs>();
  saveClick = output<void>();

  budgets = input<Budget[]>([]);
  accounts = input<Account[]>([]);

  showBudgetsDropdown = signal(false);
  showAccountsDropdown = signal(false);
  showOptionsDropdown = signal(false);

  selectedBudgets = computed(() => {
    return this.budgets().filter((budget: Budget) => this.selectedBudgetIds().includes(budget.id));
  });
  selectedAccounts = computed(() => {
    return this.accounts().filter((account: Account) => this.selectedAccountIds().includes(account.id));
  });

  toggleBudgetsDropdown(): void {
    this.showBudgetsDropdown.update((v: boolean) => !v);
    this.showAccountsDropdown.set(false);
    this.showOptionsDropdown.set(false);
  }

  toggleAccountsDropdown(): void {
    this.showAccountsDropdown.update((v: boolean) => !v);
    this.showBudgetsDropdown.set(false);
    this.showOptionsDropdown.set(false);
  }

  toggleOptionsDropdown(): void {
    this.showOptionsDropdown.update((v: boolean) => !v);
    this.showBudgetsDropdown.set(false);
    this.showAccountsDropdown.set(false);
  }

  budgetTagsNewestFirst(budget: Budget): Budget['tags'] {
    return [...budget.tags].reverse();
  }

  isBudgetFullySelected(budget: Budget): boolean {
    return budget.tags.length > 0 && budget.tags.every(t => this.selectedTagIds().includes(t.id));
  }

  isBudgetPartiallySelected(budget: Budget): boolean {
    return !this.isBudgetFullySelected(budget) && budget.tags.some(t => this.selectedTagIds().includes(t.id));
  }

  toggleBudgetTags(budget: Budget): void {
    const allSelected = this.isBudgetFullySelected(budget);
    const tagIds = budget.tags.map(t => t.id);
    this.selectedTagIds.update(ids => {
      const without = ids.filter(id => !tagIds.includes(id));
      return allSelected ? without : [...without, ...tagIds];
    });
    this.selectedBudgetIds.update(ids => {
      const without = ids.filter(id => id !== budget.id);
      const nowHasAny = !allSelected;
      return nowHasAny ? [...without, budget.id] : without;
    });
  }

  toggleTag(tagId: string, budgetId: string): void {
    this.selectedTagIds.update(ids =>
      ids.includes(tagId) ? ids.filter(id => id !== tagId) : [...ids, tagId]
    );
    const budget = this.budgets().find(b => b.id === budgetId);
    if (budget) {
      const anyTagSelected = budget.tags.some(t => this.selectedTagIds().includes(t.id));
      this.selectedBudgetIds.update(ids => {
        const without = ids.filter(id => id !== budgetId);
        return anyTagSelected ? [...without, budgetId] : without;
      });
    }
  }

  toggleAccount(accountId: string): void {
    this.selectedAccountIds.update(ids => {
      const newIds = ids.includes(accountId)
        ? ids.filter(id => id !== accountId)
        : [...ids, accountId];
      return newIds;
    });
  }

  selectAllBudgets(): void {
    this.selectedBudgetIds.set(this.budgets().map(b => b.id));
    this.selectedTagIds.set(this.budgets().flatMap(b => b.tags.map(t => t.id)));
  }

  unselectAllBudgets(): void {
    this.selectedBudgetIds.set([]);
    this.selectedTagIds.set([]);
  }

  selectAllAccounts(): void {
    const allIds = this.accounts().map((a: Account) => a.id);
    this.selectedAccountIds.set(allIds);
  }

  unselectAllAccounts(): void {
    this.selectedAccountIds.set([]);
  }

  onExportClick(): void {
    this.exportButtonClick.emit({
      selectedBudgetIds: this.selectedBudgetIds(),
      selectedTagIds: this.selectedTagIds(),
      selectedAccountIds: this.selectedAccountIds(),
      targetValuesEnabled: this.isTargetButtonSelected(),
      actualValuesEnabled: this.isActualButtonSelected(),
      differenceValuesEnabled: this.isDifferenceButtonSelected(),
      accountDescriptionsEnabled: this.isDescriptionButtonSelected(),
      revisionDescriptionsEnabled: this.isRevisionDescriptionButtonSelected(),
    });
  }
}
