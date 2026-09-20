import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../components';
import { AddReceiptDialogDataService } from './add-receipt-dialog.data-service';
import { SubmissionItem } from '../../models';

export interface AddReceiptDialogInput {
  organizationId: string;
}

export interface AddReceiptDialogOutput {
  added: boolean;
  submissionItem?: SubmissionItem;
}

@Component({
  selector: 'app-add-receipt-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent],
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 max-w-md">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
        <ng-container i18n>Beleg hinzufügen</ng-container>
      </h2>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="space-y-3">
          <!-- Type Selection -->
          <div>
            <label
              for="type"
              class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              <ng-container i18n>Typ</ng-container>
            </label>
            <select
              id="type"
              formControlName="type"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="receipt" i18n>Kassenbon</option>
              <option value="invoice" i18n>Rechnung</option>
            </select>
          </div>

          <!-- Amount -->
          <div>
            <label
              for="amount"
              class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              <ng-container i18n>Betrag (EUR)</ng-container>
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              formControlName="amount"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0,00"
            />
          </div>

          <!-- Description -->
          <div>
            <label
              for="description"
              class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              <ng-container i18n>Beschreibung (optional)</ng-container>
            </label>
            <textarea
              id="description"
              formControlName="description"
              rows="2"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              i18n-placeholder
              placeholder="Wofür ist dieser Beleg?"
            ></textarea>
          </div>

          <!-- File Upload -->
          <div>
            <label
              class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              <ng-container i18n>Datei</ng-container>
            </label>
            <div
              class="border-2 border-dashed rounded-lg p-4 text-center transition-colors"
              [class]="dragOver()
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
            >
              @if (selectedFile()) {
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="truncate max-w-48">{{ selectedFile()?.name }}</span>
                    <span class="text-gray-500 dark:text-gray-400 text-xs">({{ formatFileSize(selectedFile()?.size ?? 0) }})</span>
                  </div>
                  <button
                    type="button"
                    class="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    (click)="removeFile()"
                    i18n-aria-label
                    aria-label="Datei entfernen"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              } @else {
                <div class="space-y-1">
                  <svg class="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    <label
                      for="file-upload"
                      class="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-500"
                    >
                      <span i18n>Datei auswählen</span>
                      <input
                        id="file-upload"
                        type="file"
                        class="sr-only"
                        accept="image/*,application/pdf"
                        (change)="onFileSelect($event)"
                      />
                    </label>
                    <span i18n> oder hierher ziehen</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400" i18n>
                    PNG, JPG, PDF bis zu 10MB
                  </p>
                </div>
              }
            </div>
            @if (fileError()) {
              <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fileError() }}</p>
            }
          </div>

          <!-- Warning for receipts -->
          @if (hasPaperOriginal()) {
            <div class="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
              <div class="flex">
                <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
                <div class="ml-3">
                  <p class="text-sm text-amber-700 dark:text-amber-300" i18n>
                    Du musst das Original einreichen, damit die Einreichung abgeschlossen werden kann.
                  </p>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <app-button variant="secondary" (clicked)="cancel()">
            <ng-container i18n>Abbrechen</ng-container>
          </app-button>
          <app-button
            type="submit"
            [disabled]="form.invalid || !selectedFile()"
            [loading]="uploading()"
          >
            <ng-container i18n>Hinzufügen</ng-container>
          </app-button>
        </div>
      </form>
    </div>
  `,
})
export class AddReceiptDialogComponent {
  private readonly dialogRef = inject(DialogRef<AddReceiptDialogOutput>);
  private readonly data = inject<AddReceiptDialogInput>(DIALOG_DATA);
  private readonly dataService = inject(AddReceiptDialogDataService);
  private readonly fb = inject(FormBuilder);

  readonly uploading = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly dragOver = signal(false);

  readonly form: FormGroup = this.fb.group({
    category: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    description: [''],
  });

  readonly hasPaperOriginal = computed(() => this.form.get('category')?.value !== '');

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf'];

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndSetFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndSetFile(input.files[0]);
    }
  }

  private validateAndSetFile(file: File): void {
    this.fileError.set(null);

    if (!this.allowedTypes.includes(file.type)) {
      this.fileError.set($localize`Ungültiger Dateityp. Erlaubt sind: PNG, JPG, PDF`);
      return;
    }

    if (file.size > this.maxFileSize) {
      this.fileError.set($localize`Datei ist zu groß. Maximal 10MB erlaubt.`);
      return;
    }

    this.selectedFile.set(file);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  cancel(): void {
    this.dialogRef.close({ added: false });
  }

  submit(): void {
    if (this.form.invalid || !this.selectedFile()) return;

    this.uploading.set(true);
    const { category, amount, description } = this.form.value;

    this.dataService
      .uploadReceipt(this.data.organizationId, {
        category,
        amount: Math.round((amount ?? 0) * 100), // Convert to cents
        description: description || null,
        file: this.selectedFile()!,
      })
      .subscribe({
        next: (submissionItem) => {
          this.uploading.set(false);
          this.dialogRef.close({
            added: true,
            submissionItem,
          });
        },
        error: () => {
          this.uploading.set(false);
          this.fileError.set($localize`Fehler beim Hochladen. Bitte versuche es erneut.`);
        },
      });
  }
}
