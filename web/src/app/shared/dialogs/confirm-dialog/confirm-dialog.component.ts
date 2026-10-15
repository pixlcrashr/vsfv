import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '../../components';

export interface ConfirmDialogInput {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmDialogOutput {
  confirmed: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <div class="bg-white rounded-lg shadow-xl p-4">
      <h2 class="text-sm font-semibold text-gray-900 mb-2">
        {{ data.title }}
      </h2>
      <p class="text-xs text-gray-600 mb-4">
        {{ data.message }}
      </p>

      <div class="flex justify-end gap-2">
        <app-button variant="secondary" (clicked)="cancel()">
          {{ data.cancelLabel || cancelLabel }}
        </app-button>
        <app-button
          [variant]="confirmVariant"
          (clicked)="confirm()"
        >
          {{ data.confirmLabel || confirmLabel }}
        </app-button>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(DialogRef<ConfirmDialogOutput>);
  readonly data = inject<ConfirmDialogInput>(DIALOG_DATA);

  readonly confirmVariant = 'primary';

  readonly cancelLabel = $localize`Abbrechen`;
  readonly confirmLabel = $localize`Bestätigen`;

  cancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  confirm(): void {
    this.dialogRef.close({ confirmed: true });
  }
}
