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
  PageContentLayoutComponent,
  BreadcrumbItem,
  StatusBadgeComponent,
  LoadingSpinnerComponent,
  NotificationService,
  AuditLogHistoryComponent,
} from '../../../shared/components';
import { formatDateTime } from '../../../shared/utils';
import { AuditLogHistoryEntry } from '../../../shared/models';
import { AccountEditDataService, AccountDetails } from './account-edit.data-service';

@Component({
  selector: 'app-account-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageContentLayoutComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
    AuditLogHistoryComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs()">
      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Konto wird geladen..." />
        } @else if (account()) {
          <div class="w-full max-w-4xl">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Form (auto-saving) -->
              <div class="lg:col-span-2 space-y-4">
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">
                      Konto Details
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

                  <form [formGroup]="accountForm">
                    <div class="space-y-3">
                      <div>
                        <label
                          for="code"
                          class="block text-xs font-medium text-gray-700 mb-1"
                        >
                          <ng-container i18n>Kontonummer</ng-container>
                        </label>
                        <input
                          id="code"
                          type="text"
                          formControlName="code"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label
                          for="name"
                          class="block text-xs font-medium text-gray-700 mb-1"
                        >
                          <ng-container i18n>Name</ng-container>
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
                          rows="2"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <!-- Status Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Status</h3>
                  <app-status-badge size="sm" [variant]="account()!.isArchived ? 'neutral' : 'success'">
                    <ng-container i18n>{{ account()!.isArchived ? 'Archiviert' : 'Aktiv' }}</ng-container>
                  </app-status-badge>
                </div>

                <!-- Metadata Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Informationen</h3>
                  <dl class="space-y-3">
                    <div>
                      <dt i18n class="text-xs text-gray-500">Erstellt am</dt>
                      <dd class="text-sm text-gray-900">
                        {{ formatDateTime(account()!.createdAt) }}
                      </dd>
                    </div>
                    <div>
                      <dt i18n class="text-xs text-gray-500">Zuletzt geändert</dt>
                      <dd class="text-sm text-gray-900">
                        {{ formatDateTime(account()!.updatedAt) }}
                      </dd>
                    </div>
                    <div>
                      <dt i18n class="text-xs text-gray-500">Hierarchieebene</dt>
                      <dd class="text-sm text-gray-900">{{ account()!.depth + 1 }}</dd>
                    </div>
                    <div>
                      <dt i18n class="text-xs text-gray-500">Unterkonten</dt>
                      <dd class="text-sm text-gray-900">{{ account()!.childrenCount }}</dd>
                    </div>
                  </dl>
                </div>

              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class AccountEditComponent implements OnInit, OnDestroy {
  private readonly dataService = inject(AccountEditDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly account = signal<AccountDetails | null>(null);
  readonly auditLog = signal<AuditLogHistoryEntry[]>([]);
  readonly historyResource = signal('');

  readonly historyEntityLabel = $localize`das Konto`;

  readonly breadcrumbs = signal<BreadcrumbItem[]>([
    { label: $localize`Haushaltskonten`, path: '' },
    { label: $localize`Laden...` },
  ]);

  readonly accountForm: FormGroup;

  private orgId = '';
  private accountId = '';

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  constructor() {
    this.accountForm = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.accountId = id;
      this.historyResource.set(`organizations/${this.orgId}/accounts/${this.accountId}`);
      this.loadAccount(id);
      this.loadAuditLog();
      this.setupAutoSave();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAuditLog(): void {
    this.dataService.getAuditLog(this.orgId, this.accountId).subscribe({
      next: (entries) => this.auditLog.set(entries),
      // Missing audit-log permission or transient errors: show an empty history.
      error: () => this.auditLog.set([]),
    });
  }

  private setupAutoSave(): void {
    this.accountForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      filter(() => this.accountForm.valid && this.accountForm.dirty && !this.loading())
    ).subscribe(() => {
      this.saveAccount();
    });
  }

  private loadAccount(id: string): void {
    this.dataService.getAccount(this.orgId, id).subscribe({
      next: (account) => {
        this.account.set(account);
        this.accountForm.patchValue({
          code: account.code,
          name: account.name,
          description: account.description,
        }, { emitEvent: false });
        this.accountForm.markAsPristine();
        this.breadcrumbs.set([
          { label: $localize`Haushaltskonten`, path: `/organizations/${this.orgId}/accounts` },
          { label: `${account.code} - ${account.name}` },
        ]);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden des Kontos`);
        this.router.navigate(['/organizations', this.orgId, 'accounts']);
      },
    });
  }

  private saveAccount(): void {
    if (this.accountForm.invalid) return;

    this.saving.set(true);
    const account = this.account()!;
    const { code, name, description } = this.accountForm.value;

    this.dataService.updateAccount(this.orgId, account.id, name, code, description).subscribe({
      next: () => {
        this.saving.set(false);
        this.accountForm.markAsPristine();
        this.loadAuditLog();
        // Update breadcrumbs with new values
        this.breadcrumbs.set([
          { label: $localize`Haushaltskonten`, path: `/organizations/${this.orgId}/accounts` },
          { label: `${code} - ${name}` },
        ]);
      },
      error: () => {
        this.saving.set(false);
        this.notifications.error($localize`Fehler beim Speichern des Kontos`);
      },
    });
  }

  formatDateTime = formatDateTime;
}
