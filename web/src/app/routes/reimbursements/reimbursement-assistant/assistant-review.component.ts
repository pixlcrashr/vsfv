import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../../../shared/components';
import { formatCurrency } from '../../../shared/models';
import {
  BankDetailsSnapshot,
  ReceiptSnapshot,
  StepId,
  getDocumentFormLabel,
  getReceiptCategoryLabel,
} from './assistant.types';

/**
 * "Stimmt alles so?" summary step. Pure display over the wizard's derived
 * state; all mutations (jump to a step, edit/remove/add a receipt) are
 * delegated to the parent via outputs.
 */
@Component({
  selector: 'app-assistant-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>Stimmt alles so?</h2>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-300" i18n>
      Prüfe deine Angaben kurz, bevor du absendest. Mit „Ändern“ kannst du zu jeder Frage
      zurückspringen.
    </p>

    <dl class="mt-5 divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
      <div class="flex items-start justify-between gap-4 p-4">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" i18n>Kostenerstattungsart</dt>
          <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ scopeLabel() }}</dd>
        </div>
        <app-button variant="ghost" size="sm" (clicked)="editStep.emit('scope')">
          <ng-container i18n>Ändern</ng-container>
        </app-button>
      </div>

      <div class="flex items-start justify-between gap-4 p-4">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" i18n>Gremium</dt>
          <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ committeeName() || '—' }}</dd>
        </div>
        <app-button variant="ghost" size="sm" (clicked)="editStep.emit('committee')">
          <ng-container i18n>Ändern</ng-container>
        </app-button>
      </div>

      <div class="flex items-start justify-between gap-4 p-4">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" i18n>Zahlungsart</dt>
          <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ paymentMethodLabel() }}</dd>
        </div>
        <app-button variant="ghost" size="sm" (clicked)="editStep.emit('payment')">
          <ng-container i18n>Ändern</ng-container>
        </app-button>
      </div>

      @if (requiresBankDetails()) {
        <div class="flex items-start justify-between gap-4 p-4">
          <div>
            <dt class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" i18n>Bankverbindung</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {{ bank().accountHolder }} · {{ bank().iban }}
              @if (bank().bic) {
                <span> · {{ bank().bic }}</span>
              }
            </dd>
          </div>
          <app-button variant="ghost" size="sm" (clicked)="editStep.emit('bankDetails')">
            <ng-container i18n>Ändern</ng-container>
          </app-button>
        </div>
      }

      <div class="flex items-start justify-between gap-4 p-4">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" i18n>Anmerkung</dt>
          <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
            @if (notice().trim()) {
              {{ notice() }}
            } @else {
              <span class="text-gray-400 dark:text-gray-500" i18n>Keine Angabe</span>
            }
          </dd>
        </div>
        <app-button variant="ghost" size="sm" (clicked)="editStep.emit('notice')">
          <ng-container i18n>Ändern</ng-container>
        </app-button>
      </div>
    </dl>

    <!-- Receipts -->
    <div class="mt-6">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100" i18n>Belege ({{ snapshots().length }})</h3>

      <div class="mt-3 space-y-3">
        @for (snapshot of snapshots(); track $index; let i = $index) {
          <div class="rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-700/40">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <ng-container i18n>Beleg {{ i + 1 }}:</ng-container>
                  {{ getReceiptCategoryLabel(snapshot.receiptCategory) || '—' }}
                </p>
                <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {{ getDocumentFormLabel(snapshot.documentForm) }} · {{ formatCurrency(snapshot.amountCents) }}
                </p>
                @if (snapshot.description) {
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">{{ snapshot.description }}</p>
                }
                @if (snapshot.attachmentName) {
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span i18n>Anhang:</span>
                    {{ snapshot.attachmentName }}
                  </p>
                }
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <app-button variant="ghost" size="sm" (clicked)="editReceipt.emit(i)">
                  <ng-container i18n>Ändern</ng-container>
                </app-button>
                @if (snapshots().length > 1) {
                  <button
                    type="button"
                    class="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    (click)="removeReceipt.emit(i)"
                  >
                    <ng-container i18n>Entfernen</ng-container>
                  </button>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <div class="mt-3">
        <app-button variant="secondary" size="sm" (clicked)="addReceipt.emit()">
          <ng-container i18n>Beleg hinzufügen</ng-container>
        </app-button>
      </div>

      <div class="mt-4 flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400" i18n>Gesamtbetrag</p>
        <p class="text-xl font-semibold text-slate-800 dark:text-slate-100">{{ formatCurrency(totalAmountCents()) }}</p>
      </div>
    </div>

    <!-- Next steps -->
    <div class="mt-6">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100" i18n>Was passiert nach dem Absenden?</h3>
      <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
        <li i18n>Nach dem Absenden erhältst du eine Eingangsbestätigung.</li>
        <li i18n>Die Unterlagen werden inhaltlich und formal geprüft.</li>
        <li i18n>Falls etwas fehlt, melden wir uns mit einer konkreten Rückfrage bei dir.</li>
        <li i18n>Nach Freigabe erfolgt die Auszahlung gemäß deiner gewählten Zahlungsart.</li>
      </ol>
    </div>

    @if (hasSubmissionWarnings()) {
      <div class="my-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/60 dark:bg-amber-900/20">
        <h3 class="mb-3 text-base font-semibold text-amber-900 dark:text-amber-200" i18n>Wichtige Hinweise</h3>

        <div class="space-y-3 text-sm text-amber-900 dark:text-amber-200">
          @if (paperOriginalWarning()) {
            <p i18n>
              Da mindestens ein Beleg als „Papierbeleg (Original)“ eingereicht ist, wird der
              beantragte Betrag erst nach Eingang des Originals überwiesen.
            </p>
            <p i18n>
              Eine hochgeladene Scan-Kopie gilt nur als Kopie und ändert nichts daran, dass das
              Original für die Auszahlung eingereicht werden muss.
            </p>
          }

          @if (commercialReceiptWarning()) {
            <p i18n>
              Bei gewerblicher Einreichung mit „Quittung / Kassenbon“ wird der beantragte Betrag
              nur überwiesen, wenn der Bon <= 250,00 € ist. Liegt der Betrag darüber, wird der
              Beleg nicht akzeptiert.
            </p>
          }
        </div>
      </div>
    }

    @if (!hasSubmittableBillType()) {
      <p class="my-6 text-sm text-amber-800 dark:text-amber-200" i18n>
        Mindestens ein Beleg mit Belegart „Rechnung“, „Quittung / Kassenbon“, „Eigenbeleg“,
        „Fahrtkostennachweis“ oder „Sonstige“ ist für die Einreichung erforderlich.
      </p>
    }
  `,
})
export class AssistantReviewComponent {
  readonly scopeLabel = input.required<string>();
  readonly committeeName = input.required<string>();
  readonly paymentMethodLabel = input.required<string>();
  readonly requiresBankDetails = input.required<boolean>();
  readonly bank = input.required<BankDetailsSnapshot>();
  readonly notice = input.required<string>();
  readonly snapshots = input.required<ReceiptSnapshot[]>();
  readonly totalAmountCents = input.required<number>();
  readonly paperOriginalWarning = input(false);
  readonly commercialReceiptWarning = input(false);
  readonly hasSubmittableBillType = input.required<boolean>();

  readonly hasSubmissionWarnings = computed(
    () => this.paperOriginalWarning() || this.commercialReceiptWarning()
  );

  readonly editStep = output<StepId>();
  readonly editReceipt = output<number>();
  readonly addReceipt = output<void>();
  readonly removeReceipt = output<number>();

  readonly getReceiptCategoryLabel = getReceiptCategoryLabel;
  readonly getDocumentFormLabel = getDocumentFormLabel;
  readonly formatCurrency = formatCurrency;
}
