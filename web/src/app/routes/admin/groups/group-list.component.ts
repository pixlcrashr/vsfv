import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import {
  ButtonComponent,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
  AdminContentHeaderComponent,
  AdminContentComponent,
} from '../../../shared/components';
import {
  ConfirmDeleteDialogComponent,
  ConfirmDeleteDialogInput,
  ConfirmDeleteDialogOutput,
} from '../../../shared/dialogs/confirm-delete-dialog/confirm-delete-dialog.component';
import { UserGroup } from '../../../shared/models';
import { GroupListDataService } from './group-list.data-service';

@Component({
  selector: 'app-group-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    AdminContentHeaderComponent,
    AdminContentComponent,
  ],
  template: `
    <div class="flex flex-col h-full min-h-0">
      <app-admin-content-header i18n-title title="Gruppen">
        <a routerLink="/admin/groups/new">
          <app-button variant="primary">
            <ng-container i18n>Neue Gruppe</ng-container>
          </app-button>
        </a>
      </app-admin-content-header>
      <app-admin-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Gruppen werden geladen..." />
        } @else if (groups().length === 0) {
          <app-empty-state
            i18n-title title="Keine Gruppen vorhanden"
            i18n-description description="Erstellen Sie eine neue Gruppe, um Benutzerberechtigungen zu verwalten."
          >
            <a routerLink="/admin/groups/new">
              <app-button variant="primary">
                <ng-container i18n>Erste Gruppe erstellen</ng-container>
              </app-button>
            </a>
          </app-empty-state>
        } @else {
          <div class="w-full max-w-3xl">
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
                        <ng-container i18n>Typ</ng-container>
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                      >
                        <ng-container i18n>Beschreibung</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-right">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    @for (group of groups(); track group.id) {
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-2 text-xs text-gray-900">{{ group.name }}</td>
                        <td class="px-3 py-2 text-xs">
                          @if (group.isSystem) {
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" i18n>System</span>
                          } @else {
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" i18n>Benutzerdefiniert</span>
                          }
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900">
                          <div class="max-w-md truncate" [title]="group.description || ''">
                            {{ group.description || '-' }}
                          </div>
                        </td>
                        <td class="px-3 py-2 text-right text-xs">
                          <div class="flex items-center justify-end gap-2">
                            @if (!group.isSystem) {
                              <a
                                [routerLink]="['/admin/groups', group.id, 'edit']"
                                class="text-xs text-blue-600 hover:underline"
                              >
                                <ng-container i18n>Bearbeiten</ng-container>
                              </a>
                              <button
                                type="button"
                                class="text-xs text-red-600 hover:underline"
                                (click)="openDeleteDialog(group)"
                              >
                                <ng-container i18n>Löschen</ng-container>
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
      </app-admin-content>
    </div>
  `,
})
export class GroupListComponent implements OnInit {
  private readonly dataService = inject(GroupListDataService);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly groups = signal<UserGroup[]>([]);

  ngOnInit(): void {
    this.loadGroups();
  }

  private loadGroups(): void {
    this.dataService.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Gruppen`);
        this.loading.set(false);
      },
    });
  }

  openDeleteDialog(group: UserGroup): void {
    const dialogRef = this.dialog.open<ConfirmDeleteDialogOutput, ConfirmDeleteDialogInput>(
      ConfirmDeleteDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          title: $localize`Gruppe löschen`,
          message: $localize`Möchten Sie die Gruppe wirklich löschen?`,
          itemName: group.name,
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.confirmed) {
        this.deleteGroup(group);
      }
    });
  }

  private deleteGroup(group: UserGroup): void {
    this.dataService.deleteGroup(group.id).subscribe({
      next: () => {
        this.groups.update((groups) => groups.filter((g) => g.id !== group.id));
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Löschen der Gruppe`);
      },
    });
  }
}
