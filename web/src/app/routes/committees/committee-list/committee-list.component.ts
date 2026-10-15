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
  PageContentLayoutComponent,
  BreadcrumbItem,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
} from '../../../shared/components';
import {
  ConfirmDeleteDialogComponent,
  ConfirmDeleteDialogInput,
  ConfirmDeleteDialogOutput,
} from '../../../shared/dialogs/confirm-delete-dialog/confirm-delete-dialog.component';
import { formatDateShort } from '../../../shared/utils';
import { Committee } from '../../../shared/models';
import { CommitteeListDataService } from './committee-list.data-service';
import { HasPermissionPipe } from '../../../../lib/authz/has-permission.pipe';
import { Permissions } from '../../../../lib/authz/permissions';

@Component({
  selector: 'app-committee-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContentLayoutComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    HasPermissionPipe,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      @if (Permissions.COMMITTEES_CREATE | hasPermission) {
        <a
          layout-header-actions
          [routerLink]="['/organizations', orgId, 'committees', 'new']"
          class="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:opacity-90"
        >
          <ng-container i18n>Neues Gremium</ng-container>
        </a>
      }

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Gremien werden geladen..." />
        } @else if (committees().length === 0) {
          <app-empty-state
            i18n-title title="Keine Gremien vorhanden"
            i18n-description description="Erstelle dein erstes Gremium."
          >
            @if (Permissions.COMMITTEES_CREATE | hasPermission) {
              <a
                [routerLink]="['/organizations', orgId, 'committees', 'new']"
                class="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:opacity-90"
              >
                <ng-container i18n>Erstes Gremium erstellen</ng-container>
              </a>
            }
          </app-empty-state>
        } @else {
          <div class="w-full max-w-6xl">
            <div class="bg-white rounded-lg border border-gray-200">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Name</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Beschreibung</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Zahlungskonten</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Referenziert</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Aktualisiert</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-right">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    @for (committee of committees(); track committee.id) {
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-2 text-xs text-gray-900">{{ committee.name }}</td>
                        <td class="px-3 py-2 text-xs text-gray-900">
                          <div class="max-w-md truncate" [title]="committee.description || ''">
                            {{ committee.description || '-' }}
                          </div>
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900">
                          {{ committee.paymentAccounts.length > 0 ? committee.paymentAccounts.length : '-' }}
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900">
                          @if (committee.isReferenced) {
                            <ng-container i18n>Ja</ng-container>
                          } @else {
                            <ng-container i18n>Nein</ng-container>
                          }
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900">{{ formatDate(committee.updatedAt) }}</td>
                        <td class="px-3 py-2 text-right text-xs">
                          <div class="flex items-center justify-end gap-2">
                            @if (Permissions.COMMITTEES_UPDATE | hasPermission) {
                              <a
                                [routerLink]="['/organizations', orgId, 'committees', committee.id, 'edit']"
                                class="text-xs text-blue-600 hover:underline"
                              >
                                <ng-container i18n>Bearbeiten</ng-container>
                              </a>
                            }
                            @if (Permissions.COMMITTEES_DELETE | hasPermission) {
                              <span [title]="deleteDisabled(committee) ? deleteDisabledTooltip() : ''">
                                <button
                                  type="button"
                                  class="text-xs text-red-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                                  [disabled]="deleteDisabled(committee)"
                                  (click)="openDeleteDialog(committee)"
                                >
                                  <ng-container i18n>Löschen</ng-container>
                                </button>
                              </span>
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
export class CommitteeListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(CommitteeListDataService);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);

  orgId = '';

  readonly loading = signal(true);
  readonly committees = signal<Committee[]>([]);
  readonly Permissions = Permissions;

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Gremien` }];

  constructor() {
    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.orgId = id;
      this.loading.set(true);
      this.committees.set([]);
      this.loadCommittees();
    });
  }

  private loadCommittees(): void {
    this.dataService.listCommittees(this.orgId).subscribe({
      next: (committees) => {
        this.committees.set(committees);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Gremien`);
        this.loading.set(false);
      },
    });
  }

  deleteDisabled(committee: Committee): boolean {
    return committee.isReferenced;
  }

  deleteDisabledTooltip(): string {
    return $localize`Dieses Gremium wird referenziert und kann daher nicht gelöscht werden.`;
  }

  openDeleteDialog(committee: Committee): void {
    const dialogRef = this.dialog.open<ConfirmDeleteDialogOutput, ConfirmDeleteDialogInput>(
      ConfirmDeleteDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          title: $localize`Gremium löschen`,
          message: $localize`Möchten Sie das Gremium wirklich löschen?`,
          itemName: committee.name,
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.confirmed) {
        this.deleteCommittee(committee);
      }
    });
  }

  private deleteCommittee(committee: Committee): void {
    this.dataService.deleteCommittee(this.orgId, committee.id).subscribe({
      next: () => {
        this.committees.update((committees) => committees.filter((c) => c.id !== committee.id));
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Löschen des Gremiums`);
      },
    });
  }

  formatDate(date: Date): string {
    return formatDateShort(date);
  }
}
