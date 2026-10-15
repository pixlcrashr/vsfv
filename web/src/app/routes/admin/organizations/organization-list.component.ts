import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import {
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
  ButtonComponent,
  AdminContentHeaderComponent,
  AdminContentComponent,
} from '../../../shared/components';
import { Organization } from '../../../shared/models';
import { OrganizationStoreService } from '../../../shared/services/organization-store.service';
import {
  CreateOrganizationDialogComponent,
  CreateOrganizationDialogOutput,
} from '../../../shared/dialogs/create-organization-dialog/create-organization-dialog.component';

@Component({
  selector: 'app-organization-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadingSpinnerComponent,
    EmptyStateComponent,
    ButtonComponent,
    AdminContentHeaderComponent,
    AdminContentComponent,
  ],
  template: `
    <div class="flex flex-col h-full min-h-0">
      <app-admin-content-header i18n-title title="Organisationen">
        <app-button (clicked)="openCreateDialog()">
          <ng-container i18n>Hinzufügen</ng-container>
        </app-button>
      </app-admin-content-header>
      <app-admin-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Organisationen werden geladen..." />
        } @else if (organizations().length === 0) {
          <app-empty-state
            i18n-title title="Keine Organisationen vorhanden"
            i18n-description description="Erstellen Sie Ihre erste Organisation, um zu beginnen."
          >
            <app-button (clicked)="openCreateDialog()">
              <ng-container i18n>Organisation erstellen</ng-container>
            </app-button>
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
                        <ng-container i18n>Beschreibung</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-right">
                        <span class="sr-only">Aktionen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    @for (org of organizations(); track org.id) {
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-2 text-xs text-gray-900">{{ org.name }}</td>
                        <td class="px-3 py-2 text-xs text-gray-500">{{ org.description || '-' }}</td>
                        <td class="px-3 py-2 text-right text-xs space-x-2">
                          <button
                            (click)="editOrganization(org.id)"
                            class="text-xs text-blue-600 hover:underline"
                            i18n
                          >
                            Bearbeiten
                          </button>
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
export class OrganizationListComponent implements OnInit {
  private readonly organizationStore = inject(OrganizationStoreService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly loading = computed(() => this.organizationStore.loading());
  readonly organizations = computed<Organization[]>(() => this.organizationStore.organizations() ?? []);

  ngOnInit(): void {
    this.organizationStore.load().subscribe({
      error: () => {
        this.notificationService.error($localize`Fehler beim Laden der Organisationen`);
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<CreateOrganizationDialogOutput>(
      CreateOrganizationDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '480px',
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.created && result.organization) {
        // Refresh the shared store so the admin list and the sidebar
        // switcher both show the new organization.
        this.organizationStore.refresh().subscribe();
        this.notificationService.success($localize`Organisation erstellt`);
      }
    });
  }

  editOrganization(id: string): void {
    this.router.navigate(['/admin/organizations', id, 'edit']);
  }
}
