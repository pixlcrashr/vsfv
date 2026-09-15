import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, LoadingSpinnerComponent } from '../../components';
import { naturalCompare } from '../../utils/account-sort.utils';
import { AddAccountToGroupDialogDataService } from './add-account-to-group-dialog.data-service';

export interface AvailableAccount {
  id: string;
  code: string;
  name: string;
}

export interface AddAccountToGroupDialogInput {
  organizationId: string;
  groupId: string;
}

export interface AddAccountToGroupDialogOutput {
  added: boolean;
  accountId?: string;
}

@Component({
  selector: 'app-add-account-to-group-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, LoadingSpinnerComponent],
  template: `
    <div class="bg-white rounded-lg shadow-xl p-4">
      <h2 i18n class="text-sm font-semibold text-gray-900 mb-4">
        Konto hinzufügen
      </h2>

      @if (loadingAccounts()) {
        <div class="flex justify-center py-4">
          <app-loading-spinner i18n-text text="Konten werden geladen..." />
        </div>
      } @else {
        <div class="space-y-3">
          <div>
            <label
              for="accountSelect"
              class="block text-xs font-medium text-gray-700 mb-1"
            >
              <ng-container i18n>Konto auswählen</ng-container>
            </label>
            <select
              id="accountSelect"
              [(ngModel)]="selectedAccountId"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option i18n value="">Bitte wählen...</option>
              @for (account of availableAccounts(); track account.id) {
                <option [value]="account.id">
                  {{ account.code }} - {{ account.name }}
                </option>
              }
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <app-button variant="secondary" (clicked)="cancel()">
            <ng-container i18n>Abbrechen</ng-container>
          </app-button>
          <app-button
            [disabled]="!selectedAccountId"
            [loading]="adding()"
            (clicked)="add()"
          >
            <ng-container i18n>Hinzufügen</ng-container>
          </app-button>
        </div>
      }
    </div>
  `,
})
export class AddAccountToGroupDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<AddAccountToGroupDialogOutput>);
  private readonly dataService = inject(AddAccountToGroupDialogDataService);
  readonly data = inject<AddAccountToGroupDialogInput>(DIALOG_DATA);

  readonly loadingAccounts = signal(true);
  readonly adding = signal(false);
  readonly availableAccounts = signal<AvailableAccount[]>([]);

  selectedAccountId = '';

  ngOnInit(): void {
    this.loadAvailableAccounts();
  }

  private loadAvailableAccounts(): void {
    this.dataService.listAvailableAccounts(this.data.organizationId, this.data.groupId).subscribe({
      next: (accounts) => {
        this.availableAccounts.set([...accounts].sort((a, b) => naturalCompare(a.code, b.code)));
        this.loadingAccounts.set(false);
      },
      error: () => {
        this.loadingAccounts.set(false);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close({ added: false });
  }

  add(): void {
    if (!this.selectedAccountId) return;

    this.adding.set(true);

    this.dataService.addAccountToGroup(this.data.organizationId, this.data.groupId, this.selectedAccountId).subscribe({
      next: () => {
        this.adding.set(false);
        this.dialogRef.close({
          added: true,
          accountId: this.selectedAccountId,
        });
      },
      error: () => {
        this.adding.set(false);
      },
    });
  }
}
