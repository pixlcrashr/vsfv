import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
} from '../../../shared/components';
import {
  LedgerAccountListDataService,
  LedgerAccountListItem,
} from './ledger-account-list.data-service';

@Component({
  selector: 'app-ledger-account-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContentLayoutComponent, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Ledger-Konten werden geladen..." />
        } @else if (accounts().length === 0) {
          <app-empty-state
            i18n-title title="Keine Ledger-Konten vorhanden"
            i18n-description description="Es wurden noch keine Ledger-Konten erstellt."
          />
        } @else {
          <div class="w-full max-w-5xl">
            <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400"
                      >
                        <ng-container i18n>Kontonummer</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400"
                      >
                        <ng-container i18n>Name</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400"
                      >
                        <ng-container i18n>Bilanzrolle</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400"
                      >
                        <ng-container i18n>Beschreibung</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-right">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    @for (account of accounts(); track account.id) {
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-mono">{{ account.code }}</td>
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{{ account.displayName || '-' }}</td>
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          @if (account.type === 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED') {
                            <i i18n>&lt;keine&gt;</i>
                          } @else {
                            {{ formatLedgerAccountType(account.type) }}
                          }
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{{ account.displayDescription || '-' }}</td>
                        <td class="px-3 py-2 text-right text-xs">
                          <a
                            [routerLink]="['/organizations', orgId(), 'ledgerAccounts', account.id, 'edit']"
                            class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <ng-container i18n>Bearbeiten</ng-container>
                          </a>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class LedgerAccountListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(LedgerAccountListDataService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly accounts = signal<LedgerAccountListItem[]>([]);

  readonly orgId = signal<string>('');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Ledger Konten` }
  ];

  ngOnInit(): void {
    const orgId = this.route.snapshot.paramMap.get('orgId');
    if (orgId) {
      this.orgId.set(orgId);
      this.loadAccounts();
    }
  }

  private loadAccounts(): void {
    const orgId = this.orgId();
    if (!orgId) return;

    this.loading.set(true);

    this.dataService.listLedgerAccounts(orgId).subscribe({
      next: (result) => {
        this.accounts.set(result.accounts);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Ledger-Konten`);
        this.loading.set(false);
      },
    });
  }

  formatLedgerAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      LEDGER_ACCOUNT_TYPE_LIQUIDITY: 'Zahlungsverkehr',
      LEDGER_ACCOUNT_TYPE_COUNTER: 'Kontokorrent',
      LEDGER_ACCOUNT_TYPE_START_ACCOUNT: 'Eröffnungskonto',
    };
    return typeMap[type] || type;
  }
}
