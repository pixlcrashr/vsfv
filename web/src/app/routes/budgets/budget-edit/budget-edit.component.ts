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
import { Dialog } from '@angular/cdk/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  StatusBadgeComponent,
  LoadingSpinnerComponent,
  NotificationService,
  AuditLogHistoryComponent,
} from '../../../shared/components';
import {
  CloseBudgetDialogComponent,
  CloseBudgetDialogInput,
  CloseBudgetDialogOutput,
} from '../../../shared/dialogs/close-budget-dialog/close-budget-dialog.component';
import {
  CreateTagDialogComponent,
  CreateTagDialogInput,
  CreateTagDialogOutput,
} from '../../../shared/dialogs/create-tag-dialog/create-tag-dialog.component';
import { formatDateShort, formatDateForInput } from '../../../shared/utils';
import { AuditLogHistoryEntry, AuditLogHistoryChange } from '../../../shared/models';
import { BudgetEditDataService, BudgetDetails, UpdateBudgetParams } from './budget-edit.data-service';

@Component({
  selector: 'app-budget-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    PageContentLayoutComponent,
    ButtonComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
    AuditLogHistoryComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs()">
      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Haushaltsplan wird geladen..." />
        } @else if (budget()) {
          <div class="w-full max-w-4xl">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Form (auto-saving) + Revisions -->
              <div class="lg:col-span-2 space-y-4">
                <!-- Budget Form -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">
                      Details
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

                  <form [formGroup]="budgetForm">
                    <div class="space-y-3">
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
                          [readonly]="budget()!.isClosed"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                          [readonly]="budget()!.isClosed"
                          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        ></textarea>
                      </div>

                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            for="startDate"
                            class="block text-xs font-medium text-gray-700 mb-1"
                          >
                            <ng-container i18n>Beginn</ng-container>
                          </label>
                          <input
                            id="startDate"
                            type="date"
                            formControlName="startDate"
                            [disabled]="true"
                            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label
                            for="endDate"
                            class="block text-xs font-medium text-gray-700 mb-1"
                          >
                            <ng-container i18n>Ende</ng-container>
                          </label>
                          <input
                            id="endDate"
                            type="date"
                            formControlName="endDate"
                            [disabled]="true"
                            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div class="space-y-2 pt-1">
                        <label class="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            formControlName="isPublished"
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <ng-container i18n>Veröffentlicht</ng-container>
                        </label>
                        <label class="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            formControlName="publishActualValues"
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <ng-container i18n>Ist-Werte veröffentlichen</ng-container>
                        </label>
                        @if (budgetForm.controls['publishActualValues'].value) {
                          <div class="pl-6">
                            <label class="block text-xs text-gray-500 mb-1" i18n>
                              Ist-Werte veröffentlichen bis
                            </label>
                            <input
                              type="date"
                              formControlName="publishActualValuesUntil"
                              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        }
                      </div>
                    </div>
                  </form>
                </div>

                <!-- Revisionen -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h2 i18n class="text-sm font-semibold text-gray-900">Revisionen</h2>
                    <div class="flex items-center gap-2">
                      @if (!budget()!.hasUntaggedChanges && !budget()!.isClosed) {
                        <span class="text-xs text-gray-500 font-medium">
                          <ng-container i18n>Keine Änderungen vorhanden.</ng-container>
                        </span>
                      }
                      <app-button
                        size="sm"
                        (clicked)="addTag()"
                        [disabled]="budget()!.isClosed"
                      >
                        <ng-container i18n>Neue Revision erstellen</ng-container>
                      </app-button>
                    </div>
                  </div>

                  @if (budget()!.tags.length === 0) {
                    <p i18n class="text-xs text-gray-500">Keine Revisionen vorhanden.</p>
                  } @else {
                    <div class="space-y-2">
                      @for (tag of budget()!.tags; track tag.id) {
                        <div
                          class="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <div>
                            <p class="text-sm font-medium text-gray-900">
                              {{ tag.name }}
                            </p>
                            <p class="text-xs text-gray-500">
                              {{ formatDateShort(tag.date) }} · {{ tag.description || noDescriptionLabel }}
                            </p>
                          </div>
                          <div class="flex items-center gap-2">
                            <span
                              class="text-xs px-2 py-0.5 rounded"
                              [class.bg-green-100]="tag.isPublished"
                              [class.text-green-700]="tag.isPublished"
                              [class.bg-gray-200]="!tag.isPublished"
                              [class.text-gray-600]="!tag.isPublished"
                            >
                              {{ tag.isPublished ? 'Veröffentlicht' : 'Nicht veröffentlicht' }}
                            </span>
                            @if (!budget()!.isClosed) {
                              <button
                                (click)="toggleTagPublication(tag)"
                                class="text-xs text-blue-600 hover:underline"
                              >
                                {{ tag.isPublished ? 'Nicht veröffentlichen' : 'Veröffentlichen' }}
                              </button>
                            }
                            @if (!budget()!.isClosed && budget()!.tags.length > 1) {
                              <button
                                (click)="deleteTag(tag.id)"
                                class="text-xs text-red-600 hover:underline"
                              >
                                <ng-container i18n>Entfernen</ng-container>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Historie -->
                <app-audit-log-history
                  [entries]="auditLog()"
                  [entityLabel]="historyEntityLabel"
                  [entityResource]="historyResource()"
                  [entryLabels]="historyEntryLabels()"
                />
              </div>

              <!-- Right Column: Status & Actions -->
              <div class="space-y-4">
                <!-- Status Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Status</h3>
                  <app-status-badge size="sm" [variant]="budget()!.isClosed ? 'neutral' : 'success'">
                    <ng-container i18n>{{ budget()!.isClosed ? 'Geschlossen' : 'Offen' }}</ng-container>
                  </app-status-badge>
                </div>

                <!-- Changes Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Änderungen</h3>
                  @if (budget()!.hasUntaggedChanges) {
                    <div class="mb-3">
                      <div class="flex items-start gap-2 mb-2">
                        <svg class="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <div>
                          <p class="text-xs font-medium text-orange-600"><ng-container i18n>Ungetaggte Änderungen</ng-container></p>
                          <p class="text-xs text-gray-500 mt-0.5"><ng-container i18n>{{ budget()!.changes.length }} Konto/Konten geändert</ng-container></p>
                        </div>
                      </div>

                      <div class="mt-2 space-y-1">
                        @for (change of budget()!.changes; track change.accountId) {
                          <div class="flex items-center justify-between text-xs rounded px-2 py-1">
                            <span class="font-medium text-gray-700">{{ change.accountFullCode }} {{ change.accountName }}</span>
                            <span class="text-orange-600">{{ (change.diff.toNumber() >= 0 ? '+' : '') + (change.diff.toNumber() | currency: 'EUR':'symbol':'1.2-2':'de-DE') }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  } @else {
                    <div class="flex items-start gap-2">
                      <svg class="w-4 h-4 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                      </svg>
                      <div>
                        <p class="text-xs font-medium text-green-600"><ng-container i18n>Keine Änderungen</ng-container></p>
                        <p class="text-xs text-gray-500 mt-1"><ng-container i18n>Alle Änderungen sind getaggt.</ng-container></p>
                      </div>
                    </div>
                  }
                </div>

                <!-- Actions Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Aktionen</h3>
                  <div class="space-y-2">
                    @if (!budget()!.isClosed) {
                      <app-button
                        variant="danger"
                        size="md"
                        [fullWidth]="true"
                        (clicked)="openCloseBudgetDialog()"
                      >
                        <ng-container i18n>Haushaltsplan schließen</ng-container>
                      </app-button>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class BudgetEditComponent implements OnInit, OnDestroy {
  private readonly dataService = inject(BudgetEditDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly budget = signal<BudgetDetails | null>(null);
  readonly auditLog = signal<AuditLogHistoryEntry[]>([]);
  readonly accountLabels = signal<ReadonlyMap<string, string>>(new Map());
  readonly historyResource = signal('');

  readonly breadcrumbs = signal<BreadcrumbItem[]>([
    { label: $localize`Haushaltspläne`, path: '' },
    { label: $localize`Laden...` },
  ]);

  readonly budgetForm: FormGroup;

  private budgetId = '';
  private orgId = '';

  constructor() {
    this.budgetForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      isPublished: [false],
      publishActualValues: [false],
      publishActualValuesUntil: [null],
    });
  }

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.budgetId = id;
      this.historyResource.set(this.budgetResource());
      this.loadBudget(id);
      this.loadAuditLog();
      this.loadAccountLabels();
      this.setupAutoSave();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private budgetResource(): string {
    return `organizations/${this.orgId}/budgets/${this.budgetId}`;
  }

  private loadAuditLog(): void {
    this.dataService.getAuditLog(this.orgId, this.budgetId).subscribe({
      next: (entries) => this.auditLog.set(entries),
      // Missing audit-log permission or transient errors: show an empty history.
      error: () => this.auditLog.set([]),
    });
  }

  private loadAccountLabels(): void {
    this.dataService.listAccountLabels(this.orgId).subscribe({
      next: (labels) => this.accountLabels.set(labels),
      error: () => this.accountLabels.set(new Map()),
    });
  }

  private readonly currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });

  private formatCurrencyValue(raw: string | undefined): string {
    if (raw === undefined || raw === '') return '0,00 €';
    const n = Number(raw);
    if (isNaN(n)) return raw;
    return this.currencyFormatter.format(n);
  }

  private extractRevisionId(resource: string): string | undefined {
    const match = resource.match(/\/revisions\/([^/]+)/);
    return match?.[1];
  }

  private findChange(entry: AuditLogHistoryEntry, field: string): AuditLogHistoryChange | undefined {
    return entry.changes.find((c) => c.field === field);
  }

  /**
   * Custom per-entry labels for the audit log history:
   *
   * - Revision creation: "hat Revision <name> erstellt." (no change details)
   * - Account value create/update: "hat den Revisionswert von Revision <rev>
   *   und Konto <account> von <old> zu <new> geändert." For created values the
   *   old value defaults to "0,00 €".
   */
  readonly historyEntryLabels = computed<Readonly<Record<string, string>> | undefined>(() => {
    const budget = this.budget();
    const entries = this.auditLog();
    if (!budget || entries.length === 0) return undefined;

    const revisionMap = new Map(budget.tags.map((t) => [t.id, t.name]));
    const accountMap = this.accountLabels();
    const labels: Record<string, string> = {};

    for (const entry of entries) {
      const isRevision = entry.resource.includes('/revisions/');
      const isAccountValue = entry.resource.includes('/accountValues/');

      if (isRevision && !isAccountValue && entry.action === 'CREATE') {
        const nameChange = this.findChange(entry, 'display_name');
        const revName = nameChange?.newValue ?? '';
        labels[entry.id] = $localize`hat Revision ${revName}:revision: erstellt`;
      } else if (isAccountValue && (entry.action === 'CREATE' || entry.action === 'UPDATE')) {
        const valueChange = this.findChange(entry, 'value');
        if (!valueChange) continue;
        const revId = this.extractRevisionId(entry.resource);
        const revName = revId ? (revisionMap.get(revId) ?? revId) : '';
        const accountIdChange = this.findChange(entry, 'account_id');
        const accountId = accountIdChange?.newValue;
        const accountLabel = accountId ? (accountMap.get(accountId) ?? accountId) : '';
        const oldValue = entry.action === 'CREATE'
          ? '0,00 €'
          : this.formatCurrencyValue(valueChange.oldValue);
        const newValue = this.formatCurrencyValue(valueChange.newValue);
        labels[entry.id] = $localize`hat den Revisionswert von Revision ${revName}:revision: und Konto ${accountLabel}:account: von ${oldValue}:old: zu ${newValue}:new: geändert`;
      }
    }

    return Object.keys(labels).length > 0 ? labels : undefined;
  });

  private setupAutoSave(): void {
    this.budgetForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      filter(() => this.budgetForm.valid && this.budgetForm.dirty && !this.loading() && !this.budget()?.isClosed)
    ).subscribe(() => {
      this.saveBudget();
    });
  }

  private loadBudget(id: string): void {
    this.dataService.getBudget(this.orgId, id).subscribe({
      next: (budget) => {
        this.budget.set(budget);
        this.budgetForm.patchValue({
          name: budget.displayName,
          description: budget.displayDescription,
          startDate: formatDateForInput(budget.periodStart),
          endDate: formatDateForInput(budget.periodEnd),
          isPublished: budget.isPublished ?? false,
          publishActualValues: budget.publishActualValues ?? false,
          publishActualValuesUntil: budget.publishActualValuesUntil ? formatDateForInput(budget.publishActualValuesUntil) : null,
        }, { emitEvent: false });
        this.budgetForm.markAsPristine();
        if (budget.isClosed) {
          this.budgetForm.get('isPublished')?.disable({ emitEvent: false });
          this.budgetForm.get('publishActualValues')?.disable({ emitEvent: false });
          this.budgetForm.get('publishActualValuesUntil')?.disable({ emitEvent: false });
        } else {
          this.budgetForm.get('isPublished')?.enable({ emitEvent: false });
          this.budgetForm.get('publishActualValues')?.enable({ emitEvent: false });
          this.budgetForm.get('publishActualValuesUntil')?.enable({ emitEvent: false });
        }
        this.breadcrumbs.set([
          { label: $localize`Haushaltspläne`, path: `/organizations/${this.orgId}/budgets` },
          { label: budget.displayName },
        ]);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden des Haushaltsplans`);
        this.loading.set(false);
        this.router.navigate(['/organizations', this.orgId, 'budgets']);
      },
    });
  }

  private saveBudget(): void {
    if (this.budgetForm.invalid) return;

    this.saving.set(true);
    const budget = this.budget()!;
    const {
      name,
      description,
      isPublished,
      publishActualValues,
      publishActualValuesUntil,
    } = this.budgetForm.value;

    const params: UpdateBudgetParams = {
      name,
      description,
      isPublished: isPublished ?? false,
      publishActualValues: publishActualValues ?? false,
      publishActualValuesUntil: publishActualValuesUntil ? new Date(publishActualValuesUntil) : null,
    };

    this.dataService
      .updateBudget(
        this.orgId,
        budget.id,
        params,
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.budgetForm.markAsPristine();
          this.loadAuditLog();
          // Update breadcrumbs with new name
          this.breadcrumbs.set([
            { label: $localize`Haushaltspläne`, path: `/organizations/${this.orgId}/budgets` },
            { label: name },
          ]);
        },
        error: () => {
          this.notifications.error($localize`Fehler beim Speichern des Haushaltsplans`);
          this.saving.set(false);
        },
      });
  }

  addTag(): void {
    const budget = this.budget();
    if (!budget) return;

    // Prevent tag creation for closed budgets
    if (budget.isClosed) {
      this.notifications.error($localize`Revisionen können nicht für geschlossene Haushaltspläne erstellt werden`);
      return;
    }

    // Always show the dialog with changes (or no changes warning)
    this.openCreateTagDialog();
  }

  private openCreateTagDialog(): void {
    const budget = this.budget();
    if (!budget) return;

    const today = new Date();
    const defaultName = this.formatDateForTag(today);

    const dialogRef = this.dialog.open<CreateTagDialogOutput, CreateTagDialogInput>(
      CreateTagDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '700px',
        data: {
          budgetName: budget.displayName,
          hasChanges: budget.hasUntaggedChanges,
          changes: budget.changes,
          defaultName,
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.confirmed) {
        this.createTag(!budget.hasUntaggedChanges, result.name || defaultName, result.description || '');
      }
    });
  }

  private createTag(force: boolean, name: string, description: string): void {
    const budget = this.budget();
    if (!budget) return;

    this.dataService.createBudgetRevision(this.orgId, budget.id, new Date(), name, description, force).subscribe({
      next: () => {
        this.loadBudget(budget.id);
        this.loadAuditLog();
        this.notifications.success($localize`Revision erfolgreich erstellt`);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Hinzufügen der Revision`);
      },
    });
  }

  private formatDateForTag(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  toggleTagPublication(tag: BudgetDetails['tags'][number]): void {
    const budget = this.budget();
    if (!budget || budget.isClosed) return;

    this.dataService.updateBudgetRevision(this.orgId, budget.id, tag.id, !tag.isPublished).subscribe({
      next: () => {
        this.loadBudget(budget.id);
        this.loadAuditLog();
        this.notifications.success(tag.isPublished ? $localize`Revision wurde unveröffentlicht` : $localize`Revision wurde veröffentlicht`);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Aktualisieren der Revision-Veröffentlichung`);
      },
    });
  }

  deleteTag(tagId: string): void {
    const budget = this.budget();
    if (!budget) return;

    this.dataService.deleteBudgetRevision(this.orgId, tagId).subscribe({
      next: () => {
        this.loadBudget(budget.id);
        this.loadAuditLog();
        this.notifications.success($localize`Revision erfolgreich entfernt`);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Entfernen der Revision`);
      },
    });
  }

  openCloseBudgetDialog(): void {
    const budget = this.budget();
    if (!budget || budget.isClosed) return;

    const dialogRef = this.dialog.open<CloseBudgetDialogOutput, CloseBudgetDialogInput>(
      CloseBudgetDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          organizationId: this.orgId,
          budgetId: budget.id,
          budgetName: budget.displayName,
        },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.closed) {
        this.loadBudget(budget.id);
        this.loadAuditLog();
      }
    });
  }

  readonly noDescriptionLabel = $localize`Keine Beschreibung`;
  readonly historyEntityLabel = $localize`den Haushaltsplan`;
  formatDateShort = formatDateShort;
}
