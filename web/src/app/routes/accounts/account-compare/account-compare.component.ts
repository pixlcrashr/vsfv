import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { merge, map, distinctUntilChanged, filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
} from '../../../shared/components';
import { formatDateShort, naturalCompare } from '../../../shared/utils';
import {
  AccountCompareDataService,
  BudgetOption,
  CompareAccountOption,
  CompareAccountTransaction,
} from './account-compare.data-service';

@Component({
  selector: 'app-account-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageContentLayoutComponent, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Vergleichsdaten werden geladen..." />
        } @else if (budgets().length === 0) {
          <div class="mx-auto w-full max-w-6xl">
            <app-empty-state
              i18n-title title="Keine Haushaltspläne vorhanden"
              i18n-description description="Es sind keine Haushaltspläne verfügbar, um Konten zu vergleichen."
            />
          </div>
        } @else {
          <div class="mx-auto w-full max-w-6xl space-y-3">
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="max-w-sm">
                <label
                  for="budget"
                  class="block text-xs font-medium text-gray-700 mb-1"
                >
                  <ng-container i18n>Haushaltsjahr</ng-container>
                </label>
                <select
                  id="budget"
                  [(ngModel)]="selectedBudgetId"
                  (ngModelChange)="onBudgetChange()"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  @for (budget of budgets(); track budget.id) {
                    <option [value]="budget.id">{{ budget.name }}</option>
                  }
                </select>
              </div>

              @if (leftAccountId && rightAccountId && leftAccountId === rightAccountId) {
                <p i18n class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Bitte wählen Sie zwei unterschiedliche Konten für den Vergleich aus.
                </p>
              }
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-gray-900">
                    {{ leftAccountId ? accountLabel(leftAccountId) : 'Linkes Konto' }}
                  </h2>
                  @if (leftAccountId) {
                    <p i18n class="text-xs text-gray-500">
                      Summe: {{ formatAmount(leftTotal()) }} ({{ leftTransactions().length }} Buchungen)
                    </p>
                  }
                </div>

                <div class="mb-3">
                  <select
                    id="leftAccount"
                    [(ngModel)]="leftAccountId"
                    (ngModelChange)="onLeftAccountChange()"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option i18n value="">Bitte auswählen...</option>
                    @for (account of accounts(); track account.id) {
                      <option [value]="account.id" [disabled]="isParentAccount(account.id)">{{ accountOptionLabel(account) }}</option>
                    }
                  </select>
                </div>

                @if (leftLoading()) {
                  <app-loading-spinner [fullPage]="false" i18n-text text="Buchungen werden geladen..." />
                } @else if (!leftAccountId) {
                  <p i18n class="text-xs text-gray-500 py-6 text-center">Bitte ein linkes Konto auswählen.</p>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500">
                            <ng-container i18n>Belegdatum</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500">
                            <ng-container i18n>Betrag</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500">
                            <ng-container i18n>Soll</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500">
                            <ng-container i18n>Haben</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500">
                            <ng-container i18n>Buchungstext</ng-container>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 bg-white">
                        @if (leftTransactions().length === 0) {
                          <tr>
                            <td i18n colspan="5" class="px-3 py-4 text-center text-xs text-gray-500">
                              Keine Buchungen im ausgewählten Jahr.
                            </td>
                          </tr>
                        }
                        @for (transaction of leftTransactions(); track transaction.id) {
                          <tr class="hover:bg-gray-50 transition-colors">
                            <td class="px-3 py-2 text-xs text-gray-900">{{ formatDate(transaction.documentDate) }}</td>
                            <td class="px-3 py-2 text-xs text-right text-gray-900">{{ formatAmount(transaction.amount) }}</td>
                            <td class="px-3 py-2 text-xs text-right text-gray-900">{{ transaction.debitAccountCode }}</td>
                            <td class="px-3 py-2 text-xs text-right text-gray-900">{{ transaction.creditAccountCode }}</td>
                            <td class="px-3 py-2 text-xs text-gray-900">{{ transaction.description }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>

              <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-gray-900">
                    {{ rightAccountId ? accountLabel(rightAccountId) : 'Rechtes Konto' }}
                  </h2>
                  @if (rightAccountId) {
                    <p i18n class="text-xs text-gray-500">
                      Summe: {{ formatAmount(rightTotal()) }} ({{ rightTransactions().length }} Buchungen)
                    </p>
                  }
                </div>

                <div class="mb-3">
                  <select
                    id="rightAccount"
                    [(ngModel)]="rightAccountId"
                    (ngModelChange)="onRightAccountChange()"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option i18n value="">Bitte auswählen...</option>
                    @for (account of accounts(); track account.id) {
                      <option [value]="account.id" [disabled]="isParentAccount(account.id)">{{ accountOptionLabel(account) }}</option>
                    }
                  </select>
                </div>

                @if (rightLoading()) {
                  <app-loading-spinner [fullPage]="false" i18n-text text="Buchungen werden geladen..." />
                } @else if (!rightAccountId) {
                  <p i18n class="text-xs text-gray-500 py-6 text-center">Bitte ein rechtes Konto auswählen.</p>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500">
                            <ng-container i18n>Belegdatum</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500">
                            <ng-container i18n>Betrag</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500">
                            <ng-container i18n>Soll</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500">
                            <ng-container i18n>Haben</ng-container>
                          </th>
                          <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500">
                            <ng-container i18n>Buchungstext</ng-container>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 bg-white">
                        @if (rightTransactions().length === 0) {
                          <tr>
                            <td i18n colspan="5" class="px-3 py-4 text-center text-xs text-gray-500">
                              Keine Buchungen im ausgewählten Jahr.
                            </td>
                          </tr>
                        }
                        @for (transaction of rightTransactions(); track transaction.id) {
                          <tr class="hover:bg-gray-50 transition-colors">
                            <td class="px-3 py-2 text-xs text-gray-900">{{ formatDate(transaction.documentDate) }}</td>
                            <td class="px-3 py-2 text-xs text-right text-gray-900">{{ formatAmount(transaction.amount) }}</td>
                            <td class="px-3 py-2 text-xs text-right text-gray-900">{{ transaction.debitAccountCode }}</td>
                            <td class="px-3 py-2 text-xs text-right text-gray-900">{{ transaction.creditAccountCode }}</td>
                            <td class="px-3 py-2 text-xs text-gray-900">{{ transaction.description }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class AccountCompareComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(AccountCompareDataService);
  private readonly notifications = inject(NotificationService);

  orgId = '';

  readonly loading = signal(true);
  readonly leftLoading = signal(false);
  readonly rightLoading = signal(false);
  readonly budgets = signal<BudgetOption[]>([]);
  readonly accounts = signal<CompareAccountOption[]>([]);
  readonly leftTransactions = signal<CompareAccountTransaction[]>([]);
  readonly rightTransactions = signal<CompareAccountTransaction[]>([]);

  selectedBudgetId = '';
  leftAccountId = '';
  rightAccountId = '';

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Haushaltskonten`, path: '' },
    { label: $localize`Kontenvergleich` },
  ];

  readonly leftTotal = computed(() =>
    this.leftTransactions()
      .reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0)
      .toFixed(2),
  );

  readonly rightTotal = computed(() =>
    this.rightTransactions()
      .reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0)
      .toFixed(2),
  );

  constructor() {
    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.orgId = id;
      this.breadcrumbs[0].path = `/organizations/${id}/accounts`;
      this.loading.set(true);
      this.budgets.set([]);
      this.accounts.set([]);
      this.leftTransactions.set([]);
      this.rightTransactions.set([]);
      this.selectedBudgetId = '';
      this.leftAccountId = '';
      this.rightAccountId = '';
      this.loadBudgets();
    });
  }

  private loadBudgets(): void {
    this.dataService.listBudgets(this.orgId).subscribe({
      next: (budgets) => {
        this.budgets.set(budgets);
        if (budgets.length > 0) {
          this.selectedBudgetId = budgets[0].id;
          this.loadAccounts();
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Haushaltspläne`);
      },
    });
  }

  private loadAccounts(): void {
    if (!this.selectedBudgetId) {
      this.accounts.set([]);
      this.loading.set(false);
      return;
    }

    this.dataService.listAccounts(this.orgId, this.selectedBudgetId).subscribe({
      next: (accounts) => {
        this.accounts.set(this.arrangeAccountsHierarchically(accounts));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Konten`);
      },
    });
  }

  onBudgetChange(): void {
    this.leftAccountId = '';
    this.rightAccountId = '';
    this.leftTransactions.set([]);
    this.rightTransactions.set([]);
    this.loading.set(true);
    this.loadAccounts();
  }

  onLeftAccountChange(): void {
    this.loadTransactions('left');
  }

  onRightAccountChange(): void {
    this.loadTransactions('right');
  }

  private loadTransactions(side: 'left' | 'right'): void {
    const accountId = side === 'left' ? this.leftAccountId : this.rightAccountId;

    if (!accountId || !this.selectedBudgetId) {
      if (side === 'left') {
        this.leftTransactions.set([]);
      } else {
        this.rightTransactions.set([]);
      }
      return;
    }

    if (side === 'left') {
      this.leftLoading.set(true);
    } else {
      this.rightLoading.set(true);
    }

    this.dataService.listTransactions(this.orgId, this.selectedBudgetId, accountId).subscribe({
      next: (transactions) => {
        if (side === 'left') {
          this.leftTransactions.set(transactions);
          this.leftLoading.set(false);
        } else {
          this.rightTransactions.set(transactions);
          this.rightLoading.set(false);
        }
      },
      error: () => {
        if (side === 'left') {
          this.leftLoading.set(false);
        } else {
          this.rightLoading.set(false);
        }
        this.notifications.error($localize`Fehler beim Laden der Buchungen`);
      },
    });
  }

  accountLabel(accountId: string): string {
    const account = this.accounts().find((candidate) => candidate.id === accountId);
    if (!account) {
      return '';
    }

    return `${account.code} ${account.name}`;
  }

  accountOptionLabel(account: CompareAccountOption): string {
    return `${'\u00A0'.repeat((account.depth ?? 0) * 4)}${(account.depth ?? 0) > 0 ? '└─ ' : ''}${account.code} ${account.name}`;
  }

  isParentAccount(accountId: string): boolean {
    return this.accounts().some((account) => account.parentAccountId === accountId);
  }

  private arrangeAccountsHierarchically(accounts: CompareAccountOption[]): CompareAccountOption[] {
    const childrenByParentId = new Map<string | null, CompareAccountOption[]>();

    accounts.forEach((account) => {
      const parentId = account.parentAccountId ?? null;
      const siblings = childrenByParentId.get(parentId) ?? [];
      siblings.push(account);
      childrenByParentId.set(parentId, siblings);
    });

    childrenByParentId.forEach((siblings) => {
      siblings.sort((left, right) => naturalCompare(left.code, right.code));
    });

    const arranged: CompareAccountOption[] = [];
    const visited = new Set<string>();

    const appendAccount = (account: CompareAccountOption, depth: number): void => {
      if (visited.has(account.id)) {
        return;
      }

      visited.add(account.id);
      arranged.push({ ...account, depth });

      for (const child of childrenByParentId.get(account.id) ?? []) {
        appendAccount(child, depth + 1);
      }
    };

    for (const account of childrenByParentId.get(null) ?? []) {
      appendAccount(account, 0);
    }

    accounts
      .filter((account) => !visited.has(account.id))
      .sort((left, right) => naturalCompare(left.code, right.code))
      .forEach((account) => appendAccount(account, account.depth ?? 0));

    return arranged;
  }

  formatDate(date: Date): string {
    return formatDateShort(date);
  }

  formatAmount(value: string): string {
    const num = parseFloat(value);
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(num);
  }
}
