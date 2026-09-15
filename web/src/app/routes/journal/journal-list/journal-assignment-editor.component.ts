import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { Account } from '../../../shared/models';
import { formatCurrency, naturalCompare } from '../../../shared/utils';
import { NotificationService } from '../../../shared/components';
import {
  JournalAssignmentEditorDataService,
} from './journal-assignment-editor.data-service';
import { JournalAccountAssignment } from './journal-list.data-service';

interface EditableAssignment {
  id: string;
  accountId: string;
  value: string;
}

@Component({
  selector: 'app-journal-assignment-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="space-y-1">
      @if (editableAssignment(); as assignment) {
        <div class="flex items-center gap-1">
          <select
            [ngModel]="assignment.accountId"
            (ngModelChange)="onAccountChange($event)"
            [disabled]="!editable()"
            class="flex-1 min-w-0 px-1 py-0.5 text-[11px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            [class.border-red-300]="!assignment.accountId"
          >
            <option value="" i18n>Konto...</option>
            @for (account of selectableAccounts(); track account.id) {
              <option [value]="account.id">{{ account.code }} {{ account.name }}</option>
            }
          </select>
          <input
            type="text"
            [ngModel]="assignment.value"
            (ngModelChange)="onValueChange($event)"
            [disabled]="!editable()"
            class="w-20 px-1 py-0.5 text-[11px] text-right border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
          @if (editable()) {
            <button
              type="button"
              (click)="removeAssignment()"
              [disabled]="saving()"
              class="px-1 py-0.5 text-[11px] text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
              i18n-title title="Entfernen"
            >✕</button>
          }
        </div>
      } @else {
        <p i18n class="text-[11px] text-gray-400 italic py-1">
          Keine Zuordnung.
        </p>
      }

      @if (editable()) {
        <div class="flex items-center justify-between gap-2 pt-1">
          @if (!editableAssignment()) {
            <button
              type="button"
              (click)="addAssignment()"
              [disabled]="saving()"
              class="px-1.5 py-0.5 text-[11px] font-medium text-green-700 border border-green-200 rounded hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed"
              i18n
            >+ Zuordnen</button>
          } @else {
            <span></span>
          }

          <div class="flex items-center gap-2">
            <span
              class="text-[11px]"
              [class.text-red-500]="assignedPercentage() > 100"
              [class.text-gray-500]="assignedPercentage() <= 100"
            >
              {{ formatAmount(assignedTotal()) }} / {{ formatAmount(transactionAmount()) }}
              ({{ assignedPercentage().toFixed(0) }}%)
            </span>
            @if (hasUnsavedChanges()) {
              <button
                type="button"
                (click)="save()"
                [disabled]="saving()"
                class="px-1.5 py-0.5 text-[11px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ng-container i18n>{{ saving() ? '...' : 'Speichern' }}</ng-container>
              </button>
            }
          </div>
        </div>
      } @else {
        <p i18n class="text-[11px] text-gray-400 italic pt-1">
          Geschäftsjahr ist geschlossen — Zuordnungen können nicht bearbeitet werden.
        </p>
      }
    </div>
  `,
})
export class JournalAssignmentEditorComponent implements OnChanges {
  private readonly dataService = inject(JournalAssignmentEditorDataService);
  private readonly notifications = inject(NotificationService);

  readonly organizationId = input.required<string>();
  readonly transactionId = input.required<string>();
  readonly assignments = input.required<JournalAccountAssignment[]>();
  readonly transactionAmount = input.required<string>();
  readonly editable = input<boolean>(true);
  readonly availableAccounts = input<Account[]>([]);

  readonly assignmentsChanged = output<JournalAccountAssignment[]>();

  private originalAssignment = signal<EditableAssignment | null>(null);
  readonly editableAssignment = signal<EditableAssignment | null>(null);
  readonly saving = signal(false);

  readonly selectableAccounts = computed(() =>
    this.availableAccounts().filter((a) => !a.isContainer).sort((a, b) => naturalCompare(a.code, b.code)),
  );

  readonly assignedTotal = computed(() => {
    const assignment = this.editableAssignment();
    return (assignment ? parseFloat(assignment.value || '0') : 0).toFixed(2);
  });

  readonly assignedPercentage = computed(() => {
    const total = parseFloat(this.transactionAmount());
    if (total <= 0) return 0;
    return (parseFloat(this.assignedTotal()) / total) * 100;
  });

  readonly hasUnsavedChanges = computed(() => {
    const current = this.editableAssignment();
    const original = this.originalAssignment();
    if (current === null && original === null) return false;
    if (current === null || original === null) return true;
    return current.accountId !== original.accountId || current.value !== original.value;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['assignments']) {
      const first = this.assignments()[0];
      const assignment = first
        ? { id: first.id, accountId: first.accountId, value: first.value }
        : null;
      this.editableAssignment.set(assignment ? { ...assignment } : null);
      this.originalAssignment.set(assignment ? { ...assignment } : null);
    }
  }

  onAccountChange(accountId: string): void {
    const current = this.editableAssignment();
    if (!current) return;
    this.editableAssignment.set({ ...current, accountId });
  }

  onValueChange(value: string): void {
    const current = this.editableAssignment();
    if (!current) return;
    this.editableAssignment.set({ ...current, value });
  }

  addAssignment(): void {
    this.editableAssignment.set({
      id: '',
      accountId: '',
      value: this.transactionAmount(),
    });
  }

  removeAssignment(): void {
    this.editableAssignment.set(null);
  }

  save(): void {
    const orgId = this.organizationId();
    const txnId = this.transactionId();
    const current = this.editableAssignment();
    const original = this.originalAssignment();

    const operations: Observable<unknown>[] = [];

    if (original && (!current || !current.accountId)) {
      operations.push(this.dataService.deleteAssignment(orgId, txnId, original.id));
    } else if (current && current.accountId && !original) {
      operations.push(
        this.dataService.createAssignment(orgId, txnId, {
          accountId: current.accountId,
          value: current.value,
        }),
      );
    } else if (
      current &&
      original &&
      current.accountId &&
      (current.accountId !== original.accountId || current.value !== original.value)
    ) {
      operations.push(
        this.dataService.updateAssignment(orgId, txnId, original.id, {
          accountId: current.accountId,
          value: current.value,
        }),
      );
    }

    if (operations.length === 0) {
      return;
    }

    this.saving.set(true);
    forkJoin(operations).subscribe({
      next: () => {
        // Rebuild a snapshot from the edited assignment so the parent can
        // refresh its row without an extra round-trip. Code/name are
        // resolved from the available accounts list.
        const accountsMap = new Map(
          this.selectableAccounts().map((a) => [a.id, a]),
        );
        const latest = this.editableAssignment();
        const snapshot: JournalAccountAssignment[] =
          latest && latest.accountId
            ? [
                {
                  id: latest.id,
                  accountId: latest.accountId,
                  accountCode: accountsMap.get(latest.accountId)?.code ?? '',
                  accountFullCode: accountsMap.get(latest.accountId)?.fullCode ?? '',
                  accountName: accountsMap.get(latest.accountId)?.name ?? '',
                  value: latest.value,
                },
              ]
            : [];
        this.originalAssignment.set(latest ? { ...latest } : null);
        this.assignmentsChanged.emit(snapshot);
        this.saving.set(false);
        this.notifications.success(
          $localize`Zuweisungen erfolgreich gespeichert`,
        );
      },
      error: () => {
        this.notifications.error(
          $localize`Fehler beim Speichern der Zuweisungen`,
        );
        this.saving.set(false);
      },
    });
  }

  formatAmount(value: string): string {
    const num = parseFloat(value);
    return formatCurrency(num);
  }
}
