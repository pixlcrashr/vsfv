import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import {
  PaymentMethod,
  InvoiceItemType,
  formatCurrency,
} from '../../../shared/models';
import { Committee } from '../../../shared/models';
import { ReimbursementNewDataService } from './reimbursement-new.data-service';

type Belegform = 'paper_original' | 'digital_original';
type ReceiptCategory =
  | 'rechnung'
  | 'quittung_kassenbon'
  | 'eigenbeleg'
  | 'fahrtkostennachweis'
  | 'sonstige'
  | 'lieferschein'
  | 'bestellbestaetigung';

interface InvoiceItemForm {
  documentForm: Belegform;
  receiptCategory: ReceiptCategory | '';
  description: string;
  amount: number;
  attachment: File | null;
}

type ReimbursementScope = 'hoheitlich' | 'gewerblich';

@Component({
  selector: 'app-reimbursement-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <a layout-header-actions routerLink="../assistant">
        <app-button variant="secondary"><ng-container i18n>Geführte Einreichung</ng-container></app-button>
      </a>

      <div layout-content class="flex flex-1">
        @if (loading()) {
          <div class="flex flex-1 justify-center">
            <app-loading-spinner [fullPage]="true" i18n-text text="Daten werden geladen..." />
          </div>
        } @else {
          <div class="w-full max-w-5xl mx-auto">
            <form [formGroup]="form">
              <div class="overflow-hidden rounded-lg border border-gray-200 bg-white divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700 dark:bg-gray-800">
                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                      1
                    </span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Kostenerstattungsart</h2>
                  </div>

                  <p class="mb-3 text-sm text-gray-600 dark:text-gray-300" i18n>Wähle aus, ob die Erstattung hoheitlich oder gewerblich eingereicht wird.</p>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input
                        type="radio"
                        formControlName="reimbursementScope"
                        value="hoheitlich"
                        class="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Hoheitlich</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Für reguläre Erstattungen ohne gewerbliche Steuerberücksichtigung.
                        </p>
                      </div>
                    </label>

                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input
                        type="radio"
                        formControlName="reimbursementScope"
                        value="gewerblich"
                        class="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Gewerblich</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Für Erstattungen mit steuerlicher Relevanz im gewerblichen Kontext.
                        </p>
                      </div>
                    </label>
                  </div>

                  @if (isCommercial()) {
                    <div class="mt-4 rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-200">
                      <p i18n>
                        Bei gewerblicher Einreichung akzeptieren wir nur Rechnungen oder Kassenbons mit klar identifizierbarer Adresse
                        (ähnlich zu "XXX", z. B. Musterstraße 1, 12345 Musterstadt).
                      </p>
                      <p class="mt-2" i18n>
                        Für Kassenbons über 250,00 € kann die enthaltene Steuer nicht als Vorsteuer angesetzt werden.
                        Reiche in diesem Fall bitte bevorzugt eine Rechnung ein.
                      </p>
                      <p class="mt-2" i18n>
                        Falls auf einem Beleg private und gewerbliche Einkäufe gemischt sind, berechne den zu erstattenden
                        Betrag bitte korrekt inklusive MwSt. Das spart Rückfragen und beschleunigt die Prüfung.
                      </p>
                    </div>
                  }
                </section>

                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                      2
                    </span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Einreichende Stelle</h2>
                  </div>

                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Gremium *</label>
                    <select
                      formControlName="committeeId"
                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="" i18n>Bitte auswählen...</option>
                      @for (committee of committees(); track committee.id) {
                        <option [value]="committee.id">{{ committee.name }}</option>
                      }
                    </select>
                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400" i18n>
                      Hinweis: Einreichende Person bist du (&quot;Du&quot;).
                    </p>
                  </div>
                </section>

                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                      3
                    </span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Auszahlung</h2>
                  </div>

                  <div class="space-y-3">
                    <label class="block cursor-pointer rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <div class="flex items-start gap-3">
                        <input
                          type="radio"
                          formControlName="paymentMethod"
                          value="bank_transfer"
                          class="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Überweisung (IBAN/BIC)</span>
                          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                            Die Erstattung wird auf dein angegebenes Konto überwiesen.
                          </p>

                          @if (requiresBankDetails()) {
                            <div class="mt-4 space-y-3">
                              <div formGroupName="bankDetails">
                                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div class="md:col-span-2">
                                    <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>Kontoinhaber *</label>
                                    <input
                                      type="text"
                                      formControlName="accountHolder"
                                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                    />
                                  </div>
                                  <div>
                                    <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">IBAN *</label>
                                    <input
                                      type="text"
                                      formControlName="iban"
                                      i18n-placeholder
                                      placeholder="DE89 3704 0044 0532 0130 00"
                                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                    />
                                  </div>
                                  <div>
                                    <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>BIC (optional)</label>
                                    <input
                                      type="text"
                                      formControlName="bic"
                                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                    />
                                  </div>
                                </div>
                              </div>

                              <label class="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                  type="checkbox"
                                  formControlName="bankDetailsConfirmed"
                                  class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                                />
                                <span i18n>Ich bestätige, dass die oben angegebene Bankverbindung korrekt ist.</span>
                              </label>
                            </div>
                          }
                        </div>
                      </div>
                    </label>

                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input
                        type="radio"
                        formControlName="paymentMethod"
                        value="cash"
                        class="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Barzahlung</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Du holst den Betrag als Barauszahlung ab.
                        </p>
                      </div>
                    </label>

                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input
                        type="radio"
                        formControlName="paymentMethod"
                        value="direct_invoice"
                        class="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Direktüberweisung an Rechnungssteller</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Die Zahlung geht direkt an den Rechnungssteller.
                        </p>
                      </div>
                    </label>

                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input
                        type="radio"
                        formControlName="paymentMethod"
                        value="prepayment"
                        class="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Vorkasse</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Der AStA überweist den beantragten Betrag vorab als Vorkasse.
                        </p>
                      </div>
                    </label>
                  </div>
                </section>

                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                      4
                    </span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Belege</h2>
                  </div>

                  <div class="mb-4 rounded-md border-l-4 border-blue-600 bg-blue-50 p-3 dark:border-blue-500 dark:bg-blue-950/40">
                    <p class="text-sm text-blue-900 dark:text-blue-200" i18n>
                      Bitte erfasse alle Belege vollständig und nutze Belegform sowie Belegart.
                    </p>
                  </div>

                  <div formArrayName="invoiceItems" class="space-y-4">
                    @for (item of invoiceItems.controls; track $index; let i = $index) {
                      <div class="rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-700/40" [formGroupName]="i">
                        <div class="mb-3 flex items-center justify-between">
                          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200" i18n>Beleg {{ i + 1 }}</span>
                          @if (invoiceItems.length > 1) {
                            <button
                              type="button"
                              (click)="removeInvoiceItem(i)"
                              class="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <ng-container i18n>Entfernen</ng-container>
                            </button>
                          }
                        </div>

                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>Belegform *</label>
                            <select
                              formControlName="documentForm"
                              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            >
                              <option value="paper_original" i18n>Papierbeleg (Original)</option>
                              <option value="digital_original" i18n>Originär digital (E-Rechnung, PDF, usw.)</option>
                            </select>
                          </div>

                          <div>
                            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>Belegart *</label>
                            <select
                              formControlName="receiptCategory"
                              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            >
                              <option value="" i18n>Bitte auswählen...</option>
                              @for (option of receiptCategoryOptions; track option) {
                                <option [value]="option.value">{{ option.label }}</option>
                              }
                            </select>
                          </div>

                          <div>
                            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>Betrag (EUR) *</label>
                            <input
                              type="number"
                              formControlName="amount"
                              step="0.01"
                              min="0"
                              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400" i18n>
                              Gib hier den tatsächlich zu erstattenden Betrag an (maximal den Rechnungsbetrag). Rechnungen
                              mit privaten Anteilen sind möglich, wenn diese nicht von der Studierendenschaft getragen werden
                              und die Rechnung nicht anderweitig verwendet wird. Dieses Vorgehen ist aufwendig und gerade bei
                              gewerblichen Einreichungen nach Möglichkeit zu vermeiden.
                            </p>
                          </div>

                          <div class="md:col-span-2">
                            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>Anmerkung</label>
                            <input
                              type="text"
                              formControlName="description"
                              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            />
                          </div>
                        </div>

                        @if (item.get('documentForm')?.value === 'paper_original') {
                          <div class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-200">
                            <p i18n>
                              Hinweis: Eine hochgeladene Scan-Kopie gilt nur als Kopie. Für die Auszahlung muss der
                              Papierbeleg im Original eingereicht werden.
                            </p>
                          </div>
                        }

                        <div class="mt-3">
                          <div class="mb-1 flex items-center justify-between">
                            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300" i18n>Anhang (optional)</label>
                            <span class="text-xs text-gray-500 dark:text-gray-400" i18n>Max. 1 Datei</span>
                          </div>

                          <input
                            #attachmentInput
                            type="file"
                            class="sr-only"
                            accept=".pdf,.jpg,.jpeg,.png"
                            (change)="onAttachmentSelected($event, i)"
                          />

                          @if (getAttachmentName(i); as attachmentName) {
                            <div class="flex items-center justify-between gap-3 rounded-md border border-gray-300 p-3 dark:border-gray-600">
                              <div class="min-w-0">
                                <p class="truncate text-sm text-gray-700 dark:text-gray-300">{{ attachmentName }}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400" i18n>1 Datei ausgewählt</p>
                              </div>

                              <button
                                type="button"
                                class="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                (click)="clearAttachment(i, attachmentInput)"
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
                              <p class="text-sm text-gray-600 dark:text-gray-300" i18n>Klicke, um einen Beleg hochzuladen</p>
                              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400" i18n>PDF, JPG, PNG (max. 10 MB)</p>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <div class="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <app-button variant="secondary" size="sm" (clicked)="addInvoiceItem()">
                      <ng-container i18n>Beleg hinzufügen</ng-container>
                    </app-button>

                    <div class="text-right">
                      <p class="text-sm text-gray-500 dark:text-gray-400" i18n>Gesamtbetrag</p>
                      <p class="text-xl font-semibold text-slate-800 dark:text-slate-100">{{ formatCurrency(totalAmount()) }}</p>
                    </div>
                  </div>
                </section>

                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                      5
                    </span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Anmerkung</h2>
                  </div>

                  <textarea
                    formControlName="notice"
                    rows="4"
                    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                    i18n-placeholder
                    placeholder="Gib hier alle Hinweise ein, die für die Prüfung wichtig sind..."
                  ></textarea>
                </section>

                <section class="p-6" formGroupName="declarations">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                      6
                    </span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Verbindliche Erklärungen</h2>
                  </div>

                  <div class="mb-4 rounded-md border-l-4 border-slate-700 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-400 dark:bg-slate-900/40 dark:text-slate-200">
                    <p i18n>
                      Info: Mit dem Absenden bestätigst du verbindlich die Richtigkeit deiner Angaben und die Nachvollziehbarkeit
                      deiner eingereichten Unterlagen.
                    </p>
                  </div>

                  <div class="space-y-3">
                    <label class="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" formControlName="detailsAreCorrect" class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
                      <span i18n>Ich bestätige, dass alle Angaben vollständig und korrekt sind.</span>
                    </label>
                    <label class="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" formControlName="noThirdPartyFunding" class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
                      <span i18n>Ich bestätige, dass für diese Ausgaben keine doppelte Erstattung durch Dritte erfolgt.</span>
                    </label>
                    <label class="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" formControlName="originalsAvailable" class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
                      <span i18n>Ich reiche die erforderlichen Belege innerhalb von 14 Tagen ein.</span>
                    </label>
                  </div>
                </section>

                <section class="p-6">
                  <div>
                    <div class="mb-4 flex items-center gap-3">
                      <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
                        7
                      </span>
                      <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Einreichung</h2>
                    </div>

                    <ol class="list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
                      <li i18n>Nach dem Absenden erhältst du eine Eingangsbestätigung.</li>
                      <li i18n>Die Unterlagen werden inhaltlich und formal geprüft.</li>
                      <li i18n>Falls etwas fehlt, melden wir uns mit einer konkreten Rückfrage bei dir.</li>
                      <li i18n>Nach Freigabe erfolgt die Auszahlung gemäß deiner gewählten Zahlungsart.</li>
                    </ol>
                  </div>

                  @if (hasSubmissionWarnings()) {
                    <div class="rounded-md border border-amber-300 bg-amber-50 my-6 p-4 dark:border-amber-500/60 dark:bg-amber-900/20">
                      <h2 class="mb-3 text-base font-semibold text-amber-900 dark:text-amber-200" i18n>Wichtige Hinweise</h2>

                      <div class="space-y-3 text-sm text-amber-900 dark:text-amber-200">
                        @if (hasPaperOriginalSubmissionWarning()) {
                          <p i18n>
                            Da mindestens ein Beleg als "Papierbeleg (Original)" eingereicht ist, wird der beantragte Betrag
                            erst nach Eingang des Originals überwiesen.
                          </p>
                          <p i18n>
                            Eine hochgeladene Scan-Kopie gilt nur als Kopie und ändert nichts daran, dass das Original
                            für die Auszahlung eingereicht werden muss.
                          </p>
                        }

                        @if (hasCommercialReceiptSubmissionWarning()) {
                          <p i18n>
                            Bei gewerblicher Einreichung mit "Quittung / Kassenbon" wird der beantragte Betrag nur überwiesen,
                            wenn der Bon <= 250,00 € ist. Liegt der Betrag darüber, wird der Beleg nicht akzeptiert.
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

                  <div class="flex flex-wrap justify-end gap-3">
                    <a routerLink="/reimbursements">
                      <app-button variant="secondary"><ng-container i18n>Abbrechen</ng-container></app-button>
                    </a>
                    <app-button
                      variant="primary"
                      (clicked)="submit()"
                      [disabled]="saving() || !form.valid || invoiceItems.length === 0 || !hasSubmittableBillType()"
                    >
                      <ng-container i18n>Einreichung absenden</ng-container>
                    </app-button>
                  </div>
                </section>
              </div>
            </form>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class ReimbursementNewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(ReimbursementNewDataService);
  private readonly fb = inject(FormBuilder);
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
  readonly saving = signal(false);
  readonly committees = signal<Committee[]>([]);
  readonly selectedPaymentMethod = signal<PaymentMethod>('bank_transfer');
  readonly selectedReimbursementScope = signal<ReimbursementScope>('hoheitlich');
  readonly hasPaperOriginalSubmissionWarning = signal(false);
  readonly hasCommercialReceiptSubmissionWarning = signal(false);
  readonly hasSubmittableBillType = signal(false);
  readonly hasSubmissionWarnings = computed(
    () => this.hasPaperOriginalSubmissionWarning() || this.hasCommercialReceiptSubmissionWarning()
  );
  readonly receiptCategoryOptions: { value: ReceiptCategory; label: string }[] = [
    { value: 'rechnung', label: $localize`Rechnung` },
    { value: 'quittung_kassenbon', label: $localize`Quittung / Kassenbon` },
    { value: 'eigenbeleg', label: $localize`Eigenbeleg` },
    { value: 'fahrtkostennachweis', label: $localize`Fahrtkostennachweis` },
    { value: 'sonstige', label: $localize`Sonstige` },
    { value: 'lieferschein', label: $localize`Lieferschein` },
    { value: 'bestellbestaetigung', label: $localize`Bestellbestätigung` },
  ];

  readonly form = this.fb.group({
    reimbursementScope: ['hoheitlich' as ReimbursementScope, Validators.required],
    committeeId: ['', Validators.required],
    paymentMethod: ['bank_transfer' as PaymentMethod, Validators.required],
    bankDetails: this.fb.group({
      accountHolder: [''],
      iban: [''],
      bic: [''],
    }),
    bankDetailsConfirmed: [false],
    notice: [''],
    declarations: this.fb.group({
      detailsAreCorrect: [false, Validators.requiredTrue],
      noThirdPartyFunding: [false, Validators.requiredTrue],
      originalsAvailable: [false, Validators.requiredTrue],
    }),
    invoiceItems: this.fb.array<any>([]),
  });

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Kostenerstattungen`, path: '' },
    { label: $localize`Kostenerstattung / Rechnungseinreichung` },
  ];

  get invoiceItems(): FormArray {
    return this.form.get('invoiceItems') as FormArray;
  }

  readonly requiresBankDetails = computed(
    () => this.selectedPaymentMethod() === 'bank_transfer'
  );
  readonly isCommercial = computed(() => this.selectedReimbursementScope() === 'gewerblich');

  readonly totalAmount = signal(0);

  ngOnInit(): void {
    this.breadcrumbs[0].path = `/organizations/${this.getOrgId()}/reimbursements`;
    this.loadData();
    this.setupBankValidation();
    this.setupReimbursementScopeWatcher();
    this.setupInvoiceWarningsWatcher();
    this.addInvoiceItem();
  }

  private loadData(): void {
    this.dataService.getCommitteeOptions().subscribe({
      next: (committees) => {
        this.committees.set(committees);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private setupBankValidation(): void {
    const paymentControl = this.form.get('paymentMethod');
    const bankDetails = this.form.get('bankDetails');
    const bankDetailsConfirmed = this.form.get('bankDetailsConfirmed');

    const applyValidation = (method: PaymentMethod | null | undefined) => {
      const currentMethod = (method ?? 'bank_transfer') as PaymentMethod;
      this.selectedPaymentMethod.set(currentMethod);

      if (currentMethod === 'bank_transfer') {
        bankDetails?.get('accountHolder')?.setValidators(Validators.required);
        bankDetails?.get('iban')?.setValidators(Validators.required);
        bankDetailsConfirmed?.setValidators(Validators.requiredTrue);
      } else {
        bankDetails?.get('accountHolder')?.clearValidators();
        bankDetails?.get('iban')?.clearValidators();
        bankDetailsConfirmed?.clearValidators();
        bankDetailsConfirmed?.setValue(false, { emitEvent: false });
      }

      bankDetails?.get('accountHolder')?.updateValueAndValidity();
      bankDetails?.get('iban')?.updateValueAndValidity();
      bankDetailsConfirmed?.updateValueAndValidity();
    };

    applyValidation(paymentControl?.value as PaymentMethod);
    paymentControl?.valueChanges.subscribe((method) => applyValidation(method as PaymentMethod));
  }

  private setupReimbursementScopeWatcher(): void {
    const scopeControl = this.form.get('reimbursementScope');
    this.selectedReimbursementScope.set((scopeControl?.value as ReimbursementScope) ?? 'hoheitlich');
    this.updateSubmissionWarnings();

    scopeControl?.valueChanges.subscribe((scope) => {
      this.selectedReimbursementScope.set((scope as ReimbursementScope) ?? 'hoheitlich');
      this.updateSubmissionWarnings();
    });
  }

  private setupInvoiceWarningsWatcher(): void {
    const invoiceItemsControl = this.form.get('invoiceItems');
    this.updateSubmissionWarnings();
    this.updateTotalAmount();

    invoiceItemsControl?.valueChanges.subscribe(() => {
      this.updateSubmissionWarnings();
      this.updateTotalAmount();
    });
  }

  private updateSubmissionWarnings(): void {
    const items = (this.invoiceItems.value as InvoiceItemForm[] | null) ?? [];

    this.hasSubmittableBillType.set(
      items.some(
        (item) => item.receiptCategory === 'rechnung'
          || item.receiptCategory === 'quittung_kassenbon'
          || item.receiptCategory === 'eigenbeleg'
          || item.receiptCategory === 'fahrtkostennachweis'
          || item.receiptCategory === 'sonstige'
      )
    );

    this.hasPaperOriginalSubmissionWarning.set(
      items.some((item) => item.documentForm === 'paper_original')
    );

    this.hasCommercialReceiptSubmissionWarning.set(
      this.selectedReimbursementScope() === 'gewerblich'
      && items.some((item) => item.receiptCategory === 'quittung_kassenbon')
    );
  }

  private updateTotalAmount(): void {
    const items = (this.invoiceItems.value as InvoiceItemForm[] | null) ?? [];
    const sum = items.reduce((acc, item) => acc + (Number(item.amount) || 0) * 100, 0);
    this.totalAmount.set(sum);
  }

  private mapReceiptCategoryToInvoiceItemType(category: ReceiptCategory | ''): InvoiceItemType {
    return category === 'quittung_kassenbon' ? 'receipt' : 'invoice';
  }

  private getReceiptCategoryLabel(category: ReceiptCategory | ''): string | null {
    switch (category) {
      case 'rechnung':
        return $localize`Rechnung`;
      case 'quittung_kassenbon':
        return $localize`Quittung / Kassenbon`;
      case 'eigenbeleg':
        return $localize`Eigenbeleg`;
      case 'fahrtkostennachweis':
        return $localize`Fahrtkostennachweis`;
      case 'sonstige':
        return $localize`Sonstige`;
      case 'lieferschein':
        return $localize`Lieferschein`;
      case 'bestellbestaetigung':
        return $localize`Bestellbestätigung`;
      default:
        return null;
    }
  }

  private getDocumentFormLabel(form: Belegform): string {
    return form === 'paper_original'
      ? $localize`Papierbeleg (Original)`
      : $localize`Originär digital (E-Rechnung, PDF, usw.)`;
  }

  addInvoiceItem(): void {
    const itemGroup = this.fb.group({
      documentForm: ['paper_original' as Belegform, Validators.required],
      receiptCategory: ['', Validators.required],
      description: [''],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      attachment: [null as File | null],
    });
    this.invoiceItems.push(itemGroup);
    this.updateSubmissionWarnings();
    this.updateTotalAmount();
  }

  getAttachmentName(index: number): string | null {
    const file = this.invoiceItems.at(index)?.get('attachment')?.value as File | null;
    return file?.name ?? null;
  }

  openAttachmentDialog(event: Event, inputElement: HTMLInputElement): void {
    event.preventDefault();
    event.stopPropagation();
    inputElement.click();
  }

  onAttachmentSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.invoiceItems.at(index)?.get('attachment')?.setValue(file);
  }

  clearAttachment(index: number, inputElement: HTMLInputElement): void {
    this.invoiceItems.at(index)?.get('attachment')?.setValue(null);
    inputElement.value = '';
  }

  removeInvoiceItem(index: number): void {
    this.invoiceItems.removeAt(index);
    this.updateSubmissionWarnings();
    this.updateTotalAmount();
  }

  submit(): void {
    if (!this.form.valid || this.invoiceItems.length === 0 || !this.hasSubmittableBillType()) return;

    this.saving.set(true);
    const formValue = this.form.value;

    const reimbursementScopeLabel =
      formValue.reimbursementScope === 'gewerblich' ? $localize`Gewerblich` : $localize`Hoheitlich`;

    const noticeParts = [
      `${$localize`Kostenerstattungsart`}: ${reimbursementScopeLabel}`,
      (formValue.notice || '').trim(),
    ].filter((part): part is string => part.length > 0);

    const invoiceItems = (formValue.invoiceItems as InvoiceItemForm[] || []).map((item) => {
      const receiptCategoryLabel = this.getReceiptCategoryLabel(item.receiptCategory);
      const documentFormLabel = this.getDocumentFormLabel(item.documentForm);

      return {
        type: this.mapReceiptCategoryToInvoiceItemType(item.receiptCategory),
        description: [
          `${$localize`Belegform`}: ${documentFormLabel}`,
          receiptCategoryLabel ? `${$localize`Belegart`}: ${receiptCategoryLabel}` : null,
          item.description?.trim() ? item.description.trim() : null,
        ]
          .filter((part): part is string => !!part)
          .join(' | ') || null,
        amount: Math.round((Number(item.amount) || 0) * 100),
      };
    });

    this.dataService
      .createReimbursement({
        committeeId: formValue.committeeId!,
        notice: noticeParts.join('\n') || null,
        paymentMethod: formValue.paymentMethod as PaymentMethod,
        bankDetails:
          formValue.paymentMethod === 'bank_transfer'
            ? {
                accountHolder: formValue.bankDetails?.accountHolder || '',
                iban: formValue.bankDetails?.iban || '',
                bic: formValue.bankDetails?.bic || null,
              }
            : null,
        invoiceItems,
      })
      .subscribe({
        next: (reimbursement) => {
          this.saving.set(false);
          this.router.navigate(['/organizations', this.getOrgId(), 'reimbursements', reimbursement.id]);
        },
        error: () => {
          this.saving.set(false);
          this.notifications.error($localize`Fehler beim Erstellen der Erstattung`);
        },
      });
  }

  formatCurrency(cents: number): string {
    return formatCurrency(cents);
  }
}
