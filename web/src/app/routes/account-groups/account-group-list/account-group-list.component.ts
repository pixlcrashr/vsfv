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
  ButtonComponent,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
} from '../../../shared/components';
import {
  DeleteAccountGroupDialogComponent,
  DeleteAccountGroupDialogInput,
  DeleteAccountGroupDialogOutput
} from '../../../shared/dialogs/delete-account-group-dialog/delete-account-group-dialog.component';
import {
  CreateAccountGroupDialogComponent,
  CreateAccountGroupDialogInput,
  CreateAccountGroupDialogOutput,
} from '../../../shared/dialogs/create-account-group-dialog/create-account-group-dialog.component';
import { AccountGroup } from '../../../shared/models';
import { AccountGroupListDataService } from './account-group-list.data-service';

@Component({
  selector: 'app-account-group-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <app-button layout-header-actions (clicked)="openCreateDialog()"><ng-container i18n>Hinzufügen</ng-container></app-button>

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Kontengruppen werden geladen..." />
        } @else if (groups().length === 0) {
          <app-empty-state
            i18n-title title="Keine Kontengruppen vorhanden"
            i18n-description description="Erstelle deine erste Kontengruppe, um Konten zu gruppieren."
          >
            <app-button (clicked)="openCreateDialog()"><ng-container i18n>Kontengruppe erstellen</ng-container></app-button>
          </app-empty-state>
        } @else {
          <div class="w-full max-w-6xl">
            <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                      class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500"
                    >
                      <ng-container i18n>Zugeordnete Konten</ng-container>
                    </th>
                    <th scope="col" class="px-3 py-2 text-right">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                  @for (group of groups(); track trackById(group)) {
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-3 py-2 text-xs text-gray-900">{{ group.name }}</td>
                      <td class="px-3 py-2 text-xs text-gray-900">
                        <div class="max-w-md truncate" [title]="group.description || ''">
                          {{ group.description || '-' }}
                        </div>
                      </td>
                      <td class="px-3 py-2 text-xs text-right text-gray-900">
                        {{ group.assignmentCount }}
                      </td>
                      <td class="px-3 py-2 text-right text-xs">
                        <div class="flex items-center justify-center gap-2">
                          <a
                            [routerLink]="['/organizations', orgId, 'accountGroups', group.id]"
                            class="text-xs text-blue-600 hover:underline"
                          >
                            <ng-container i18n>Bearbeiten</ng-container>
                          </a>
                          <a
                            [routerLink]="['/organizations', orgId, 'accountGroups', group.id, 'stats']"
                            class="text-xs text-blue-600 hover:underline"
                          >
                            <ng-container i18n>Statistik</ng-container>
                          </a>
                          <button
                            type="button"
                            (click)="confirmDelete(group)"
                            class="text-xs text-red-600 hover:underline"
                          >
                            <ng-container i18n>Löschen</ng-container>
                          </button>
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
export class AccountGroupListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(AccountGroupListDataService);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);

  orgId = '';

  readonly loading = signal(true);
  readonly groups = signal<AccountGroup[]>([]);

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Kontengruppen` }];

  constructor() {
    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.orgId = id;
      this.loading.set(true);
      this.groups.set([]);
      this.loadGroups();
    });
  }

  private loadGroups(): void {
    this.dataService.listGroups(this.orgId).subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Kontengruppen`);
      },
    });
  }

  trackById = (group: AccountGroup) => group.id;

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<CreateAccountGroupDialogOutput, CreateAccountGroupDialogInput>(
      CreateAccountGroupDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: { organizationId: this.orgId },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.created) {
        this.loadGroups();
      }
    });
  }

  confirmDelete(group: AccountGroup): void {
    const dialogRef = this.dialog.open<DeleteAccountGroupDialogOutput, DeleteAccountGroupDialogInput>(
      DeleteAccountGroupDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          groupId: group.id,
          groupName: group.name,
          onDelete: async (groupId: string) => {
            await new Promise<void>((resolve, reject) => {
              this.dataService.deleteGroup(this.orgId, groupId).subscribe({
                next: () => resolve(),
                error: (err) => reject(err),
              });
            });
          },
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.deleted) {
        this.notifications.success($localize`Kontengruppe wurde erfolgreich gelöscht`);
        this.loadGroups();
      }
    });
  }
}
