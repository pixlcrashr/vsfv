import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  StatusBadgeComponent,
  NotificationService,
} from '../../../shared/components';
import { formatDateShort, formatCurrency } from '../../../shared/utils';
import { Transaction, Account } from '../../../shared/models';
import { TransactionEditDataService } from './transaction-edit.data-service';

@Component({
  selector: 'app-transaction-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Transaktion wird geladen..." />
        } @else if (transaction()) {
          <div class="w-full max-w-4xl space-y-3">
            <!-- Transaction Details Card -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <h2 i18n class="text-sm font-semibold text-gray-900 mb-4">
                Transaktionsdetails
              </h2>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Left Column -->
                <div class="space-y-3">
                  <div>
                    <label i18n class="block text-xs font-medium text-gray-500 mb-1">
                      Belegdatum
                    </label>
                    <p class="text-sm text-gray-900">
                      {{ formatDate(transaction()!.documentDate) }}
                    </p>
                  </div>

                  <div>
                    <label i18n class="block text-xs font-medium text-gray-500 mb-1">
                      Gebucht am
                    </label>
                    <p class="text-sm text-gray-900">
                      {{ formatDate(transaction()!.bookedAt) }}
                    </p>
                  </div>

                  <div>
                    <label i18n class="block text-xs font-medium text-gray-500 mb-1">
                      Betrag
                    </label>
                    <p class="text-xl font-semibold text-gray-900">
                      {{ formatAmount(transaction()!.amount) }}
                    </p>
                  </div>
                </div>

                <!-- Right Column -->
                <div class="space-y-3">
                  <div>
                    <label i18n class="block text-xs font-medium text-gray-500 mb-1">
                      Soll-Konto
                    </label>
                    <p class="text-sm text-gray-900">
                      {{ transaction()!.debitAccountCode }} {{ transaction()!.debitAccountName }}
                    </p>
                  </div>

                  <div>
                    <label i18n class="block text-xs font-medium text-gray-500 mb-1">
                      Haben-Konto
                    </label>
                    <p class="text-sm text-gray-900">
                      {{ transaction()!.creditAccountCode }} {{ transaction()!.creditAccountName }}
                    </p>
                  </div>

                  <div>
                    <label i18n class="block text-xs font-medium text-gray-500 mb-1">
                      Zuordnungsstatus
                    </label>
                    <app-status-badge size="sm" [variant]="isFullyAssigned() ? 'success' : 'warning'">
                      <ng-container i18n>{{ isFullyAssigned() ? 'Vollständig zugeordnet' : 'Teilweise zugeordnet' }}</ng-container>
                    </app-status-badge>
                  </div>
                </div>
              </div>

              <!-- Description Field -->
              <div class="mt-4">
                <label
                  for="description"
                  class="block text-xs font-medium text-gray-500 mb-1"
                >
                  <ng-container i18n>Beschreibung</ng-container>
                </label>
                <div class="flex gap-2">
                  <input
                    id="description"
                    type="text"
                    [(ngModel)]="description"
                    class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <app-button
                    variant="primary"
                    [disabled]="saving() || description === transaction()!.description"
                    (clicked)="saveDescription()"
                  >
                    <ng-container i18n>{{ saving() ? 'Speichern...' : 'Speichern' }}</ng-container>
                  </app-button>
                </div>
              </div>
            </div>

            <!-- Account Assignments Card -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center justify-between mb-4">
                <h2 i18n class="text-sm font-semibold text-gray-900">
                  Kontenzuordnungen
                </h2>
                <div i18n class="text-xs" [class.text-red-500]="assignmentPercentage() > 100" [class.text-gray-500]="assignmentPercentage() <= 100">
                  {{ formatAmount(assignedTotal()) }} von {{ formatAmount(transaction()!.amount) }} zugeordnet
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="mb-4">
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full transition-all duration-300"
                    [class]="assignmentPercentage() === 100 ? 'bg-green-500' : assignmentPercentage() > 100 ? 'bg-red-500' : 'bg-amber-500'"
                    [style.width.%]="Math.min(assignmentPercentage(), 100)"
                  ></div>
                </div>
                <p i18n class="text-xs text-gray-500 mt-1">
                  {{ assignmentPercentage().toFixed(1) }}% zugeordnet
                </p>
              </div>

              <!-- Closed ledger notice -->
              @if (transaction()?.isLedgerClosed) {
                <p i18n class="text-xs text-red-500 text-center py-4 mb-4">
                  Geschäftsjahr ist geschlossen — Zuordnungen können nicht bearbeitet werden.
                </p>
              }

              <!-- Assignments -->
              @if (editableAssignments().length > 0) {
                <div class="space-y-2 mb-4">
                  @for (assignment of editableAssignments(); track assignment.id; let i = $index) {
                    <div class="flex items-center gap-2">
                      <select
                        [ngModel]="assignment.accountId"
                        (ngModelChange)="onAssignmentAccountChange(i, $event)"
                        class="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        [class.border-red-300]="!assignment.accountId"
                        [disabled]="transaction()?.isLedgerClosed || assignmentSaving()"
                      >
                        <option value="" i18n>Konto wählen...</option>
                        @for (account of selectableAccounts(); track account.id) {
                          <option [value]="account.id" [disabled]="account.id !== assignment.accountId && usedAccountIds().has(account.id)">
                            {{ account.code }} {{ account.name }}
                          </option>
                        }
                      </select>
                      <input
                        type="text"
                        [ngModel]="assignment.value"
                        (ngModelChange)="onAssignmentValueChange(i, $event)"
                        class="w-32 px-2 py-1 text-sm text-right border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        [disabled]="transaction()?.isLedgerClosed || assignmentSaving()"
                      />
                      <button
                        type="button"
                        (click)="removeAssignment(i)"
                        [disabled]="transaction()?.isLedgerClosed || assignmentSaving()"
                        class="px-1.5 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >✕</button>
                    </div>
                  }
                </div>
              } @else {
                <p i18n class="text-xs text-gray-500 text-center py-4 mb-4">
                  Keine Kontenzuordnungen vorhanden.
                </p>
              }

              <!-- Add Assignment Button -->
              <div class="flex justify-between items-center mb-4">
                @if (canAddAssignments()) {
                  <button
                    type="button"
                    (click)="addAssignment()"
                    [disabled]="assignmentSaving()"
                    class="px-2 py-1 text-xs font-medium text-green-700 border border-green-200 rounded hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    i18n
                  >+ Zuweisung hinzufügen</button>
                } @else {
                  <span></span>
                }
                @if (hasUnsavedChanges()) {
                  <app-button
                    variant="primary"
                    [loading]="assignmentSaving()"
                    (clicked)="saveAssignments()"
                  >
                    <ng-container i18n>Zuweisungen speichern</ng-container>
                  </app-button>
                }
              </div>
            </div>

            <!-- Metadata -->
            <div i18n class="text-xs text-gray-500">
              Zuletzt aktualisiert: {{ formatDate(transaction()!.updatedAt) }}
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class TransactionEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(TransactionEditDataService);
  private readonly notifications = inject(NotificationService);

  private orgId = '';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly assignmentSaving = signal(false);
  readonly transaction = signal<Transaction | null>(null);
  readonly availableAccounts = signal<Account[]>([]);

  readonly selectableAccounts = computed(() =>
    this.availableAccounts().filter(a => !a.isContainer)
  );
  readonly usedAccountIds = computed(() =>
    new Set(this.editableAssignments().map(a => a.accountId).filter(Boolean))
  );

  description = '';

  private originalAssignments = signal<ReadonlyArray<{id: string; accountId: string; value: string}>>([]);
  readonly editableAssignments = signal<Array<{id: string; accountId: string; value: string}>>([]);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Journal`, path: '' },
    { label: $localize`Transaktion bearbeiten` },
  ];

  readonly Math = Math;

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  readonly assignedTotal = computed(() => {
    const total = this.editableAssignments().reduce(
      (sum, a) => sum + parseFloat(a.value || '0'),
      0,
    );
    return total.toFixed(2);
  });

  readonly assignmentPercentage = computed(() => {
    const tx = this.transaction();
    if (!tx) return 0;
    const total = parseFloat(tx.amount);
    const assigned = parseFloat(this.assignedTotal());
    return total > 0 ? (assigned / total) * 100 : 0;
  });

  readonly isFullyAssigned = computed(() => {
    return Math.abs(this.assignmentPercentage() - 100) < 0.01;
  });

  readonly canAddAssignments = computed(() => {
    const tx = this.transaction();
    if (!tx) return false;
    return !tx.isLedgerClosed && this.usedAccountIds().size < this.selectableAccounts().length;
  });

  readonly hasUnsavedChanges = computed(() => {
    const current = this.editableAssignments();
    const original = this.originalAssignments();
    if (current.length !== original.length) return true;
    if (current.some(c => c.id === '')) return true;
    for (const orig of original) {
      const curr = current.find(c => c.id === orig.id);
      if (!curr) return true;
      if (curr.accountId !== orig.accountId || curr.value !== orig.value) return true;
    }
    return false;
  });

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    this.breadcrumbs[0].path = `/organizations/${this.orgId}/journal`;
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTransaction(id);
      this.loadAccounts();
    }
  }

  private loadAccounts(): void {
    this.dataService.listAvailableAccounts(this.orgId).subscribe({
      next: (accounts) => this.availableAccounts.set(accounts),
    });
  }

  private loadTransaction(id: string): void {
    this.dataService.getTransaction(this.orgId, id).subscribe({
      next: (transaction) => {
        this.transaction.set(transaction);
        this.description = transaction.description;
        const assignments = transaction.accountAssignments.map(a => ({
          id: a.id,
          accountId: a.accountId,
          value: a.value,
        }));
        this.editableAssignments.set(assignments.map(a => ({ ...a })));
        this.originalAssignments.set(assignments);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Buchung`);
        this.loading.set(false);
      },
    });
  }

  saveDescription(): void {
    const tx = this.transaction();
    if (!tx) return;

    this.saving.set(true);
    this.dataService.updateTransaction(this.orgId, tx.id, this.description).subscribe({
      next: (updated) => {
        this.transaction.set(updated);
        this.saving.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern der Buchung`);
        this.saving.set(false);
      },
    });
  }

  onAssignmentAccountChange(index: number, accountId: string): void {
    const assignments = this.editableAssignments();
    assignments[index] = { ...assignments[index], accountId };
    this.editableAssignments.set([...assignments]);
  }

  onAssignmentValueChange(index: number, value: string): void {
    const assignments = this.editableAssignments();
    assignments[index] = { ...assignments[index], value };
    this.editableAssignments.set([...assignments]);
  }

  addAssignment(): void {
    const tx = this.transaction();
    if (!tx) return;
    const remaining = parseFloat(tx.amount) - parseFloat(this.assignedTotal());
    const value = Math.max(0, remaining).toFixed(2);
    this.editableAssignments.update(arr => [
      ...arr,
      { id: '', accountId: '', value },
    ]);
  }

  removeAssignment(index: number): void {
    this.editableAssignments.update(arr => arr.filter((_, i) => i !== index));
  }

  saveAssignments(): void {
    const tx = this.transaction();
    if (!tx) return;

    this.assignmentSaving.set(true);
    const current = this.editableAssignments();
    const original = this.originalAssignments();

    const toDelete: string[] = [];
    for (const orig of original) {
      if (!current.find(c => c.id === orig.id)) {
        toDelete.push(orig.id);
      }
    }

    const toCreate: Array<{accountId: string; value: string}> = [];
    const toUpdate: Array<{id: string; accountId: string; value: string}> = [];
    for (const curr of current) {
      if (!curr.accountId) continue;
      if (!curr.id) {
        toCreate.push({ accountId: curr.accountId, value: curr.value });
      } else {
        const orig = original.find(o => o.id === curr.id);
        if (orig && (orig.accountId !== curr.accountId || orig.value !== curr.value)) {
          toUpdate.push({ id: curr.id, accountId: curr.accountId, value: curr.value });
        }
      }
    }

    const operations: Observable<unknown>[] = [];
    for (const id of toDelete) {
      operations.push(this.dataService.deleteAssignment(this.orgId, tx.id, id));
    }
    for (const c of toCreate) {
      operations.push(this.dataService.createAssignment(this.orgId, tx.id, c));
    }
    for (const u of toUpdate) {
      operations.push(this.dataService.updateAssignment(this.orgId, tx.id, u.id, u));
    }

    if (operations.length === 0) {
      this.assignmentSaving.set(false);
      return;
    }

    forkJoin(operations).subscribe({
      next: () => {
        this.loadTransaction(tx.id);
        this.assignmentSaving.set(false);
        this.notifications.success($localize`Zuweisungen erfolgreich gespeichert`);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern der Zuweisungen`);
        this.assignmentSaving.set(false);
      },
    });
  }

  formatDate(date: Date): string {
    return formatDateShort(date);
  }

  formatAmount(value: string): string {
    const num = parseFloat(value);
    return formatCurrency(num);
  }
}
