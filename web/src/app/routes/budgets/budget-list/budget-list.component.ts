import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { merge, map, distinctUntilChanged, filter } from 'rxjs';
import { Dialog } from '@angular/cdk/dialog';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
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
  ConfirmDeleteDialogComponent,
  ConfirmDeleteDialogInput,
  ConfirmDeleteDialogOutput
} from '../../../shared/dialogs/confirm-delete-dialog/confirm-delete-dialog.component';
import {
  CreateBudgetDialogComponent,
  CreateBudgetDialogInput,
  CreateBudgetDialogOutput,
} from '../../../shared/dialogs/create-budget-dialog/create-budget-dialog.component';
import { Budget } from '../../../shared/models';
import { formatDateShort } from '../../../shared/utils';
import { BudgetListDataService } from './budget-list.data-service';
import { HasPermissionPipe } from '../../../../lib/authz/has-permission.pipe';
import { Permissions } from '../../../../lib/authz/permissions';



@Component({
  selector: 'app-budget-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContentLayoutComponent,
    ButtonComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    HasPermissionPipe,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      @if (Permissions.BUDGETS_CREATE | hasPermission) {
        <app-button layout-header-actions (clicked)="openCreateDialog()"><ng-container i18n>Hinzufügen</ng-container></app-button>
      }

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Haushaltspläne werden geladen..." />
        } @else if (budgets().length === 0) {
          <app-empty-state
            i18n-title title="Keine Haushaltspläne vorhanden"
            i18n-description description="Erstelle deinen ersten Haushaltsplan, um mit der Budgetplanung zu beginnen."
          >
            @if (Permissions.BUDGETS_CREATE | hasPermission) {
              <app-button (clicked)="openCreateDialog()"><ng-container i18n>Haushaltsplan erstellen</ng-container></app-button>
            }
          </app-empty-state>
        } @else {
          <div class="w-full max-w-6xl">
            @if (Permissions.BUDGETS_UPDATE | hasPermission) {
              <p class="mb-2 text-xs text-gray-500">
                <ng-container i18n>Ziehe die Haushaltspläne am Griff, um ihre Reihenfolge zu ändern. Die Reihenfolge gilt auch für andere Ansichten.</ng-container>
              </p>
            }
            <div class="bg-white rounded-lg border border-gray-200">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    @if (Permissions.BUDGETS_UPDATE | hasPermission) {
                      <th scope="col" class="px-2 py-1 w-8">
                        <span class="sr-only" i18n>Sortieren</span>
                      </th>
                    }
                    <th
                      scope="col"
                      class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                    >
                      <ng-container i18n>Name</ng-container>
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                    >
                      <ng-container i18n>Beginn</ng-container>
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                    >
                      <ng-container i18n>Ende</ng-container>
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                    >
                      <ng-container i18n>Status</ng-container>
                    </th>
                    <th scope="col" class="px-3 py-1 text-right">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody
                  class="divide-y divide-gray-200 bg-white"
                  cdkDropList
                  cdkDropListOrientation="vertical"
                  [cdkDropListData]="budgets()"
                  (cdkDropListDropped)="drop($event)"
                >
                  @for (budget of budgets(); track trackById(budget)) {
                    <tr
                      class="hover:bg-gray-50 transition-colors"
                      cdkDrag
                      cdkDragPreviewClass="budget-row-drag-preview"
                      [cdkDragDisabled]="!(Permissions.BUDGETS_UPDATE | hasPermission)"
                    >
                      @if (Permissions.BUDGETS_UPDATE | hasPermission) {
                        <td class="px-2 py-1 w-8 text-gray-400">
                          <button
                            type="button"
                            cdkDragHandle
                            class="cursor-grab active:cursor-grabbing hover:text-gray-600"
                            i18n-aria-label
                            aria-label="Zum Ändern der Reihenfolge ziehen"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                              <circle cx="7" cy="5" r="1.5" />
                              <circle cx="13" cy="5" r="1.5" />
                              <circle cx="7" cy="10" r="1.5" />
                              <circle cx="13" cy="10" r="1.5" />
                              <circle cx="7" cy="15" r="1.5" />
                              <circle cx="13" cy="15" r="1.5" />
                            </svg>
                            <span class="sr-only" i18n>Nach oben oder unten ziehen, um die Reihenfolge zu ändern</span>
                          </button>
                        </td>
                      }
                      <td class="px-3 py-1 text-xs text-gray-900">{{ budget.displayName }}</td>
                      <td class="px-3 py-1 text-xs text-gray-900">{{ budget.periodStart }}</td>
                      <td class="px-3 py-1 text-xs text-gray-900">{{ budget.periodEnd }}</td>
                      <td class="px-3 py-1 text-xs text-gray-900">
                        <app-status-badge [variant]="budget.isClosed ? 'neutral' : 'success'" size="sm">
                          <ng-container i18n>{{ budget.isClosed ? 'Geschlossen' : 'Offen' }}</ng-container>
                        </app-status-badge>
                      </td>
                      <td class="px-3 py-1 text-right text-xs">
                        <div class="flex items-center justify-end gap-2">
                          <a
                            [routerLink]="['/organizations', orgId, 'budgets', budget.id]"
                            class="text-xs text-blue-600 hover:underline"
                          >
                            <ng-container i18n>Bearbeiten</ng-container>
                          </a>
                          @if (Permissions.BUDGETS_DELETE | hasPermission) {
                            <button
                              (click)="confirmDelete(budget)"
                              class="text-xs text-red-600 hover:underline"
                            >
                              <ng-container i18n>Entfernen</ng-container>
                            </button>
                          }
                        </div>
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
export class BudgetListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(BudgetListDataService);
  private readonly dialog = inject(Dialog);
  private readonly _notificationService = inject(NotificationService);

  orgId = '';

  readonly loading = signal(true);
  readonly budgets = signal<Budget[]>([]);
  readonly Permissions = Permissions;

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Haushaltspläne` }];

  constructor() {
    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.orgId = id;
      this.loading.set(true);
      this.budgets.set([]);
      this.loadBudgets();
    });
  }

  private loadBudgets(): void {
    this.dataService.listBudgets(this.orgId).subscribe({
      next: (budgets) => {
        const formatted = [...budgets]
          .sort((a, b) => a.order - b.order)
          .map((b) => ({
            ...b,
            periodStart: formatDateShort(b.periodStart) as unknown as Date,
            periodEnd: formatDateShort(b.periodEnd) as unknown as Date,
          }));
        this.budgets.set(formatted as Budget[]);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._notificationService.error($localize`Fehler beim Laden der Haushaltspläne`, {
          duration: 5000,
        });
      },
    });
  }

  trackById = (budget: Budget) => budget.id;

  drop(event: CdkDragDrop<Budget[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const original = [...this.budgets()];
    const reordered = [...original];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.budgets.set(reordered);

    this.dataService.reorderBudgets(this.orgId, reordered.map(b => b.id)).subscribe({
      error: () => {
        this.budgets.set(original);
        this._notificationService.error($localize`Fehler beim Ändern der Reihenfolge`, {
          duration: 5000,
        });
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<CreateBudgetDialogOutput, CreateBudgetDialogInput>(
      CreateBudgetDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: { organizationId: this.orgId },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.created) {
        this.loadBudgets();
      }
    });
  }

  confirmDelete(budget: Budget): void {
    const dialogRef = this.dialog.open<ConfirmDeleteDialogOutput, ConfirmDeleteDialogInput>(
      ConfirmDeleteDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          title: $localize`Haushaltsplan entfernen`,
          message: $localize`Bist du sicher, dass du den Haushaltsplan entfernen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.`,
          itemName: budget.displayName,
          confirmLabel: $localize`Entfernen`,
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.confirmed) {
        this.deleteBudget(budget);
      }
    });
  }

  private deleteBudget(budget: Budget): void {
    this.dataService.deleteBudget(this.orgId, budget.id).subscribe({
      next: () => {
        this.loadBudgets();
      },
    });
  }
}
