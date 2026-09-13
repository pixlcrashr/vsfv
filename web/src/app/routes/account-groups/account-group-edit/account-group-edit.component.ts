import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  LoadingSpinnerComponent,
  NotificationService,
  AuditLogHistoryComponent,
} from '../../../shared/components';
import {
  DeleteAccountGroupDialogComponent,
  DeleteAccountGroupDialogInput,
  DeleteAccountGroupDialogOutput
} from '../../../shared/dialogs/delete-account-group-dialog/delete-account-group-dialog.component';
import { AccountGroupOperation, AuditLogHistoryEntry } from '../../../shared/models';
import { AccountGroupEditDataService, AccountGroupDetails } from './account-group-edit.data-service';
import { AccountGroupEditService, AccountGroupRow } from './account-group-edit.service';

@Component({
  selector: 'app-account-group-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccountGroupEditService],
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageContentLayoutComponent,
    LoadingSpinnerComponent,
    AuditLogHistoryComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs()">
      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Kontengruppe wird geladen..." />
        } @else if (group()) {
          <div class="w-full max-w-4xl">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Form (auto-saving) + Assigned Accounts -->
              <div class="lg:col-span-2 space-y-4">
                <!-- Group Details Form -->
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

                <!-- Account Operations -->
                <div class="bg-white rounded-lg border border-gray-200">
                  <div class="p-4 border-b border-gray-200">
                    <h3 i18n class="text-sm font-semibold text-gray-900">
                      Zuweisungen
                    </h3>
                  </div>
                  @if (loadingAccounts()) {
                    <div class="p-8 flex justify-center">
                      <app-loading-spinner [fullPage]="false" i18n-text text="Konten werden geladen..." />
                    </div>
                  } @else {
                    @let rows = editService.rows();
                    @let accountCols = editService.accountCols();
                    @let maxDepth = editService.maxDepth();

                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th
                              [colSpan]="maxDepth + 1"
                              scope="col"
                              class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                            >
                              <ng-container i18n>Konto</ng-container>
                            </th>
                            <th
                              scope="col"
                              class="py-1 text-[10px] font-semibold uppercase tracking-wider text-center text-gray-500"
                            >
                              I
                            </th>
                            <th
                              scope="col"
                              class="py-1 text-[10px] font-semibold uppercase tracking-wider text-center text-gray-500"
                            >
                              A
                            </th>
                            <th
                              scope="col"
                              class="py-1 text-[10px] font-semibold uppercase tracking-wider text-center text-gray-500"
                            >
                              S
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                          @for (row of rows; track row.accountId) {
                            <tr [class.bg-gray-50]="row.isArchived" [class.hover:bg-gray-100]="!row.isArchived" [class.hover:bg-gray-50]="row.isArchived" class="transition-colors">
                              @for (i of accountCols; track $index) {
                                @if (row.depth === $index) {
                                  <td [colSpan]="maxDepth + 1 - $index" class="px-3 py-2 text-xs text-gray-900">
                                    {{ row.displayCode }} &mdash; {{ row.displayName }}
                                    @if (row.isArchived) {
                                      <span class="ml-1.5 inline-block px-1 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        <ng-container i18n>Archiviert</ng-container>
                                      </span>
                                    }
                                  </td>
                                } @else if (row.depth > $index) {
                                  <td class="px-2"></td>
                                }
                              }

                              <td class="px-1 py-1 text-center">
                                <input
                                  type="radio"
                                  [name]="'operation-' + row.accountId"
                                  [checked]="row.operation === 'I'"
                                  [disabled]="updatingOperation()"
                                  (change)="onOperationChange(row, 'I')"
                                  class="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                              </td>
                              <td class="px-1 py-1 text-center">
                                <input
                                  type="radio"
                                  [name]="'operation-' + row.accountId"
                                  [checked]="row.operation === 'A'"
                                  [disabled]="updatingOperation()"
                                  (change)="onOperationChange(row, 'A')"
                                  class="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                              </td>
                              <td class="px-1 py-1 text-center">
                                <input
                                  type="radio"
                                  [name]="'operation-' + row.accountId"
                                  [checked]="row.operation === 'S'"
                                  [disabled]="updatingOperation()"
                                  (change)="onOperationChange(row, 'S')"
                                  class="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>

                <!-- Historie -->
                <app-audit-log-history
                  [entries]="auditLog()"
                  [entityLabel]="historyEntityLabel"
                  [entityResource]="historyResource()"
                  [entryLabels]="assignmentEntryLabels()"
                  [entryActions]="assignmentEntryActions()"
                />
              </div>

              <!-- Right Column: Actions -->
              <div class="space-y-4">
                <!-- Actions Card -->
                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 i18n class="text-xs font-semibold text-gray-500 uppercase mb-3">Aktionen</h3>
                  <div class="space-y-2">
                    <a
                      [routerLink]="['/accountGroups', groupId, 'stats']"
                      class="block w-full px-3 py-2 text-xs font-medium text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      <ng-container i18n>Statistik anzeigen</ng-container>
                    </a>
                    <button
                      type="button"
                      (click)="openDeleteDialog()"
                      class="block w-full px-3 py-2 text-xs font-medium text-center text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                      <ng-container i18n>Löschen</ng-container>
                    </button>
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
export class AccountGroupEditComponent implements OnInit, OnDestroy {
  private readonly dataService = inject(AccountGroupEditDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);

  readonly editService = inject(AccountGroupEditService);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadingAccounts = signal(true);
  readonly updatingOperation = signal(false);
  readonly group = signal<AccountGroupDetails | null>(null);
  readonly auditLog = signal<AuditLogHistoryEntry[]>([]);
  readonly historyResource = signal('');

  readonly historyEntityLabel = $localize`die Kontengruppe`;

  readonly breadcrumbs = signal<BreadcrumbItem[]>([
    { label: $localize`Kontengruppen`, path: '' },
    { label: $localize`Laden...` },
  ]);

  readonly groupForm: FormGroup;

  groupId = '';
  private orgId = '';

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
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.groupId = id;
      this.historyResource.set(`organizations/${this.orgId}/accountGroups/${this.groupId}`);
      this.loadGroup(id);
      this.loadAccountsWithOperations(id);
      this.loadAuditLog();
      this.setupAutoSave();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAuditLog(): void {
    this.dataService.getAuditLog(this.orgId, this.groupId).subscribe({
      next: (entries) => this.auditLog.set(entries),
      // Missing audit-log permission or transient errors: show an empty history.
      error: () => this.auditLog.set([]),
    });
  }

  /**
   * Dense labels for assignment audit entries: instead of the raw field diff
   * (custom_id, UUIDs, negate) each entry becomes a single line naming the
   * account and the operation it was set to. Recomputes when the audit log
   * or the account list changes. Entries without a resolvable label fall
   * back to the default rendering.
   */
  readonly assignmentEntryLabels = computed<Record<string, string>>(() =>
    this.describeAssignmentEntries(this.auditLog(), this.editService.rows()),
  );

  /**
   * Forces every assignment audit entry to render with the edit (UPDATE)
   * icon regardless of its underlying action, since assignments are only
   * ever toggled between operations.
   */
  readonly assignmentEntryActions = computed<Record<string, 'UPDATE'>>(() => {
    const actions: Record<string, 'UPDATE'> = {};
    for (const entry of this.auditLog()) {
      if (entry.resource.includes('/assignments/')) {
        actions[entry.id] = 'UPDATE';
      }
    }
    return actions;
  });

  private describeAssignmentEntries(
    entries: AuditLogHistoryEntry[],
    rows: AccountGroupRow[],
  ): Record<string, string> {
    const labels: Record<string, string> = {};

    for (const entry of entries) {
      if (!entry.resource.includes('/assignments/')) {
        continue;
      }

      // CREATE/DELETE entries carry the account id in their changes; UPDATE
      // entries only carry the negate change, so resolve the account via the
      // assignment id from the resource name.
      let accountId: string | undefined;
      for (const change of entry.changes) {
        if (change.field === 'account_id') {
          accountId = (entry.action === 'DELETE' ? change.oldValue : change.newValue) ?? accountId;
        }
      }
      if (!accountId) {
        const assignmentId = entry.resource.split('/').pop();
        accountId = rows.find((row) => row.assignmentId === assignmentId)?.accountId;
      }
      const row = rows.find((r) => r.accountId === accountId);
      if (!row) {
        continue;
      }

      const account = `${row.displayCode} — ${row.displayName}`;
      if (entry.action === 'DELETE') {
        labels[entry.id] = $localize`hat ${account}:account: ignoriert`;
        continue;
      }
      const negateChange = entry.changes.find((change) => change.field === 'negate');
      const negate = negateChange ? negateChange.newValue === 'true' : row.operation === 'S';
      labels[entry.id] = negate
        ? $localize`hat ${account}:account: subtrahiert`
        : $localize`hat ${account}:account: addiert`;
    }

    return labels;
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

  private loadGroup(id: string): void {
    this.dataService.getGroup(this.orgId, id).subscribe({
      next: (group) => {
        this.group.set(group);
        this.groupForm.patchValue({
          name: group.name,
          description: group.description,
        }, { emitEvent: false });
        this.groupForm.markAsPristine();
        this.breadcrumbs.set([
          { label: $localize`Kontengruppen`, path: `/organizations/${this.orgId}/accountGroups` },
          { label: group.name },
        ]);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Kontengruppe`);
        this.router.navigate(['/organizations', this.orgId, 'accountGroups']);
      },
    });
  }

  private loadAccountsWithOperations(id: string): void {
    this.loadingAccounts.set(true);
    this.dataService.getAllAccountsWithOperations(this.orgId, id).subscribe({
      next: (accounts) => {
        this.editService.setAccountsWithOperations(accounts);
        this.loadingAccounts.set(false);
      },
      error: () => {
        this.loadingAccounts.set(false);
        this.notifications.error($localize`Fehler beim Laden der Konten`);
      },
    });
  }

  onOperationChange(row: AccountGroupRow, operation: AccountGroupOperation): void {
    if (this.updatingOperation()) return;

    this.updatingOperation.set(true);
    this.dataService
      .updateAccountOperation(this.orgId, this.groupId, row.accountId, operation, row.assignmentId)
      .subscribe({
        next: (assignmentId) => {
          this.updatingOperation.set(false);
          // Apply the persisted state locally instead of reloading the whole list.
          this.editService.applyOperation(row.accountId, operation, assignmentId);
          this.loadAuditLog();
        },
        error: () => {
          this.updatingOperation.set(false);
          this.notifications.error($localize`Fehler beim Aktualisieren der Operation`);
          // Re-sync with the persisted state (also reverts the clicked radio).
          this.loadAccountsWithOperations(this.groupId);
        },
      });
  }

  private saveGroup(): void {
    if (this.groupForm.invalid) return;

    this.saving.set(true);
    const { name, description } = this.groupForm.value;

    this.dataService.updateGroup(this.orgId, this.groupId, name, description).subscribe({
      next: () => {
        this.saving.set(false);
        this.groupForm.markAsPristine();
        this.loadAuditLog();
        // Update breadcrumbs with new name
        this.breadcrumbs.set([
          { label: $localize`Kontengruppen`, path: `/organizations/${this.orgId}/accountGroups` },
          { label: name },
        ]);
      },
      error: () => {
        this.saving.set(false);
        this.notifications.error($localize`Fehler beim Speichern der Kontengruppe`);
      },
    });
  }

  openDeleteDialog(): void {
    const group = this.group();
    if (!group) return;

    const dialogRef = this.dialog.open<DeleteAccountGroupDialogOutput, DeleteAccountGroupDialogInput>(
      DeleteAccountGroupDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: {
          groupId: this.groupId,
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
        this.router.navigate(['/organizations', this.orgId, 'accountGroups']);
      }
    });
  }

}
