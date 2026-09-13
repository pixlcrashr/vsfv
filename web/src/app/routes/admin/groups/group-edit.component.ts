import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import {
  LoadingSpinnerComponent,
  NotificationService,
  AdminContentHeaderComponent,
  AdminContentComponent,
} from '../../../shared/components';
import { formatDateShort } from '../../../shared/utils';
import { UserGroup, Organization } from '../../../shared/models';
import { GroupEditDataService } from './group-edit.data-service';
import { PermissionCatalogService, PermissionCategory } from '../../../shared/services/permission-catalog.service';
import { OrganizationListDataService } from '../organizations/organization-list.data-service';

@Component({
  selector: 'app-group-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    AdminContentHeaderComponent,
    AdminContentComponent,
  ],
  template: `
    <div class="flex flex-col h-full min-h-0">
      <app-admin-content-header i18n-title title="Gruppe bearbeiten">
      </app-admin-content-header>
      <app-admin-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Gruppe wird geladen..." />
        } @else if (group()) {
          <div class="w-full max-w-4xl">
            @if (isSystem()) {
              <div class="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  class="h-4 w-4 shrink-0 text-blue-500 mt-0.5"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="text-xs text-blue-800" i18n>Diese Gruppe ist eine Systemgruppe und kann nicht bearbeitet werden.</span>
              </div>
            }
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Form (auto-saving) -->
              <div class="lg:col-span-2 space-y-4">
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">
                      Gruppendetails
                    </h2>
                    @if (saving()) {
                      <span class="text-xs text-gray-500 flex items-center gap-1">
                        <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <ng-container i18n>Speichern...</ng-container>
                      </span>
                    }
                  </div>

                  <form [formGroup]="groupForm">
                    <div class="space-y-3">
                      <div>
                        <label
                          for="name"
                          class="block text-xs font-medium text-gray-700 mb-1"
                        >
                          <ng-container i18n>Name *</ng-container>
                        </label>
                        <input
                          id="name"
                          type="text"
                          formControlName="name"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label
                          for="description"
                          class="block text-xs font-medium text-gray-700 mb-1"
                        >
                          <ng-container i18n>Beschreibung</ng-container>
                        </label>
                        <textarea
                          id="description"
                          formControlName="description"
                          rows="2"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                        ></textarea>
                      </div>
                    </div>
                  </form>
                </div>

                <!-- Organizations Section -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">
                      Organisationen
                    </h2>
                  </div>

                  @if (organizations().length === 0) {
                    <p i18n class="text-xs text-gray-500">Keine Organisationen vorhanden.</p>
                  } @else {
                    <div class="space-y-2">
                      <label class="flex items-center gap-2" [class.cursor-pointer]="!isSystem()">
                        <input
                          type="checkbox"
                          [checked]="isAllOrganizations()"
                          (change)="toggleAllOrganizations($event)"
                          [disabled]="isSystem()"
                          class="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <span class="text-sm font-medium text-gray-900" i18n>Alle Organisationen (*)</span>
                      </label>

                      @if (!isAllOrganizations()) {
                        <div class="space-y-1 pl-6 border-l border-gray-200 ml-2">
                          @for (org of organizations(); track org.id) {
                            <label class="flex items-center gap-2" [class.cursor-pointer]="!isSystem()">
                              <input
                                type="checkbox"
                                [checked]="isOrganizationAssigned(org.id)"
                                (change)="toggleOrganization(org.id, $event)"
                                [disabled]="isSystem()"
                                class="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <span class="text-sm text-gray-900">{{ org.name }}</span>
                            </label>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Permissions Section -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">
                      Berechtigungen
                    </h2>
                  </div>

                  @if (permissionCategories().length === 0) {
                    <p i18n class="text-xs text-gray-500">Berechtigungen werden geladen...</p>
                  } @else {
                    <div class="space-y-4">
                      @for (category of permissionCategories(); track category.name) {
                        <div>
                          <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            {{ category.name }}
                          </h4>
                          <div class="space-y-1">
                            @for (permission of category.permissions; track permission.id) {
                              <label
                                class="flex items-center gap-2"
                                [class.cursor-pointer]="!isSystem()"
                              >
                                <input
                                  type="checkbox"
                                  [checked]="isPermissionAssigned(permission.id)"
                                  (change)="togglePermission(permission.id, $event)"
                                  [disabled]="isSystem()"
                                  class="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <div>
                                  <span class="text-sm text-gray-900">{{ permission.name }}</span>
                                  <p class="text-xs text-gray-500">{{ permission.description }}</p>
                                </div>
                              </label>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Right Column: Info & Actions -->
              <div class="space-y-4">
                <!-- Info Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Informationen</h3>
                  <dl class="space-y-3">
                    <div>
                      <dt i18n class="text-xs text-gray-500">Erstellt am</dt>
                      <dd class="text-sm text-gray-900">{{ formatDate(group()!.createdAt) }}</dd>
                    </div>
                    <div>
                      <dt i18n class="text-xs text-gray-500">Zuletzt geändert</dt>
                      <dd class="text-sm text-gray-900">{{ formatDate(group()!.updatedAt) }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        }
      </app-admin-content>
    </div>
  `,
})
export class GroupEditComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(GroupEditDataService);
  private readonly permissionCatalog = inject(PermissionCatalogService);
  private readonly orgListDataService = inject(OrganizationListDataService);
  private readonly notifications = inject(NotificationService);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly group = signal<UserGroup | null>(null);
  readonly permissionCategories = signal<PermissionCategory[]>([]);
  readonly organizations = signal<Organization[]>([]);
  readonly assignedPermissionIds = signal<Set<string>>(new Set());
  readonly assignedOrgIds = signal<Set<string>>(new Set());
  readonly allOrganizations = signal(false);

  readonly isAllOrganizations = computed(() => this.allOrganizations());
  readonly isSystem = computed(() => this.group()?.isSystem ?? false);

  readonly groupForm: FormGroup;

  private groupId = '';

  constructor() {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('id') || '';
    if (this.groupId) {
      this.loadGroup();
      this.loadOrganizations();
      this.loadPermissions();
      this.setupAutoSave();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupAutoSave(): void {
    this.groupForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      filter(() => this.groupForm.valid && this.groupForm.dirty && !this.loading())
    ).subscribe(() => {
      this.saveGroup();
    });
  }

  private loadGroup(): void {
    this.dataService.getGroup(this.groupId).subscribe({
      next: (group) => {
        this.group.set(group);
        this.groupForm.patchValue({
          name: group.name,
          description: group.description ?? '',
        }, { emitEvent: false });
        this.groupForm.markAsPristine();

        // System groups cannot be modified; disable the auto-saving form.
        if (group.isSystem) {
          this.groupForm.disable({ emitEvent: false });
        }

        // Load assigned permissions and organizations from the group.
        this.assignedPermissionIds.set(new Set(group.permissions));

        // Check if wildcard is set, otherwise parse org IDs.
        if (group.organizations.includes('*')) {
          this.allOrganizations.set(true);
          this.assignedOrgIds.set(new Set());
        } else {
          this.allOrganizations.set(false);
          const orgIds = group.organizations
            .map((rn) => this.extractOrgId(rn))
            .filter((id) => id !== '');
          this.assignedOrgIds.set(new Set(orgIds));
        }

        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Gruppe`);
        this.loading.set(false);
        this.router.navigate(['/admin/groups']);
      },
    });
  }

  private loadOrganizations(): void {
    this.orgListDataService.getOrganizations().subscribe({
      next: (orgs) => this.organizations.set(orgs),
    });
  }

  private loadPermissions(): void {
    this.permissionCatalog.getPermissionCategories().subscribe({
      next: (categories) => {
        this.permissionCategories.set(categories);
      },
    });
  }

  private saveGroup(): void {
    if (this.groupForm.invalid || this.isSystem()) return;

    this.saving.set(true);
    const { name, description } = this.groupForm.value;

    this.dataService.updateGroup(this.groupId, {
      name: name.trim(),
      description: description.trim(),
      organizations: this.buildOrganizationsList(),
      permissions: Array.from(this.assignedPermissionIds()),
    }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.groupForm.markAsPristine();
        this.group.set(updated);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern der Gruppe`);
        this.saving.set(false);
      },
    });
  }

  private buildOrganizationsList(): string[] {
    if (this.allOrganizations()) {
      return ['*'];
    }
    return Array.from(this.assignedOrgIds()).map((id) => `organizations/${id}`);
  }

  private extractOrgId(resourceName: string): string {
    const parts = resourceName.split('/');
    return parts.length >= 2 ? parts[parts.length - 1] : resourceName;
  }

  isPermissionAssigned(permissionId: string): boolean {
    return this.assignedPermissionIds().has(permissionId);
  }

  togglePermission(permissionId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.assignedPermissionIds.update((ids) => {
      const next = new Set(ids);
      if (checked) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
      }
      return next;
    });
    this.saveGroup();
  }

  isOrganizationAssigned(orgId: string): boolean {
    return this.assignedOrgIds().has(orgId);
  }

  toggleOrganization(orgId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.assignedOrgIds.update((ids) => {
      const next = new Set(ids);
      if (checked) {
        next.add(orgId);
      } else {
        next.delete(orgId);
      }
      return next;
    });
    this.saveGroup();
  }

  toggleAllOrganizations(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.allOrganizations.set(checked);
    if (checked) {
      this.assignedOrgIds.set(new Set());
    }
    this.saveGroup();
  }

  formatDate(date: Date): string {
    return formatDateShort(date);
  }
}
