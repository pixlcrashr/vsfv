import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AssistantInfoBoxComponent } from './assistant-info-box.component';
import { ReceiptCategory } from './assistant.types';

export type ReceiptStepSection = 'category' | 'form' | 'amount' | 'extras';

/**
 * One question about a single receipt. The parent renders it once per
 * receipt step (category/form/amount/extras) and passes the receipt's
 * FormGroup from the invoiceItems FormArray so all bindings stay inside
 * the parent's single wizard form.
 */
@Component({
  selector: 'app-assistant-receipt-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AssistantInfoBoxComponent],
  template: `
    <span class="mb-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-gray-700 dark:text-slate-300" i18n>
      Beleg {{ receiptNumber() }} von {{ receiptCount() }}
    </span>

    @switch (section()) {
      @case ('category') {
        <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
          Was für ein Beleg ist es?
        </h2>

        <app-assistant-info-box>
          <li i18n>
            Stehen Anbieter, Adresse, Leistungen und ausgewiesene MwSt. auf dem Dokument, ist es eine
            „Rechnung“ - z. B. die PDF-Rechnung vom Copyshop per E-Mail.
          </li>
          <li i18n>
            Nur ein Kassenstreifen ohne weitere Angaben? Dann ist es eine „Quittung / Kassenbon“,
            z. B. vom Supermarkt oder Baumarkt.
          </li>
          <li i18n>
            Gibt es überhaupt keinen Fremdbeleg, kannst du einen „Eigenbeleg“ schreiben,
            z. B. für Portokosten.
          </li>
        </app-assistant-info-box>

        <div [formGroup]="itemGroup()" class="mt-5 space-y-3">
          @for (choice of receiptCategoryChoices; track choice.value) {
            <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <input
                type="radio"
                formControlName="receiptCategory"
                [value]="choice.value"
                class="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ choice.label }}</span>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ choice.example }}</p>
              </div>
            </label>
          }
        </div>

        @if (showError('receiptCategory')) {
          <p class="mt-3 text-xs font-medium text-red-600 dark:text-red-400" i18n>
            Bitte wähle aus, was für ein Beleg es ist.
          </p>
        }
      }

      @case ('form') {
        <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
          Liegt der Beleg als Papier-Original oder originär digital vor?
        </h2>

        <app-assistant-info-box>
          <li i18n>
            Papierbeleg (Original): Du hast den Beleg physisch in der Hand, z. B. einen Kassenbon
            oder eine ausgedruckte Rechnung aus dem Geschäft.
          </li>
          <li i18n>
            Originär digital: Der Beleg wurde von Anfang an digital ausgestellt, z. B. eine
            E-Rechnung als PDF-Anhang oder ein Online-Ticket.
          </li>
        </app-assistant-info-box>

        <div [formGroup]="itemGroup()" class="mt-5 space-y-3">
          <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <input
              type="radio"
              formControlName="documentForm"
              value="paper_original"
              class="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Papierbeleg (Original)</span>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                Der Beleg liegt in ausgedruckter Form vor.
              </p>
            </div>
          </label>

          <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <input
              type="radio"
              formControlName="documentForm"
              value="digital_original"
              class="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Originär digital (E-Rechnung, PDF, usw.)</span>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                Der Beleg wurde digital ausgestellt und liegt z. B. als PDF vor.
              </p>
            </div>
          </label>
        </div>

        @if (isPaper()) {
          <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-200">
            <p i18n>
              Hinweis: Eine hochgeladene Scan-Kopie gilt nur als Kopie. Für die Auszahlung muss der
              Papierbeleg im Original eingereicht werden.
            </p>
          </div>
        }
      }

      @case ('amount') {
        <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
          Wie hoch ist der zu erstattende Betrag?
        </h2>

        <app-assistant-info-box>
          <li i18n>
            Gib den Betrag in Euro ein, den wir erstatten sollen, z. B. „12,50“ für einen Kassenbon
            über 12,50 €.
          </li>
          <li i18n>
            Bei Rechnungen mit privaten Anteilen: gib nur den Anteil an, der von uns getragen werden soll - inklusive MwSt.
          </li>
        </app-assistant-info-box>

        <div [formGroup]="itemGroup()" class="mt-5">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Betrag (EUR) *</label>
          <input
            type="number"
            formControlName="amount"
            step="0.01"
            min="0"
            i18n-placeholder
            placeholder="z. B. 12,50"
            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          @if (showError('amount')) {
            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>
              Bitte gib einen Betrag größer als 0,00 € ein.
            </p>
          }
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400" i18n>
            Maximal der Belegbetrag - der Betrag darf niedriger sein, wenn private Anteile
            abgezogen werden.
          </p>
        </div>

        @if (commercialLimitWarning()) {
          <div class="mt-4 rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-200">
            <p i18n>
              Bei gewerblicher Einreichung akzeptieren wir Kassenbons nur bis 250,00 €. Reiche in
              diesem Fall bitte eine Rechnung ein, sonst kann der Betrag nicht erstattet werden.
            </p>
          </div>
        }
      }

      @case ('extras') {
        <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
          Möchtest du den Beleg hochladen oder etwas dazu notieren? (optional)
        </h2>

        <app-assistant-info-box>
          <li i18n>
            Ein Foto oder Scan hilft uns bei der Prüfung und beschleunigt die Bearbeitung, z. B. ein
            Handyfoto vom Kassenbon (PDF, JPG, PNG; max. 10 MB).
          </li>
          <li i18n>
            Eine Anmerkung ist sinnvoll, wenn wir etwas wissen sollten, z. B. „nur die Hälfte des
            Betrags betrifft das Gremium“.
          </li>
        </app-assistant-info-box>

        <div [formGroup]="itemGroup()" class="mt-5 space-y-4">
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Anhang</label>
              <span class="text-xs text-gray-500 dark:text-gray-400" i18n>Max. 1 Datei</span>
            </div>

            <input
              #attachmentInput
              type="file"
              class="sr-only"
              accept=".pdf,.jpg,.jpeg,.png"
              (change)="onAttachmentSelected($event)"
            />

            @if (attachmentName(); as attachmentName) {
              <div class="flex items-center justify-between gap-3 rounded-md border border-gray-300 p-3 dark:border-gray-600">
                <div class="min-w-0">
                  <p class="truncate text-sm text-gray-700 dark:text-gray-300">{{ attachmentName }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400" i18n>1 Datei ausgewählt</p>
                </div>

                <button
                  type="button"
                  class="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  (click)="clearAttachment(attachmentInput)"
                >
                  <ng-container i18n>Entfernen</ng-container>
                </button>
              </div>
            } @else {
              <button
                type="button"
                class="block w-full cursor-pointer rounded-md border-2 border-dashed border-gray-300 p-4 text-center transition-colors hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                (click)="openAttachmentDialog($event, attachmentInput)"
              >
                <p class="text-sm text-gray-600 dark:text-gray-300" i18n>Klicke, um den Beleg hochzuladen</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400" i18n>PDF, JPG, PNG (max. 10 MB)</p>
              </button>
            }
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Anmerkung zu diesem Beleg</label>
            <input
              type="text"
              formControlName="description"
              i18n-placeholder
              placeholder="z. B. Getränke für die Sitzung am 03.05."
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
      }
    }
  `,
})
export class AssistantReceiptStepComponent {
  readonly section = input.required<ReceiptStepSection>();
  readonly itemGroup = input.required<FormGroup>();
  readonly receiptNumber = input.required<number>();
  readonly receiptCount = input.required<number>();
  readonly attachmentName = input<string | null>(null);
  readonly isPaper = input(false);
  readonly commercialLimitWarning = input(false);
  // Bumped by the parent whenever it marks controls as touched, so the
  // OnPush child re-evaluates showError() after a failed "Weiter".
  readonly validationAttempt = input(0);

  readonly receiptCategoryChoices: { value: ReceiptCategory; label: string; example: string }[] = [
    {
      value: 'rechnung',
      label: $localize`Rechnung`,
      example: $localize`Vom Anbieter ausgestellt, mit Leistungen und ausgewiesener MwSt., z. B. die PDF-Rechnung vom Copyshop.`,
    },
    {
      value: 'quittung_kassenbon',
      label: $localize`Quittung / Kassenbon`,
      example: $localize`Kassenstreifen aus dem Geschäft, z. B. vom Supermarkt oder Baumarkt.`,
    },
    {
      value: 'eigenbeleg',
      label: $localize`Eigenbeleg`,
      example: $localize`Selbst geschrieben, wenn es keinen anderen Beleg gibt, z. B. für Portokosten.`,
    },
    {
      value: 'fahrtkostennachweis',
      label: $localize`Fahrtkostennachweis`,
      example: $localize`z. B. DB-Ticket, ausgedrucktes Online-Ticket oder Fahrtenbuch.`,
    },
    {
      value: 'sonstige',
      label: $localize`Sonstige`,
      example: $localize`Alles, was in keine der anderen Kategorien passt, z. B. eine Teilnahmegebühr mit Bestätigung.`,
    },
    {
      value: 'lieferschein',
      label: $localize`Lieferschein`,
      example: $localize`Begleitpapier einer Lieferung; allein nicht als Nachweis ausreichend.`,
    },
    {
      value: 'bestellbestaetigung',
      label: $localize`Bestellbestätigung`,
      example: $localize`z. B. Auftragsbestätigung eines Online-Shops; allein nicht als Nachweis ausreichend.`,
    },
  ];

  showError(controlName: string): boolean {
    void this.validationAttempt();
    const control = this.itemGroup().get(controlName);
    return !!control && control.invalid && control.touched;
  }

  openAttachmentDialog(event: Event, inputElement: HTMLInputElement): void {
    event.preventDefault();
    event.stopPropagation();
    inputElement.click();
  }

  onAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.itemGroup().get('attachment')?.setValue(file);
  }

  clearAttachment(inputElement: HTMLInputElement): void {
    this.itemGroup().get('attachment')?.setValue(null);
    inputElement.value = '';
  }
}
