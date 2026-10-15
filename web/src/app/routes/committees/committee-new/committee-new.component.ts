import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  NotificationService,
} from '../../../shared/components';
import { CommitteePaymentAccountKind } from '../../../shared/models';
import { PaymentAccountInput, SaveCommitteeInput } from '../committee-form.model';
import { CommitteeNewDataService } from './committee-new.data-service';

@Component({
  selector: 'app-committee-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-header-actions class="flex gap-2">
          <app-button variant="secondary" (clicked)="cancel()">
            <ng-container i18n>Abbrechen</ng-container>
          </app-button>
          <app-button
            variant="primary"
            [disabled]="saving() || !isValid()"
            (clicked)="save()"
          >
            <ng-container i18n>{{ saving() ? 'Wird erstellt...' : 'Gremium erstellen' }}</ng-container>
          </app-button>
      </div>

      <div layout-content class="flex flex-1 justify-center">
        <div class="w-full max-w-4xl space-y-3">
          <!-- Basic Info -->
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <h2 i18n class="text-sm font-semibold text-gray-900 mb-4">
              Grundinformationen
            </h2>
            <div class="space-y-3">
              <div>
                <label
                  for="name"
                  class="block text-xs font-medium text-gray-500 mb-1"
                >
                  <ng-container i18n>Name *</ng-container>
                </label>
                <input
                  id="name"
                  type="text"
                  [(ngModel)]="name"
                  placeholder="z.B. AStA"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  for="description"
                  class="block text-xs font-medium text-gray-500 mb-1"
                >
                  <ng-container i18n>Beschreibung</ng-container>
                </label>
                <textarea
                  id="description"
                  [(ngModel)]="description"
                  rows="2"
                  placeholder="Kurze Beschreibung des Gremiums..."
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
              <div>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    [(ngModel)]="allowScopeSelection"
                    class="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span i18n class="text-xs text-gray-900">Gewerbliche Einreichungen erlauben</span>
                </label>
                <p i18n class="text-xs text-gray-500 mt-1 ml-5">
                  Falls aktiviert, können Gremienmitglieder bei Einreichungen zwischen hoheitlich und gewerblich wählen. Andernfalls werden Einreichungen immer als hoheitlich angelegt.
                </p>
              </div>
            </div>
          </div>

          <!-- Payment Accounts -->
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 i18n class="text-sm font-semibold text-gray-900">
                Zahlungskonten
              </h2>
              <span i18n class="text-xs text-gray-500">
                Konten, von denen aus das Gremium Ausgaben bezahlen kann
              </span>
            </div>
            @if (paymentAccounts.length === 0) {
              <p i18n class="text-xs text-gray-500 mb-3">
                Keine Zahlungskonten vorhanden. Gremienmitglieder reichen Ausgaben dann über die private Kontoabrechnung ein.
              </p>
            }
            <div class="space-y-2">
              @for (account of paymentAccounts; track $index) {
                <div class="flex items-center gap-2">
                  <select
                    [(ngModel)]="account.kind"
                    class="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bank_account" i18n>Bankkonto</option>
                    <option value="cash_box" i18n>Kasse</option>
                  </select>
                  <input
                    type="text"
                    [(ngModel)]="account.label"
                    [placeholder]="accountLabelPlaceholder"
                    class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    (click)="removePaymentAccount($index)"
                    i18n-title
                    title="Konto entfernen"
                    class="px-2 py-1.5 text-xs text-red-600 hover:underline"
                  >
                    <ng-container i18n>Entfernen</ng-container>
                  </button>
                </div>
              }
            </div>
            <button
              type="button"
              (click)="addPaymentAccount()"
              class="mt-3 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
            >
              <ng-container i18n>+ Konto hinzufügen</ng-container>
            </button>
          </div>
        </div>
      </div>
    </app-page-content-layout>
  `,
})
export class CommitteeNewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(CommitteeNewDataService);
  private readonly notifications = inject(NotificationService);

  readonly saving = signal(false);

  name = '';
  description = '';
  allowScopeSelection = false;
  paymentAccounts: PaymentAccountInput[] = [];

  readonly accountLabelPlaceholder = $localize`z.B. Gremiumskonto`;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Gremien`, path: '' },
    { label: $localize`Neu` },
  ];

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  ngOnInit(): void {
    this.breadcrumbs[0].path = `/organizations/${this.getOrgId()}/committees`;
  }

  isValid(): boolean {
    return this.name.trim().length > 0
      && this.paymentAccounts.every((account) => account.label.trim().length > 0);
  }

  addPaymentAccount(): void {
    this.paymentAccounts.push({ uid: '', kind: 'bank_account' as CommitteePaymentAccountKind, label: '' });
  }

  removePaymentAccount(index: number): void {
    this.paymentAccounts.splice(index, 1);
  }

  save(): void {
    if (!this.isValid()) return;

    const input: SaveCommitteeInput = {
      name: this.name.trim(),
      description: this.description.trim(),
      allowScopeSelection: this.allowScopeSelection,
      paymentAccounts: this.paymentAccounts.map((account) => ({
        ...account,
        label: account.label.trim(),
      })),
    };

    this.saving.set(true);
    this.dataService.createCommittee(this.getOrgId(), input).subscribe({
      next: () => {
        this.router.navigate(['/organizations', this.getOrgId(), 'committees']);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Erstellen des Gremiums`);
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/organizations', this.getOrgId(), 'committees']);
  }
}
