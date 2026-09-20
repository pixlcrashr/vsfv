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
import { formatCurrency } from '../../../shared/models';
import { Committee } from '../../../shared/models';
import {
  SubmissionDirection,
  SettlementKind,
  SubmissionScope,
  PayoutMethod,
  PaymentRequestTiming,
  DocumentForm,
} from '../../../shared/models';
import {
  SubmissionNewDataService,
  SettlementPayload,
  CreateItemParams,
} from './submission-new.data-service';

type ReceiptCategory =
  | 'rechnung'
  | 'quittung_kassenbon'
  | 'eigenbeleg'
  | 'fahrtkostennachweis'
  | 'sonstige'
  | 'lieferschein'
  | 'bestellbestaetigung'
  | 'spendenquittung'
  | 'sponsoringvertrag'
  | 'zustellungsbestaetigung';

interface ItemForm {
  category: ReceiptCategory | '';
  documentForm: DocumentForm;
  source: string;
  description: string;
  amount: number;
  attachment: File | null;
}

const EXPENSE_CATEGORIES: { value: ReceiptCategory; label: string }[] = [
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'quittung_kassenbon', label: 'Quittung / Kassenbon' },
  { value: 'eigenbeleg', label: 'Eigenbeleg' },
  { value: 'fahrtkostennachweis', label: 'Fahrtkostennachweis' },
  { value: 'sonstige', label: 'Sonstige' },
  { value: 'lieferschein', label: 'Lieferschein' },
  { value: 'bestellbestaetigung', label: 'Bestellbestätigung' },
];

const INCOME_CATEGORIES: { value: ReceiptCategory; label: string }[] = [
  { value: 'spendenquittung', label: 'Spendenquittung' },
  { value: 'sponsoringvertrag', label: 'Sponsoringvertrag' },
  { value: 'zustellungsbestaetigung', label: 'Zustellungsbestätigung' },
  { value: 'sonstige', label: 'Sonstige' },
];

@Component({
  selector: 'app-submission-new',
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
                <!-- 1: Einreichende Stelle -->
                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">1</span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Einreichende Stelle</h2>
                  </div>

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
                </section>

                <!-- 2: Art der Einreichung -->
                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">2</span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Was möchtest du einreichen?</h2>
                  </div>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input type="radio" formControlName="direction" value="expense" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Ausgabe</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Belege für Ausgaben – mit Auslagenerstattung, Gremiumskonto oder Zahlungsauftrag.
                        </p>
                      </div>
                    </label>

                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                      <input type="radio" formControlName="direction" value="income" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Einnahme</span>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Nachweise, wie eine Einnahme entstanden ist (z. B. Spende, Sponsoring). Keine Auszahlung.
                        </p>
                      </div>
                    </label>
                  </div>
                </section>

                <!-- 3: Abrechnungsweg (nur Ausgaben) -->
                @if (isExpense()) {
                  <section class="p-6">
                    <div class="mb-4 flex items-center gap-3">
                      <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">3</span>
                      <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Abrechnungsweg</h2>
                    </div>

                    <div class="space-y-3">
                      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                        <input type="radio" formControlName="settlement" value="person" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                        <div>
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Auslagenerstattung</span>
                          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>Du hast die Ausgabe privat vorgestreckt und bekommst das Geld zurück.</p>
                        </div>
                      </label>

                      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                        <input type="radio" formControlName="settlement" value="committee_account" [disabled]="selectedCommittee()?.paymentAccounts?.length === 0" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                        <div>
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Vom Gremiumskonto/-kasse bezahlt</span>
                          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                            Die Ausgabe wurde bereits vom eigenen Konto oder aus der Kasse des Gremiums bezahlt (reine Dokumentation).
                          </p>
                        </div>
                      </label>

                      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                        <input type="radio" formControlName="settlement" value="payment_request" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                        <div>
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Zahlungsauftrag an die Kassenführung</span>
                          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>Noch niemand hat bezahlt – die Kassenführung zahlt den Empfänger aus dem zentralen Konto.</p>
                        </div>
                      </label>
                    </div>

                    <!-- Variant: person -->
                    @if (settlement() === 'person') {
                      <div class="mt-4 space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700" formGroupName="personDetails">
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Auszahlung *</label>
                          <div class="flex gap-6">
                            <label class="flex items-center gap-2 text-sm">
                              <input type="radio" formControlName="payoutMethod" value="bank_transfer" class="text-blue-600 focus:ring-blue-500" />
                              <span i18n>Überweisung</span>
                            </label>
                            <label class="flex items-center gap-2 text-sm">
                              <input type="radio" formControlName="payoutMethod" value="cash" class="text-blue-600 focus:ring-blue-500" />
                              <span i18n>Barauszahlung</span>
                            </label>
                          </div>
                        </div>

                        @if (payoutMethod() === 'bank_transfer') {
                          <div class="grid grid-cols-1 gap-3 md:grid-cols-3" formGroupName="bankDetails">
                            <div>
                              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Kontoinhaber *</label>
                              <input type="text" formControlName="accountHolder" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                            </div>
                            <div>
                              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>IBAN *</label>
                              <input type="text" formControlName="iban" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                            </div>
                            <div>
                              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>BIC</label>
                              <input type="text" formControlName="bic" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <!-- Variant: committee_account -->
                    @if (settlement() === 'committee_account') {
                      <div class="mt-4 space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700" formGroupName="committeeAccountDetails">
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Bezahlt von *</label>
                          <select formControlName="paymentAccountUid" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                            <option value="" i18n>Bitte auswählen...</option>
                            @for (account of selectedCommittee()?.paymentAccounts ?? []; track account.uid) {
                              <option [value]="account.uid">{{ account.label }}</option>
                            }
                          </select>
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Bezahlt am *</label>
                          <input type="date" formControlName="paidDate" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Zahlungsreferenz</label>
                          <input type="text" formControlName="paymentReference" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                        </div>
                        @if (isCashBox()) {
                          <div class="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-200">
                            <p i18n>
                              Die Kasse muss regelmäßig ein Kassenbuch vorlegen. Stelle sicher, dass die Entnahme im Kassenbuch erfasst ist.
                            </p>
                          </div>
                        }
                      </div>
                    }

                    <!-- Variant: payment_request -->
                    @if (settlement() === 'payment_request') {
                      <div class="mt-4 space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700" formGroupName="paymentRequestDetails">
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Empfänger (Name) *</label>
                            <input type="text" formControlName="vendorName" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          </div>
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>IBAN *</label>
                            <input type="text" formControlName="vendorIban" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          </div>
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>BIC</label>
                            <input type="text" formControlName="vendorBic" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          </div>
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Zahlungsart *</label>
                            <select formControlName="timing" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                              <option value="on_invoice" i18n>Zahlung auf Rechnung</option>
                              <option value="advance" i18n>Vorkasse</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    }
                  </section>
                }

                <!-- 4: Umfang (hoheitlich/gewerblich) -->
                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">4</span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Umfang</h2>
                  </div>

                  @if (selectedCommittee()?.allowScopeSelection) {
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                        <input type="radio" formControlName="scope" value="hoheitlich" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                        <div>
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Hoheitlich</span>
                          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>Für reguläre Einreichungen ohne gewerbliche Steuerberücksichtigung.</p>
                        </div>
                      </label>
                      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                        <input type="radio" formControlName="scope" value="gewerblich" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                        <div>
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Gewerblich</span>
                          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>Für Einreichungen mit steuerlicher Relevanz im gewerblichen Kontext.</p>
                        </div>
                      </label>
                    </div>
                  } @else {
                    <p class="text-sm text-gray-600 dark:text-gray-300" i18n>
                      Einreichungen dieses Gremiums sind immer <strong>hoheitlich</strong>.
                    </p>
                  }

                  @if (scope() === 'gewerblich') {
                    <div class="mt-4 rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-200">
                      <p i18n>
                        Bei gewerblicher Einreichung akzeptieren wir nur Belege mit klar identifizierbarer Adresse des Ausstellers.
                        Kassenbons über 250,00 € können nicht mit Vorsteuer angesetzt werden – reiche hierfür eine Rechnung ein.
                      </p>
                    </div>
                  }
                </section>

                <!-- 5: Belege -->
                <section class="p-6">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">5</span>
                      <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Belege</h2>
                    </div>
                    <app-button type="button" variant="secondary" (click)="addItem()">
                      <ng-container i18n>Beleg hinzufügen</ng-container>
                    </app-button>
                  </div>

                  <div formArrayName="items" class="space-y-4">
                    @for (item of items.controls; track $index) {
                      <div class="rounded-md border border-gray-200 p-4 dark:border-gray-700" [formGroupName]="$index">
                        <div class="mb-3 flex items-center justify-between">
                          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Beleg {{ $index + 1 }}</span>
                          <button type="button" class="text-sm text-red-600 dark:text-red-400" (click)="removeItem($index)" i18n>Entfernen</button>
                        </div>
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Belegart</label>
                            <select formControlName="category" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                              <option value="" i18n>Bitte auswählen...</option>
                              @for (cat of categories(); track cat.value) {
                                <option [value]="cat.value">{{ cat.label }}</option>
                              }
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Belegform</label>
                            <select formControlName="documentForm" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                              <option value="paper_original" i18n>Papierbeleg (Original)</option>
                              <option value="digital_original" i18n>Originär digital (E-Rechnung, PDF, …)</option>
                            </select>
                          </div>
                          @if (isIncome()) {
                            <div>
                              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Quelle / Herkunft</label>
                              <input type="text" formControlName="source" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                            </div>
                          }
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Betrag (€) *</label>
                            <input type="number" step="0.01" min="0.01" formControlName="amount" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          </div>
                          <div>
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Anhang (PDF/JPG/PNG, max. 10 MB)</label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onAttachmentChange($index, $event)" class="w-full text-sm" />
                          </div>
                          <div class="md:col-span-2">
                            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Anmerkung</label>
                            <input type="text" formControlName="description" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </section>

                <!-- 6: Anmerkung & Erklärungen -->
                <section class="p-6">
                  <div class="mb-4 flex items-center gap-3">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">6</span>
                    <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100" i18n>Anmerkung & Erklärungen</h2>
                  </div>

                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Anmerkung</label>
                  <textarea formControlName="notice" rows="3" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"></textarea>

                  <div class="mt-4 space-y-2" formGroupName="declarations">
                    <label class="flex items-start gap-2 text-sm">
                      <input type="checkbox" formControlName="detailsAreCorrect" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                      <span i18n>Alle Angaben sind korrekt und vollständig. *</span>
                    </label>
                    <label class="flex items-start gap-2 text-sm">
                      <input type="checkbox" formControlName="noThirdPartyFunding" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                      <span i18n>Die Ausgabe/Einnahme wird nicht zusätzlich durch Dritte gefördert. *</span>
                    </label>
                    <label class="flex items-start gap-2 text-sm">
                      <input type="checkbox" formControlName="originalsAvailable" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                      <span i18n>Originale liegen vor und werden auf Verlangen eingereicht. *</span>
                    </label>
                  </div>
                </section>

                <!-- Submit -->
                <section class="p-6">
                  <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                      @if (totalAmount() > 0 && isExpense()) {
                        <span i18n>Summe:</span> <strong>{{ formatCurrency(totalAmount()) }}</strong>
                      }
                    </div>
                    <app-button type="button" variant="primary" [disabled]="!form.valid || items.length === 0 || submitting()" (click)="submit()">
                      <ng-container i18n>Einreichen</ng-container>
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
export class SubmissionNewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly dataService = inject(SubmissionNewDataService);

  private readonly orgId = signal('');
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly committees = signal<Committee[]>([]);

  // exposed for the template
  readonly formatCurrency = formatCurrency;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Belegeinreichungen`, path: '..' },
    { label: $localize`Belege einreichen` },
  ];

  readonly form = this.fb.group({
    committeeId: ['', Validators.required],
    direction: ['expense' as SubmissionDirection, Validators.required],
    settlement: ['person' as SettlementKind],
    personDetails: this.fb.group({
      payoutMethod: ['bank_transfer' as PayoutMethod],
      bankDetails: this.fb.group({
        accountHolder: [''],
        iban: [''],
        bic: [''],
      }),
    }),
    committeeAccountDetails: this.fb.group({
      paymentAccountUid: [''],
      paidDate: [''],
      paymentReference: [''],
    }),
    paymentRequestDetails: this.fb.group({
      vendorName: [''],
      vendorIban: [''],
      vendorBic: [''],
      timing: ['on_invoice' as PaymentRequestTiming],
    }),
    scope: ['hoheitlich' as SubmissionScope],
    notice: [''],
    declarations: this.fb.group({
      detailsAreCorrect: [false, Validators.requiredTrue],
      noThirdPartyFunding: [false, Validators.requiredTrue],
      originalsAvailable: [false, Validators.requiredTrue],
    }),
    items: this.fb.array<ReturnType<this['createItemGroup']>>([]),
  });

  readonly selectedCommittee = computed(() =>
    this.committees().find((c) => c.id === this.form.controls.committeeId.value) ?? null
  );
  readonly isExpense = computed(() => this.form.controls.direction.value === 'expense');
  readonly isIncome = computed(() => this.form.controls.direction.value === 'income');
  readonly settlement = computed(() => this.form.controls.settlement.value);
  readonly payoutMethod = computed(() => this.form.controls.personDetails.controls.payoutMethod.value);
  readonly scope = computed(() => this.form.controls.scope.value);
  readonly isCashBox = computed(() => {
    const uid = this.form.controls.committeeAccountDetails.controls.paymentAccountUid.value;
    const account = this.selectedCommittee()?.paymentAccounts.find((a) => a.uid === uid);
    return account?.kind === 'cash_box';
  });
  readonly categories = computed(() =>
    this.isIncome() ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  );
  readonly totalAmount = computed(() =>
    this.items.controls.reduce(
      (sum, control) => sum + (Math.round((control.get('amount')?.value ?? 0) * 100) || 0),
      0
    )
  );

  get items(): FormArray {
    return this.form.controls.items;
  }

  // Factory exposed for the FormArray generic above.
  createItemGroup() {
    return this.fb.group({
      category: ['' as ReceiptCategory | ''],
      documentForm: ['paper_original' as DocumentForm],
      source: [''],
      description: [''],
      amount: [null as number | null, Validators.min(0.01)],
      attachment: [null as File | null],
    });
  }

  ngOnInit(): void {
    this.orgId.set(this.route.snapshot.paramMap.get('orgId') ?? '');
    this.dataService.getCommitteeOptions().subscribe({
      next: (committees) => {
        this.committees.set(committees);
        this.loading.set(false);
      },
      error: () => {
        this.notificationService.error($localize`Fehler beim Laden der Gremien`);
        this.loading.set(false);
      },
    });

    // Income submissions have no settlement.
    this.form.controls.direction.valueChanges.subscribe((direction) => {
      const settlementControl = this.form.controls.settlement;
      if (direction === 'income') {
        settlementControl.disable();
      } else {
        settlementControl.enable();
      }
    });
  }

  addItem(): void {
    this.items.push(this.createItemGroup());
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  onAttachmentChange(index: number, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.items.at(index).patchValue({ attachment: file });
  }

  submit(): void {
    if (this.form.invalid || this.items.length === 0 || this.submitting()) {
      return;
    }
    this.submitting.set(true);

    const params = this.buildParams();
    this.dataService.createAndSubmitSubmission(params).subscribe({
      next: (submission) => {
        this.notificationService.success(
          $localize`Einreichung ${submission.publicId}:MSG: erfolgreich übermittelt.`
        );
        this.router.navigate(['..', submission.id], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notificationService.error($localize`Die Einreichung konnte nicht übermittelt werden.`);
      },
    });
  }

  private buildParams() {
    const value = this.form.getRawValue();
    const direction = value.direction;
    const settlementKind = direction === 'income' ? null : value.settlement;

    let settlement: SettlementPayload | null = null;
    if (settlementKind === 'person') {
      settlement = {
        kind: 'person',
        payoutMethod: (value.personDetails.payoutMethod ?? 'bank_transfer') as PayoutMethod,
        bankDetails:
          value.personDetails.payoutMethod === 'bank_transfer'
            ? {
                accountHolder: value.personDetails.bankDetails.accountHolder ?? '',
                iban: value.personDetails.bankDetails.iban ?? '',
                bic: value.personDetails.bankDetails.bic || null,
              }
            : null,
      };
    } else if (settlementKind === 'committee_account') {
      settlement = {
        kind: 'committee_account',
        paymentAccountUid: value.committeeAccountDetails.paymentAccountUid ?? '',
        paidDate: value.committeeAccountDetails.paidDate
          ? new Date(value.committeeAccountDetails.paidDate)
          : null,
        paymentReference: value.committeeAccountDetails.paymentReference || null,
      };
    } else if (settlementKind === 'payment_request') {
      settlement = {
        kind: 'payment_request',
        vendorName: value.paymentRequestDetails.vendorName ?? '',
        vendorIban: value.paymentRequestDetails.vendorIban ?? '',
        vendorBic: value.paymentRequestDetails.vendorBic || null,
        timing: (value.paymentRequestDetails.timing ?? 'on_invoice') as PaymentRequestTiming,
      };
    }

    const scope: SubmissionScope = this.selectedCommittee()?.allowScopeSelection
      ? (value.scope ?? 'hoheitlich')
      : 'hoheitlich';

    const items: CreateItemParams[] = value.items.map((item) => ({
      category: item.category,
      documentForm: item.documentForm,
      source: direction === 'income' ? item.source || null : null,
      description: item.description || null,
      amount: Math.round((item.amount ?? 0) * 100),
    }));

    return {
      committeeId: value.committeeId ?? '',
      direction: direction ?? 'expense',
      settlement,
      scope,
      notice: value.notice || null,
      items,
    };
  }
}
