import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import { naturalCompare } from '../../../shared/utils';
import {
  JournalImportDataService,
  ImportTransaction,
  AccountOption,
  AccountAssignment,
  JournalImportType,
} from './journal-import.data-service';
import { CurrencyInputComponent } from './currency-input/currency-input.component';

interface TransactionRow {
  transaction: ImportTransaction;
  assignments: AccountAssignment[];
  importing: boolean;
  imported: boolean;
  ignored: boolean;
}

@Component({
  selector: 'app-journal-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
    CurrencyInputComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Wird geladen..." />
        } @else {
          <div class="mx-auto w-full max-w-7xl space-y-3">
            @if (!transactions()) {
              <!-- Upload Form -->
              <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h2 i18n class="text-sm font-semibold text-gray-900 mb-4">
                  Buchungen importieren
                </h2>

                <div class="space-y-3">
                  <div>
                    <label
                      for="type"
                      class="block text-xs font-medium text-gray-700 mb-1"
                    >
                      <ng-container i18n>Importtyp</ng-container>
                    </label>
                    <select
                      id="type"
                      [(ngModel)]="selectedType"
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option i18n value="">Bitte wählen...</option>
                      <option i18n value="lexware">Lexware Buchhaltung</option>
                      <option i18n value="datev">DATEV Buchungsstapel</option>
                    </select>
                    @if (selectedType === 'lexware') {
                      <p i18n class="mt-1 text-xs text-gray-500">
                        Das Lexware Journal muss als CSV mit Trennzeichen ";" exportiert sein.
                      </p>
                    }
                    @if (selectedType === 'datev') {
                      <p i18n class="mt-1 text-xs text-gray-500">
                        Der DATEV Buchungsstapel muss als CSV im Standardformat vorliegen.
                      </p>
                    }
                  </div>

                  @if (selectedType) {
                    <div>
                      <label
                        for="file"
                        class="block text-xs font-medium text-gray-700 mb-1"
                      >
                        <ng-container i18n>CSV-Datei</ng-container>
                      </label>
                      <input
                        id="file"
                        type="file"
                        accept=".csv"
                        (change)="onFileSelected($event)"
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
                      />
                    </div>

                    @if (selectedFile()) {
                      <p i18n class="text-xs text-gray-500">
                        Ausgewählte Datei: {{ selectedFile()!.name }}
                      </p>
                    }
                  }
                </div>

                <div class="flex justify-end gap-2 mt-4">
                  <app-button
                    [disabled]="!canUpload()"
                    [loading]="uploading()"
                    (clicked)="uploadFile()"
                  >
                    <ng-container i18n>Hochladen</ng-container>
                  </app-button>
                </div>
              </div>

              <!-- Help Text -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 i18n class="text-xs font-medium text-blue-800 mb-2">Hinweise zum Import</h3>
                <ul class="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li i18n>Die CSV-Datei muss im Format der ausgewählten Importquelle vorliegen</li>
                  <li i18n>Bereits importierte Buchungen werden automatisch erkannt und übersprungen</li>
                  <li i18n>Der Import kann nicht rückgängig gemacht werden</li>
                </ul>
              </div>
            } @else {
              <!-- Transaction Review Table -->
              @if (closedYearsCount() > 0) {
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p i18n class="text-xs text-yellow-800">
                    {{ closedYearsCount() }} Buchungen wurden ausgelassen, da die zugehörige Importperiode geschlossen ist.
                  </p>
                </div>
              }

              @if (pendingRows().length === 0) {
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <p i18n class="text-sm text-gray-600">Es wurden keine Transaktionen gefunden.</p>
                  <div class="mt-4">
                    <app-button (clicked)="resetImport()"><ng-container i18n>Neuer Import</ng-container></app-button>
                  </div>
                </div>
              } @else {
                <div class="flex items-center justify-between mb-2">
                  <p class="text-xs text-gray-500">
                    <ng-container i18n>{{ pendingRows().length }} Transaktionen zum Importieren</ng-container>
                  </p>
                  <app-button (clicked)="resetImport()"><ng-container i18n>Neuer Import</ng-container></app-button>
                </div>

                <div class="bg-white rounded-lg border border-gray-200">
                  <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th scope="col" class="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Datum</ng-container>
                        </th>
                        <th scope="col" class="px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Betrag</ng-container>
                        </th>
                        <th scope="col" class="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Sollkonto</ng-container>
                        </th>
                        <th scope="col" class="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Habenkonto</ng-container>
                        </th>
                        <th scope="col" class="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Buchungstext</ng-container>
                        </th>
                        <th scope="col" class="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Referenz</ng-container>
                        </th>
                        <th scope="col" class="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          <ng-container i18n>Haushaltskonto-Zuweisungen</ng-container>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                      @for (row of pendingRows(); track row.transaction.customId) {
                        <tr class="align-top hover:bg-gray-50 transition-colors">
                          <td class="px-2.5 py-1.5 text-xs text-gray-900 whitespace-nowrap">{{ row.transaction.bookedAt }}</td>
                          <td class="px-2.5 py-1.5 text-xs text-gray-900 text-right whitespace-nowrap">{{ formatCurrency(row.transaction.amount) }}</td>
                          <td class="px-2.5 py-1.5 text-xs text-gray-900 whitespace-nowrap">
                            {{ row.transaction.debitAccount }}
                            @if (row.transaction.debitAccountName) {
                              <span class="text-gray-400"> ({{ row.transaction.debitAccountName }})</span>
                            }
                          </td>
                          <td class="px-2.5 py-1.5 text-xs text-gray-900 whitespace-nowrap">
                            {{ row.transaction.creditAccount }}
                            @if (row.transaction.creditAccountName) {
                              <span class="text-gray-400"> ({{ row.transaction.creditAccountName }})</span>
                            }
                          </td>
                          <td class="px-2.5 py-1.5 text-xs text-gray-900">
                            <div class="max-w-[200px] truncate" [title]="row.transaction.description">
                              {{ row.transaction.description }}
                            </div>
                          </td>
                          <td class="px-2.5 py-1.5 text-xs text-gray-900 whitespace-nowrap">{{ row.transaction.reference }}</td>
                          <td class="px-2.5 py-1.5 text-xs text-gray-900 min-w-[280px]">
                            <!-- Account Assignments -->
                            <div class="space-y-1">
                              @for (assignment of row.assignments; track $index; let i = $index) {
                                <div class="flex gap-1 items-center">
                                  <select
                                    [ngModel]="assignment.accountId"
                                    (ngModelChange)="onAssignmentAccountChange(row, i, $event)"
                                    class="flex-1 px-1.5 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    [class.border-red-300]="!assignment.accountId"
                                  >
                                    <option i18n value="">Konto wählen...</option>
                                    @for (account of activeAccounts(); track account.id) {
                                      <option [value]="account.id">{{ account.name }}</option>
                                    }
                                  </select>
                                  <app-currency-input
                                    [(value)]="assignment.value"
                                  />
                                  <button
                                    type="button"
                                    (click)="removeAssignment(row, i)"
                                    [disabled]="row.assignments.length <= 1"
                                    class="px-1.5 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >✕</button>
                                </div>
                              }
                              <button
                                type="button"
                                (click)="addAssignment(row)"
                                class="w-full px-1.5 py-1 text-xs text-green-700 border border-green-200 rounded hover:bg-green-50"
                                i18n
                              >+ Zuweisung hinzufügen</button>

                              <!-- Assignment summary -->
                              <div class="text-right text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                                <span>{{ getAssignedTotal(row) }}</span>
                                <span> - {{ row.transaction.amount }}</span>
                                <span
                                  [class.text-green-600]="isRowValid(row)"
                                  [class.text-red-500]="!isRowValid(row)"
                                > = {{ getAssignmentDiff(row) }}</span>
                              </div>
                            </div>

                            <!-- Import / Ignore buttons -->
                            <div class="flex justify-end gap-1 mt-2">
                              <button
                                type="button"
                                (click)="ignoreTransaction(row)"
                                class="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                                i18n
                              >Ignorieren</button>
                              <app-button
                                [disabled]="!isRowValid(row) || row.importing"
                                [loading]="row.importing"
                                (clicked)="importSingleTransaction(row)"
                              >
                                <ng-container i18n>Importieren</ng-container>
                              </app-button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class JournalImportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(JournalImportDataService);
  private readonly notifications = inject(NotificationService);

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly accounts = signal<AccountOption[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly transactions = signal<TransactionRow[] | null>(null);
  readonly closedYearsCount = signal(0);

  readonly activeAccounts = computed(() =>
    this.accounts().filter(a => !a.isArchived).sort((a, b) => naturalCompare(a.name, b.name))
  );

  readonly pendingRows = computed(() =>
    (this.transactions() ?? []).filter(r => !r.imported && !r.ignored)
  );

  selectedType: '' | JournalImportType = '';

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Journal`, path: '' },
    { label: $localize`Import` },
  ];

  private orgId = '';

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    this.breadcrumbs[0].path = `/organizations/${this.orgId}/journal`;
    this.loading.set(false);
    this.loadAccounts();
  }

  private loadAccounts(): void {
    this.dataService.getAvailableAccounts(this.orgId).subscribe({
      next: (accounts) => this.accounts.set(accounts),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
    }
  }

  canUpload(): boolean {
    return !!this.selectedType && !!this.selectedFile();
  }

  uploadFile(): void {
    if (!this.canUpload()) return;

    this.uploading.set(true);

    this.dataService.uploadFile(
      this.orgId,
      this.selectedType as JournalImportType,
      this.selectedFile()!,
    ).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.closedYearsCount.set(result.closedYearsCount);
        this.transactions.set(
          result.transactions.map(t => ({
            transaction: t,
            assignments: [{ accountId: '', value: t.amount }],
            importing: false,
            imported: false,
            ignored: false,
          }))
        );
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Hochladen der Datei`);
        this.uploading.set(false);
      },
    });
  }

  onAssignmentAccountChange(row: TransactionRow, index: number, value: string): void {
    row.assignments[index] = { ...row.assignments[index], accountId: value };
  }

  addAssignment(row: TransactionRow): void {
    const remaining = this.getRemainingAmount(row);
    row.assignments = [...row.assignments, { accountId: '', value: remaining.toFixed(2) }];
  }

  removeAssignment(row: TransactionRow, index: number): void {
    row.assignments = row.assignments.filter((_, i) => i !== index);
  }

  isRowValid(row: TransactionRow): boolean {
    const hasUnassigned = row.assignments.some(a => !a.accountId);
    if (hasUnassigned) return false;
    const diff = Math.abs(this.parseAmount(this.getAssignedTotal(row)) - this.parseAmount(row.transaction.amount));
    return diff < 0.01;
  }

  getAssignedTotal(row: TransactionRow): string {
    const total = row.assignments.reduce((sum, a) => sum + this.parseAmount(a.value), 0);
    return total.toFixed(2);
  }

  getAssignmentDiff(row: TransactionRow): string {
    const diff = this.parseAmount(this.getAssignedTotal(row)) - this.parseAmount(row.transaction.amount);
    return diff.toFixed(2);
  }

  formatCurrency(value: string): string {
    const num = this.parseAmount(value);
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num);
  }

  importSingleTransaction(row: TransactionRow): void {
    if (!this.isRowValid(row) || row.importing) return;

    row.importing = true;

    this.dataService.importTransaction(this.orgId, {
      receiptFrom: row.transaction.receiptFrom,
      bookedAt: row.transaction.bookedAt,
      amount: row.transaction.amount,
      description: row.transaction.description,
      reference: row.transaction.reference,
      debitAccount: row.transaction.debitAccount,
      creditAccount: row.transaction.creditAccount,
      accountAssignments: row.assignments,
    }).subscribe({
      next: (result) => {
        row.importing = false;
        if (result.success) {
          row.imported = true;
          this.transactions.update(rows => rows ? [...rows] : null);
        } else {
          this.notifications.error($localize`Fehler beim Importieren der Buchung`);
        }
      },
      error: () => {
        row.importing = false;
        this.notifications.error($localize`Fehler beim Importieren der Buchung`);
      },
    });
  }

  ignoreTransaction(row: TransactionRow): void {
    row.ignored = true;
    this.transactions.update(rows => rows ? [...rows] : null);
  }

  resetImport(): void {
    this.transactions.set(null);
    this.selectedFile.set(null);
    this.selectedType = '';
    this.closedYearsCount.set(0);
  }

  private getRemainingAmount(row: TransactionRow): number {
    const total = this.parseAmount(row.transaction.amount);
    const assigned = row.assignments.reduce((sum, a) => sum + this.parseAmount(a.value), 0);
    return Math.max(0, total - assigned);
  }

  private parseAmount(value: string): number {
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
}
