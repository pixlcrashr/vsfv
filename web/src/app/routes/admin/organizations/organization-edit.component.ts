import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
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
  ButtonComponent,
  AdminContentHeaderComponent,
  AdminContentComponent,
  AuditLogHistoryComponent,
} from '../../../shared/components';
import { AuditLogHistoryEntry, Organization } from '../../../shared/models';
import { OrganizationEditDataService } from './organization-edit.data-service';

@Component({
  selector: 'app-organization-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    ButtonComponent,
    AdminContentHeaderComponent,
    AdminContentComponent,
    AuditLogHistoryComponent,
  ],
  template: `
    <div class="flex flex-col h-full min-h-0">
      <app-admin-content-header i18n-title title="Organisation bearbeiten">
      </app-admin-content-header>
      <app-admin-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Organisation wird geladen..." />
        } @else if (organization()) {
          <div class="w-full max-w-4xl">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Form (auto-saving) -->
              <div class="lg:col-span-2 space-y-4">
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">
                      Organisationsdetails
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

                  <form [formGroup]="organizationForm">
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
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          rows="3"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        ></textarea>
                      </div>
                    </div>
                  </form>
                </div>

                <!-- Historie -->
                <app-audit-log-history
                  [entries]="auditLog()"
                  [entityLabel]="historyEntityLabel"
                  [entityResource]="historyResource()"
                />
              </div>

              <!-- Right Column: Info & Actions -->
              <div class="space-y-4">
                <!-- Info Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Informationen</h3>
                  <dl class="space-y-3">
                    <div>
                      <dt i18n class="text-xs text-gray-500">ID</dt>
                      <dd class="text-sm text-gray-900 font-mono">{{ organization()!.id }}</dd>
                    </div>
                  </dl>
                </div>

                <!-- Actions Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Aktionen</h3>
                  <div class="space-y-2">
                    <app-button
                      variant="danger"
                      size="md"
                      [fullWidth]="true"
                      [loading]="deleting()"
                      (clicked)="deleteOrganization()"
                    >
                      <ng-container i18n>Organisation löschen</ng-container>
                    </app-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </app-admin-content>
    </div>
  `,
})
export class OrganizationEditComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(OrganizationEditDataService);
  private readonly notifications = inject(NotificationService);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly organization = signal<Organization | null>(null);
  readonly auditLog = signal<AuditLogHistoryEntry[]>([]);
  readonly historyResource = signal('');

  readonly historyEntityLabel = $localize`die Organisation`;

  readonly organizationForm: FormGroup;

  private organizationId = '';

  constructor() {
    this.organizationForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.organizationId = this.route.snapshot.paramMap.get('id') || '';
    if (this.organizationId) {
      this.historyResource.set(`organizations/${this.organizationId}`);
      this.loadOrganization();
      this.loadAuditLog();
      this.setupAutoSave();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAuditLog(): void {
    this.dataService.getAuditLog(this.organizationId).subscribe({
      next: (entries) => this.auditLog.set(entries),
      // Missing audit-log permission or transient errors: show an empty history.
      error: () => this.auditLog.set([]),
    });
  }

  private setupAutoSave(): void {
    this.organizationForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      filter(() => this.organizationForm.valid && this.organizationForm.dirty && !this.loading())
    ).subscribe(() => {
      this.saveOrganization();
    });
  }

  private loadOrganization(): void {
    this.dataService.getOrganization(this.organizationId).subscribe({
      next: (org) => {
        this.organization.set(org);
        this.organizationForm.patchValue({
          name: org.name,
          description: org.description ?? '',
        }, { emitEvent: false });
        this.organizationForm.markAsPristine();
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Organisation`);
        this.loading.set(false);
        this.router.navigate(['/admin/organizations']);
      },
    });
  }

  private saveOrganization(): void {
    if (this.organizationForm.invalid) return;

    this.saving.set(true);
    const { name, description } = this.organizationForm.value;

    this.dataService.updateOrganization(this.organizationId, {
      name: name.trim(),
      description: description.trim(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.organizationForm.markAsPristine();
        this.loadAuditLog();
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern der Organisation`);
        this.saving.set(false);
      },
    });
  }

  deleteOrganization(): void {
    if (!confirm($localize`Sind Sie sicher, dass Sie diese Organisation löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    this.deleting.set(true);
    this.dataService.deleteOrganization(this.organizationId).subscribe({
      next: () => {
        this.notifications.success($localize`Organisation gelöscht`);
        this.router.navigate(['/admin/organizations']);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Löschen der Organisation`);
        this.deleting.set(false);
      },
    });
  }
}
