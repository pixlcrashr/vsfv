import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  StatusBadgeComponent,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
} from '../../../shared/components';
import {
  Reimbursement,
  ReimbursementStatus,
  getReimbursementStatusLabel,
  getReimbursementStatusVariant,
  getPaymentMethodLabel,
  formatCurrency,
} from '../../../shared/models';
import { ReimbursementListDataService } from './reimbursement-list.data-service';

@Component({
  selector: 'app-reimbursement-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContentLayoutComponent,
    ButtonComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-header-actions class="flex items-center gap-3">
        <a routerLink="./assistant">
          <app-button variant="secondary"><ng-container i18n>Geführt einreichen</ng-container></app-button>
        </a>
        <a routerLink="./new">
          <app-button><ng-container i18n>Neue Kostenerstattung</ng-container></app-button>
        </a>
      </div>

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Kostenerstattungen werden geladen..." />
        } @else if (reimbursements().length === 0) {
          <app-empty-state
            i18n-title title="Keine Kostenerstattungen vorhanden"
            i18n-description description="Reiche deine erste Kostenerstattung ein."
          >
            <div class="flex items-center gap-3">
              <a routerLink="./assistant">
                <app-button variant="secondary"><ng-container i18n>Geführt einreichen</ng-container></app-button>
              </a>
              <a routerLink="./new">
                <app-button><ng-container i18n>Kostenerstattung einreichen</ng-container></app-button>
              </a>
            </div>
          </app-empty-state>
        } @else {
          <div class="w-full max-w-5xl">
            <div class="bg-white rounded-lg border border-gray-200">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Nr.</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Antragsteller</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Gremium</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Finanzantrag</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500"
                      >
                        <ng-container i18n>Betrag</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Zahlungsart</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Status</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-right">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    @for (reimbursement of reimbursements(); track trackById(reimbursement)) {
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-2 text-xs text-gray-900 font-medium">
                          {{ reimbursement.publicId }}
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900">
                          {{ reimbursement.createdByUserFullName }}
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900">
                          {{ reimbursement.committeeName }}
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-500">
                          {{ reimbursement.financialApplicationPublicId || '-' }}
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900 text-right font-medium">
                          {{ formatCurrency(reimbursement.totalAmount) }}
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-500">
                          {{ getPaymentMethodLabel(reimbursement.paymentMethod) }}
                        </td>
                        <td class="px-3 py-2 text-xs">
                          <app-status-badge [variant]="getStatusVariant(reimbursement.status)" size="sm">
                            {{ getStatusLabel(reimbursement.status) }}
                          </app-status-badge>
                        </td>
                        <td class="px-3 py-2 text-right text-xs">
                          <a
                            [routerLink]="[reimbursement.id]"
                            class="text-xs text-blue-600 hover:underline"
                          >
                            <ng-container i18n>Anzeigen</ng-container>
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
export class ReimbursementListComponent implements OnInit {
  private readonly dataService = inject(ReimbursementListDataService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly reimbursements = signal<Reimbursement[]>([]);

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Kostenerstattungen` }];

  ngOnInit(): void {
    this.loadReimbursements();
  }

  private loadReimbursements(): void {
    this.dataService.getReimbursements().subscribe({
      next: (reimbursements) => {
        this.reimbursements.set(reimbursements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Erstattungen`);
      },
    });
  }

  trackById = (reimbursement: Reimbursement) => reimbursement.id;

  getStatusLabel(status: ReimbursementStatus): string {
    return getReimbursementStatusLabel(status);
  }

  getStatusVariant(status: ReimbursementStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
    return getReimbursementStatusVariant(status);
  }

  getPaymentMethodLabel(method: string): string {
    return getPaymentMethodLabel(method as any);
  }

  formatCurrency(cents: number): string {
    return formatCurrency(cents);
  }
}
