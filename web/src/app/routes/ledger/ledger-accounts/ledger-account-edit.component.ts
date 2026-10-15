import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import {
  LedgerAccountEditDataService,
  LedgerAccountDetail,
  UpdateLedgerAccountRequest,
} from './ledger-account-edit.data-service';
import { V1LedgerAccountType } from '../../../../lib/api/models/v1ledger-account-type';

@Component({
  selector: 'app-ledger-account-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageContentLayoutComponent, ButtonComponent, LoadingSpinnerComponent],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs()">
      <div layout-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Konto wird geladen..." />
        } @else if (account()) {
          @let acc = account()!;
          <div class="max-w-4xl mx-auto">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Editable fields -->
              <div class="lg:col-span-2 space-y-4">
                <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div class="space-y-4">
                    <!-- Editable fields -->
                    <div>
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <ng-container i18n>Bilanzrolle</ng-container>
                      </label>
                      <select
                        [(ngModel)]="ledgerAccountType"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Keine (Ertrags-/Aufwandskonto)</option>
                        <option value="LEDGER_ACCOUNT_TYPE_LIQUIDITY">Zahlungsverkehr (Bank/Kasse)</option>
                        <option value="LEDGER_ACCOUNT_TYPE_COUNTER">Kontokorrent (Debitor/Kreditor)</option>
                        <option value="LEDGER_ACCOUNT_TYPE_START_ACCOUNT">Eröffnungskonto</option>
                      </select>
                    </div>

                    <div>
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <ng-container i18n>Anzeigename</ng-container>
                      </label>
                      <input
                        type="text"
                        [(ngModel)]="displayName"
                        placeholder="Optionaler Anzeigename"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <ng-container i18n>Beschreibung</ng-container>
                      </label>
                      <textarea
                        [(ngModel)]="displayDescription"
                        rows="3"
                        placeholder="Optionale Beschreibung"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      ></textarea>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex justify-end gap-2 mt-6">
                    <app-button variant="secondary" (clicked)="goBack()">
                      <ng-container i18n>Abbrechen</ng-container>
                    </app-button>
                    <app-button
                      [disabled]="saving()"
                      [loading]="saving()"
                      (clicked)="save()"
                    >
                      <ng-container i18n>Speichern</ng-container>
                    </app-button>
                  </div>
                </div>
              </div>

              <!-- Right Column: Info -->
              <div class="space-y-4">
                <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Informationen</h3>
                  <dl class="space-y-3">
                    <div>
                      <dt i18n class="text-xs text-gray-500">Kontonummer</dt>
                      <dd class="text-sm text-gray-900 font-mono">{{ acc.code }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class LedgerAccountEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(LedgerAccountEditDataService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly account = signal<LedgerAccountDetail | null>(null);

  displayName = '';
  displayDescription = '';
  ledgerAccountType: V1LedgerAccountType | '' = '';

  readonly orgId = signal<string>('');
  readonly accountId = signal<string>('');

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: $localize`Ledger Konten`, path: `/organizations/${this.orgId()}/ledgerAccounts` },
    { label: this.account()?.displayName || this.account()?.code || $localize`Bearbeiten`, path: '' },
  ]);

  ngOnInit(): void {
    const orgId = this.route.snapshot.paramMap.get('orgId');
    const id = this.route.snapshot.paramMap.get('id');

    if (orgId && id) {
      this.orgId.set(orgId);
      this.accountId.set(id);
      this.loadAccount(orgId, id);
    }
  }

  private loadAccount(orgId: string, id: string): void {
    this.loading.set(true);
    this.dataService.getLedgerAccount(orgId, id).subscribe({
      next: (account) => {
        this.account.set(account);
        this.displayName = account.displayName || '';
        this.displayDescription = account.displayDescription || '';
        this.ledgerAccountType = account.type ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden des Ledger-Kontos`);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    const orgId = this.orgId();
    const account = this.account();
    if (!orgId || !account) return;

    this.saving.set(true);

    const request: UpdateLedgerAccountRequest = {
      id: account.id,
      displayName: this.displayName || undefined,
      displayDescription: this.displayDescription || undefined,
      type: this.ledgerAccountType === '' ? 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED' : this.ledgerAccountType,
      etag: account.etag,
    };

    this.dataService.updateLedgerAccount(orgId, request).subscribe({
      next: () => {
        this.notifications.success($localize`Ledger-Konto erfolgreich aktualisiert`);
        this.saving.set(false);
        this.goBack();
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern des Ledger-Kontos`);
        this.saving.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/organizations', this.orgId(), 'ledgerAccounts']);
  }
}
