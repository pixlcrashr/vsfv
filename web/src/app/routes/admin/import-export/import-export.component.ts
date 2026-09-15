import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  viewChild,
  ElementRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  LoadingSpinnerComponent,
  EmptyStateComponent,
  NotificationService,
  ButtonComponent,
  AdminContentHeaderComponent,
  AdminContentComponent,
} from '../../../shared/components';
import { Organization } from '../../../shared/models';
import { OrganizationListDataService } from '../organizations/organization-list.data-service';
import { HasPermissionPipe } from '../../../../lib/authz/has-permission.pipe';
import { Permissions } from '../../../../lib/authz/permissions';

interface ImportOrganizationResponse {
  organization_id: string;
  custom_id?: string;
  display_name?: string;
}

@Component({
  selector: 'app-import-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadingSpinnerComponent,
    EmptyStateComponent,
    ButtonComponent,
    AdminContentHeaderComponent,
    AdminContentComponent,
    HasPermissionPipe,
  ],
  template: `
    <div class="flex flex-col h-full min-h-0">
      <app-admin-content-header i18n-title title="Import / Export" />
      <app-admin-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Organisationen werden geladen..." />
        } @else {
          <div class="w-full max-w-3xl space-y-4">
            @if (Permissions.ORGANIZATIONS_CREATE | hasPermission) {
              <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                <h2 class="text-sm font-semibold text-gray-900" i18n>Organisation importieren</h2>
                <p class="text-xs text-gray-500" i18n>
                  Importiert eine komplette Organisation inklusive Konten, Budgets, Buchungen und Zuordnungen aus einer XML-Datei. Die Organisation wird neu erstellt; Benutzer und Gruppen werden nicht importiert.
                </p>
                <div>
                  <app-button (clicked)="openImportFilePicker()" [disabled]="importing()">
                    @if (importing()) {
                      <ng-container i18n>Import läuft...</ng-container>
                    } @else {
                      <ng-container i18n>Aus XML importieren</ng-container>
                    }
                  </app-button>
                </div>
                <input
                  #importInput
                  type="file"
                  accept=".xml,application/xml"
                  class="hidden"
                  (change)="importXml($event)"
                />
              </div>
            }

            <div class="bg-white rounded-lg border border-gray-200">
              <div class="px-4 py-3 border-b border-gray-200">
                <h2 class="text-sm font-semibold text-gray-900" i18n>Organisation exportieren</h2>
                <p class="text-xs text-gray-500 mt-1" i18n>
                  Exportiert eine bestehende Organisation als XML-Datei.
                </p>
              </div>
              @if (organizations().length === 0) {
                <div class="p-4">
                  <app-empty-state
                    i18n-title title="Keine Organisationen vorhanden"
                    i18n-description description="Erstellen oder importieren Sie eine Organisation, um zu beginnen."
                  />
                </div>
              } @else {
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
                          <td class="px-3 py-2 text-right text-xs">
                            <button
                              type="button"
                              (click)="exportXml(org)"
                              class="text-xs text-blue-600 hover:underline"
                              i18n
                            >
                              Exportieren
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }
      </app-admin-content>
    </div>
  `,
})
export class ImportExportComponent implements OnInit {
  private readonly organizationListDataService = inject(OrganizationListDataService);
  private readonly notificationService = inject(NotificationService);
  private readonly http = inject(HttpClient);

  // The XML import/export endpoints live on the API server under /api/v1,
  // outside the generated gateway clients. Derive the origin from
  // apiBaseUrl (which may or may not already include the /api suffix) so the
  // URL always contains /api/ and therefore receives the Bearer token from
  // the auth interceptor.
  private readonly apiOrigin = environment.apiBaseUrl.replace(/\/api\/?$/, '');

  private readonly importUrl = `${this.apiOrigin}/api/v1/organizations:import-xml`;

  readonly importInput = viewChild.required<ElementRef<HTMLInputElement>>('importInput');

  readonly loading = signal(true);
  readonly importing = signal(false);
  readonly organizations = signal<Organization[]>([]);

  readonly Permissions = Permissions;

  ngOnInit(): void {
    this.loadOrganizations();
  }

  private loadOrganizations(): void {
    this.loading.set(true);
    this.organizationListDataService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations.set(orgs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notificationService.error($localize`Fehler beim Laden der Organisationen`);
      },
    });
  }

  openImportFilePicker(): void {
    const input = this.importInput().nativeElement;
    input.value = '';
    input.click();
  }

  importXml(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.item(0);
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.importing.set(true);
    this.http.post<ImportOrganizationResponse>(this.importUrl, formData).subscribe({
      next: (result) => {
        this.importing.set(false);
        const name = result.display_name || '';
        this.notificationService.success(
          name
            ? $localize`Organisation "${name}" wurde importiert`
            : $localize`Organisation wurde importiert`,
        );
        this.loadOrganizations();
      },
      error: (err) => {
        this.importing.set(false);
        const message = err?.error?.error;
        this.notificationService.error(
          message
            ? $localize`Import fehlgeschlagen: ${message}`
            : $localize`Fehler beim Importieren der XML-Datei`,
        );
      },
    });
  }

  exportXml(org: Organization): void {
    const url = `${this.apiOrigin}/api/v1/organizations/${org.id}/data:export-xml`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        const objectUrl = window.URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `vsfv-export-${org.id}.xml`;
        a.click();
        window.URL.revokeObjectURL(objectUrl);
      },
      error: () => {
        this.notificationService.error($localize`Fehler beim Exportieren der XML-Datei`);
      },
    });
  }
}
