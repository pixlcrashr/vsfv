import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormArray,
} from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import {
  Committee,
  PayoutMethod,
  SettlementPayload,
} from '../../../shared/models';
import { SubmissionNewDataService } from '../submission-new/submission-new.data-service';
import { AssistantInfoBoxComponent } from './assistant-info-box.component';
import {
  AssistantReceiptStepComponent,
  ReceiptStepSection,
} from './assistant-receipt-step.component';
import { AssistantReviewComponent } from './assistant-review.component';
import {
  Belegform,
  InvoiceItemForm,
  ReceiptCategory,
  ReceiptSnapshot,
  SubmissionScope,
  StepId,
  WizardStep,
  getDocumentFormLabel,
  getReceiptCategoryLabel,
} from './assistant.types';

@Component({
  selector: 'app-submission-assistant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
    AssistantInfoBoxComponent,
    AssistantReceiptStepComponent,
    AssistantReviewComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <a layout-header-actions routerLink="../new">
        <app-button variant="secondary"><ng-container i18n>Klassisches Formular</ng-container></app-button>
      </a>

      <div layout-content class="flex flex-1">
        @if (loading()) {
          <div class="flex flex-1 justify-center">
            <app-loading-spinner [fullPage]="true" i18n-text text="Daten werden geladen..." />
          </div>
        } @else {
          <div class="mx-auto w-full max-w-3xl pb-10">
            <form [formGroup]="form" (ngSubmit)="onFormSubmit()">
              <div class="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                <!-- Progress -->
                <div class="px-6 py-4">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400" i18n>
                      Schritt {{ stepNumber() }} von {{ totalSteps() }}
                    </span>
                    <a
                      [routerLink]="['/organizations', orgId(), 'submissions']"
                      class="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      i18n
                    >
                      Abbrechen
                    </a>
                  </div>
                  <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      class="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                      [style.width.%]="progressPercent()"
                    ></div>
                  </div>
                </div>

                <!-- Question -->
                <div class="p-6">
                  @switch (currentViewId()) {
                    <!-- ================================ INTRO ================================ -->
                    @case ('intro') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Belege einreichen – Schritt für Schritt
                      </h2>
                      <p class="mt-3 text-sm text-gray-600 dark:text-gray-300" i18n>
                        Wir stellen dir jetzt einige kurze Fragen zu deiner Ausgabe und deinen Belegen, z. B. ob es
                        sich um eine hoheitliche oder gewerbliche Ausgabe handelt, für welches Gremium du einreichst
                        und wie du das Geld erhalten möchtest. Aus deinen Antworten entsteht automatisch deine
                        Einreichung – ganz ohne Buchhaltungs-Vorwissen.
                      </p>
                      <p class="mt-2 text-sm text-gray-600 dark:text-gray-300" i18n>
                        Du kannst jederzeit über „Zurück“ vorherige Antworten korrigieren.
                      </p>

                      <div class="mt-5 rounded-md border-l-4 border-blue-600 bg-blue-50 p-4 dark:border-blue-500 dark:bg-blue-950/40">
                        <p class="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300" i18n>
                          Das solltest du bereithalten
                        </p>
                        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900 dark:text-blue-200">
                          <li i18n>
                            Deine Belege, z. B. Rechnungen, Kassenbons oder Fahrtkostennachweise
                          </li>
                          <li i18n>Die Beträge, die erstattet werden sollen</li>
                          <li i18n>
                            Deine Bankverbindung (IBAN), falls die Auszahlung per Überweisung erfolgen soll
                          </li>
                          <li i18n>Optional: Fotos oder Scans deiner Belege (PDF, JPG oder PNG)</li>
                        </ul>
                      </div>
                    }

                    <!-- ================================ DIRECTION ================================ -->
                    @case ('direction') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Was moechtest du einreichen?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          <strong>Ausgabe</strong>: Belege fuer etwas, das gekauft oder bezahlt wurde. Je nach
                          Zahlungsweise erfolgt eine Auszahlung oder nur die Dokumentation.
                        </li>
                        <li i18n>
                          <strong>Einnahme</strong>: Nachweise, wie der Studierendenschaft Geld zugeflossen ist, z. B.
                          Spenden oder Sponsoring. Es findet keine Auszahlung statt.
                        </li>
                      </app-assistant-info-box>

                      <div class="mt-5 grid grid-cols-1 gap-3">
                        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <input type="radio" formControlName="direction" value="expense" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                          <div>
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Ausgabe</span>
                            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>Erstattung, Dokumentation einer Gremiumsausgabe oder Zahlungsauftrag.</p>
                          </div>
                        </label>
                        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <input type="radio" formControlName="direction" value="income" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                          <div>
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Einnahme</span>
                            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>Dokumentation einer Einnahme – ohne Auszahlung.</p>
                          </div>
                        </label>
                      </div>
                      @if (showError('direction')) {
                        <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>Bitte waehle eine Art aus.</p>
                      }
                    }

                    <!-- ================================ SETTLEMENT ================================ -->
                    @case ('settlement') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Wie wurde die Ausgabe bezahlt?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          <strong>Privat vorgestreckt</strong>: Du hast selbst bezahlt und bekommst das Geld zurueck.
                        </li>
                        <li i18n>
                          <strong>Gremiumskonto/-kasse</strong>: Das Gremium hat ein eigenes Konto oder eine eigene Kasse
                          und hat die Ausgabe selbst bezahlt. Es gibt keine Auszahlung – nur Dokumentation.
                        </li>
                        <li i18n>
                          <strong>Zahlungsauftrag</strong>: Noch hat niemand bezahlt – die Kassenfuehrung ueberweist direkt
                          an den Empfaenger.
                        </li>
                      </app-assistant-info-box>

                      <div class="mt-5 space-y-3">
                        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <input type="radio" formControlName="settlement" value="person" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                          <div>
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Ich habe privat vorgestreckt (Auslagenerstattung)</span>
                          </div>
                        </label>
                        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <input
                            type="radio"
                            formControlName="settlement"
                            value="committee_account"
                            [disabled]="(selectedCommittee()?.paymentAccounts?.length ?? 0) === 0"
                            class="mt-0.5 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Vom Gremiumskonto / aus der Gremiumskasse bezahlt</span>
                            @if ((selectedCommittee()?.paymentAccounts?.length ?? 0) === 0) {
                              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                                Dieses Gremium hat kein eigenes Konto oder eine eigene Kasse hinterlegt.
                              </p>
                            }
                          </div>
                        </label>
                        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <input type="radio" formControlName="settlement" value="payment_request" class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                          <div>
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Zahlungsauftrag: die Kassenfuehrung soll zahlen</span>
                          </div>
                        </label>
                      </div>
                      @if (showError('settlement')) {
                        <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>Bitte waehle einen Abrechnungsweg aus.</p>
                      }
                    }

                    <!-- ================================ ACCOUNT PAID ================================ -->
                    @case ('accountPaid') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Womit und wann wurde bezahlt?
                      </h2>

                      <div class="mt-5 space-y-4" formGroupName="committeeAccountDetails">
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Konto / Kasse *</label>
                          <select formControlName="paymentAccountUid" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                            <option value="" i18n>Bitte auswaehlen...</option>
                            @for (account of selectedCommittee()?.paymentAccounts ?? []; track account.uid) {
                              <option [value]="account.uid">{{ account.label }}</option>
                            }
                          </select>
                          @if (showError('committeeAccountDetails.paymentAccountUid')) {
                            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>Bitte waehle das Konto aus.</p>
                          }
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Datum der Zahlung *</label>
                          <input type="date" formControlName="paidDate" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          @if (showError('committeeAccountDetails.paidDate')) {
                            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>Bitte gib das Zahlungsdatum an.</p>
                          }
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Zahlungsreferenz (optional)</label>
                          <input type="text" formControlName="paymentReference" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                        </div>
                      </div>
                    }

                    <!-- ================================ VENDOR DETAILS ================================ -->
                    @case ('vendorDetails') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Wer soll bezahlt werden?
                      </h2>

                      <div class="mt-5 space-y-4" formGroupName="paymentRequestDetails">
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Empfaenger (Name) *</label>
                          <input type="text" formControlName="vendorName" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          @if (showError('paymentRequestDetails.vendorName')) {
                            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>Bitte gib den Empfaenger an.</p>
                          }
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>IBAN *</label>
                          <input type="text" formControlName="vendorIban" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                          @if (showError('paymentRequestDetails.vendorIban')) {
                            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>Bitte gib die IBAN an.</p>
                          }
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>BIC (optional)</label>
                          <input type="text" formControlName="vendorBic" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Zahlungsart *</label>
                          <select formControlName="timing" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                            <option value="on_invoice" i18n>Zahlung auf Rechnung</option>
                            <option value="advance" i18n>Vorkasse</option>
                          </select>
                        </div>
                      </div>
                    }

                    <!-- ================================ SCOPE ================================ -->
                    @case ('scope') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Wird die Ausgabe hoheitlich oder gewerblich getätigt?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          Hoheitlich ist der Regelfall: Ausgaben für die Studierendenschaft und die Gremienarbeit,
                          z. B. Plakate für eine Veranstaltung, Büromaterial oder Getränke für eine Sitzung.
                        </li>
                        <li i18n>
                          Gewerblich gilt für Ausgaben eines (wirtschaftlichen) Geschäftsbetriebs, bei denen die
                          Vorsteuer angesetzt werden soll, z. B. Einkäufe für Bars oder Veranstaltungen, bei denen Dinge verkauft werden oder Entgelte erhoben werden.
                        </li>
                        <li i18n>
                          Im Zweifel wähle „Hoheitlich“ - wir melden uns, falls die Einreichung gewerblich behandelt werden muss.
                        </li>
                      </app-assistant-info-box>

                      <div class="mt-5 grid grid-cols-1 gap-3">
                        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <input
                            type="radio"
                            formControlName="submissionScope"
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
                            formControlName="submissionScope"
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
                            Bei gewerblicher Einreichung akzeptieren wir nur Rechnungen oder Kassenbons mit klar
                            identifizierbarer Adresse (ähnlich zu „XXX“, z. B. Musterstraße 1, 12345 Musterstadt).
                          </p>
                          <p class="mt-2" i18n>
                            Für Kassenbons über 250,00 € kann die enthaltene Steuer nicht als Vorsteuer angesetzt
                            werden. Reiche in diesem Fall bitte bevorzugt eine Rechnung ein.
                          </p>
                          <p class="mt-2" i18n>
                            Falls auf einem Beleg private und gewerbliche Einkäufe gemischt sind, berechne den zu
                            erstattenden Betrag bitte korrekt inklusive MwSt. Das spart Rückfragen und beschleunigt
                            die Prüfung.
                          </p>
                        </div>
                      }
                    }

                    <!-- ================================ COMMITTEE ================================ -->
                    @case ('committee') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Für welches Gremium reichst du ein?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          Das Gremium ist die Stelle, aus deren Haushalt deine Ausgabe erstattet wird, z. B. „AStA“
                          für Ausgaben des Allgemeinen Studierendenausschusses oder „StuPa“ für Ausgaben des
                          Studierendenparlaments.
                        </li>
                        <li i18n>
                          Du weißt es nicht sicher? Frag kurz in deinem Gremium nach – eine falsche Zuordnung
                          verzögert die Prüfung unsererseits.
                        </li>
                      </app-assistant-info-box>

                      <div class="mt-5">
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
                        @if (showError('committeeId')) {
                          <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>
                            Bitte wähle ein Gremium aus.
                          </p>
                        }
                        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400" i18n>
                          Hinweis: Einreichende Person bist du („Du“).
                        </p>
                      </div>
                    }

                    <!-- ================================ PAYMENT ================================ -->
                    @case ('payment') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Wie sollen wir dir den Betrag auszahlen?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          Überweisung: für Ausgaben, die du selbst im Geschäft oder online bezahlt hast - das Geld
                          geht auf dein Bankkonto.
                        </li>
                        <li i18n>Barzahlung: wenn du den Betrag in bar abholen möchtest, z. B. in unserem Büro.</li>
                        <li i18n>
                          Direktüberweisung an Rechnungssteller: wenn ein Anbieter auf Rechnung liefert und direkt
                          vom Verband bezahlt werden soll.
                        </li>
                        <li i18n>
                          Vorkasse: wenn eine Bestellung vorab bezahlt werden muss, bevor sie geliefert wird.
                        </li>
                      </app-assistant-info-box>

                      <div class="mt-5 space-y-3">
                        <label class="block cursor-pointer rounded-md border border-gray-200 p-3 dark:border-gray-700">
                          <div class="flex items-start gap-3">
                            <input
                              type="radio"
                              formControlName="paymentMethod"
                              value="bank_transfer"
                              class="mt-0.5 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <span class="text-sm font-medium text-gray-900 dark:text-gray-100" i18n>Überweisung (IBAN/BIC)</span>
                              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400" i18n>
                                Die Erstattung wird auf dein angegebenes Konto überwiesen.
                              </p>
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

                        </div>
                    }

                    <!-- ================================ BANK DETAILS ================================ -->
                    @case ('bankDetails') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Wie lautet die Bankverbindung für die Überweisung?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          Kontoinhaber ist die Person, die das Geld erhalten soll - in der Regel du selbst,
                          z. B. „Max Mustermann“.
                        </li>
                        <li i18n>
                          Die IBAN findest du auf deiner Bankkarte oder im Online-Banking, z. B.
                          „DE89 3704 0044 0532 0130 00“.
                        </li>
                        <li i18n>
                          Den BIC brauchst du nur bei Konten im Ausland, z. B. „BYLADEM1001“ - ansonsten kannst
                          du das Feld leer lassen.
                        </li>
                      </app-assistant-info-box>

                      <div formGroupName="bankDetails" class="mt-5 space-y-3">
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>Kontoinhaber *</label>
                          <input
                            type="text"
                            formControlName="accountHolder"
                            i18n-placeholder
                            placeholder="Max Mustermann"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          />
                          @if (showError('bankDetails.accountHolder')) {
                            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>
                              Bitte gib den Kontoinhaber an.
                            </p>
                          }
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">IBAN *</label>
                          <input
                            type="text"
                            formControlName="iban"
                            i18n-placeholder
                            placeholder="DE89 3704 0044 0532 0130 00"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          />
                          @if (showError('bankDetails.iban')) {
                            <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>
                              Bitte gib deine IBAN an.
                            </p>
                          }
                        </div>
                        <div>
                          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" i18n>BIC (optional)</label>
                          <input
                            type="text"
                            formControlName="bic"
                            i18n-placeholder
                            placeholder="BYLADEM1001"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          />
                        </div>
                      </div>

                      <label class="mt-3 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          formControlName="bankDetailsConfirmed"
                          class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <span i18n>Ich bestätige, dass die oben angegebene Bankverbindung korrekt ist.</span>
                      </label>
                      @if (showError('bankDetailsConfirmed')) {
                        <p class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" i18n>
                          Bitte bestätige die Richtigkeit der Bankverbindung.
                        </p>
                      }
                    }

                    <!-- ================================ RECEIPTS ================================ -->
                    @case ('receipt') {
                      <app-assistant-receipt-step
                        [section]="currentReceiptSection()"
                        [itemGroup]="currentItemGroup()"
                        [receiptNumber]="currentReceiptNumber()"
                        [receiptCount]="receiptCount()"
                        [attachmentName]="currentReceiptAttachmentName()"
                        [isPaper]="currentReceiptIsPaper()"
                        [commercialLimitWarning]="showCommercialReceiptLimitWarning()"
                        [validationAttempt]="validationAttempt()"
                      />
                    }

                    <!-- ================================ RECEIPT MORE ================================ -->
                    @case ('receiptMore') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Hast du weitere Belege für diese Einreichung?
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          Reiche alle Belege, die zusammengehören, in einer Einreichung ein, z. B. Copyshop-Bon
                          und Getränkerechnung für dieselbe Veranstaltung.
                        </li>
                        <li i18n>
                          Gehört ein Beleg zu einer anderen Ausgabe oder einem anderen Gremium, reiche ihn bitte
                          separat ein.
                        </li>
                      </app-assistant-info-box>
                    }

                    <!-- ================================ NOTICE ================================ -->
                    @case ('notice') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Gibt es sonst etwas, das wir bei der Prüfung wissen sollten? (optional)
                      </h2>

                      <app-assistant-info-box>
                        <li i18n>
                          z. B. „die Rechnung enthält private Anteile“, „das Papier-Original liegt bereits im
                          Büro“ oder „die Ausgabe gehört zur Veranstaltung ‚Campusfest‘ am 14.06.“
                        </li>
                      </app-assistant-info-box>

                      <textarea
                        formControlName="notice"
                        rows="4"
                        class="mt-5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                        i18n-placeholder
                        placeholder="Gib hier alle Hinweise ein, die für die Prüfung wichtig sind..."
                      ></textarea>
                    }

                    <!-- ================================ DECLARATIONS ================================ -->
                    @case ('declarations') {
                      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100" i18n>
                        Bitte bestätige abschließend die verbindlichen Erklärungen.
                      </h2>

                      <div class="mt-5 rounded-md border-l-4 border-slate-700 bg-slate-50 p-4 text-sm text-slate-800 dark:border-slate-400 dark:bg-gray-900/40 dark:text-slate-200">
                        <p i18n>
                          Mit dem Absenden bestätigst du verbindlich die Richtigkeit deiner Angaben und die
                          Nachvollziehbarkeit deiner eingereichten Unterlagen.
                        </p>
                      </div>

                      <div formGroupName="declarations" class="mt-5 space-y-3">
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

                      @if (showError('declarations')) {
                        <p class="mt-3 text-xs font-medium text-red-600 dark:text-red-400" i18n>
                          Bitte bestätige alle drei Erklärungen, um fortzufahren.
                        </p>
                      }
                    }

                    <!-- ================================ REVIEW ================================ -->
                    @case ('review') {
                      <app-assistant-review
                        [scopeLabel]="scopeLabel()"
                        [committeeName]="committeeName()"
                        [paymentMethodLabel]="settlementLabel()"
                        [requiresBankDetails]="requiresBankDetails()"
                        [bank]="bankSnapshot()"
                        [notice]="noticeText()"
                        [snapshots]="receiptSnapshots()"
                        [totalAmountCents]="totalAmount()"
                        [paperOriginalWarning]="hasPaperOriginalSubmissionWarning()"
                        [commercialReceiptWarning]="hasCommercialReceiptSubmissionWarning()"
                        [hasSubmittableBillType]="hasSubmittableBillType()"
                        (editStep)="goToStep($event)"
                        (editReceipt)="goToReceipt($event)"
                        (addReceipt)="addReceiptFromReview()"
                        (removeReceipt)="removeReceipt($event)"
                      />
                    }
                  }
                </div>

                <!-- Navigation -->
                <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  @if (currentStep().id !== 'intro') {
                    <app-button variant="secondary" (clicked)="back()">
                      <ng-container i18n>Zurück</ng-container>
                    </app-button>
                  } @else {
                    <span></span>
                  }

                  @switch (currentStep().id) {
                    @case ('intro') {
                      <app-button variant="primary" (clicked)="next()">
                        <ng-container i18n>Los geht's</ng-container>
                      </app-button>
                    }
                    @case ('receiptMore') {
                      <div class="flex flex-wrap items-center justify-end gap-3">
                        <app-button variant="secondary" (clicked)="next()">
                          <ng-container i18n>Nein, alle Belege erfasst</ng-container>
                        </app-button>
                        <app-button variant="primary" (clicked)="addReceiptAndContinue()">
                          <ng-container i18n>Ja, weiteren Beleg hinzufügen</ng-container>
                        </app-button>
                      </div>
                    }
                    @case ('declarations') {
                      <app-button variant="primary" (clicked)="next()">
                        <ng-container i18n>Weiter zur Übersicht</ng-container>
                      </app-button>
                    }
                    @case ('review') {
                      <app-button
                        variant="primary"
                        (clicked)="submit()"
                        [disabled]="saving() || !form.valid || invoiceItems.length === 0 || !hasSubmittableBillType()"
                      >
                        <ng-container i18n>Einreichung absenden</ng-container>
                      </app-button>
                    }
                    @default {
                      <app-button variant="primary" (clicked)="next()">
                        <ng-container i18n>Weiter</ng-container>
                      </app-button>
                    }
                  }
                </div>
              </div>
            </form>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class SubmissionAssistantComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(SubmissionNewDataService);
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
  readonly orgId = signal('');
  readonly cursor = signal(0);
  readonly receiptCount = signal(0);
  readonly selectedPaymentMethod = signal<PayoutMethod>('bank_transfer');
  readonly selectedSubmissionScope = signal<SubmissionScope>('hoheitlich');
  readonly selectedCommitteeId = signal('');
  readonly noticeText = signal('');
  readonly bankSnapshot = signal({ accountHolder: '', iban: '', bic: '' });
  readonly totalAmount = signal(0);
  readonly receiptSnapshots = signal<ReceiptSnapshot[]>([]);
  readonly hasPaperOriginalSubmissionWarning = signal(false);
  readonly hasCommercialReceiptSubmissionWarning = signal(false);
  readonly hasSubmittableBillType = signal(false);
  readonly hasSubmissionWarnings = computed(
    () => this.hasPaperOriginalSubmissionWarning() || this.hasCommercialReceiptSubmissionWarning()
  );
  readonly validationAttempt = signal(0);

  readonly form = this.fb.group({
    submissionScope: ['hoheitlich' as SubmissionScope],
    committeeId: ['', Validators.required],
    direction: ['expense' as 'expense' | 'income', Validators.required],
    settlement: ['person' as 'person' | 'committee_account' | 'payment_request'],
    committeeAccountDetails: this.fb.group({
      paymentAccountUid: [''],
      paidDate: [''],
      paymentReference: [''],
    }),
    paymentRequestDetails: this.fb.group({
      vendorName: [''],
      vendorIban: [''],
      vendorBic: [''],
      timing: ['on_invoice' as 'on_invoice' | 'advance'],
    }),
    paymentMethod: ['bank_transfer' as PayoutMethod],
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
    { label: $localize`Belegeinreichungen`, path: '' },
    { label: $localize`Belege einreichen (Assistent)` },
  ];

  get invoiceItems(): FormArray {
    return this.form.get('invoiceItems') as FormArray;
  }

  // --- Wizard steps -------------------------------------------------------

  readonly steps = computed<WizardStep[]>(() => {
    const steps: WizardStep[] = [
      { id: 'intro' },
      { id: 'committee' },
      { id: 'direction' },
    ];
    if (this.scopeSelectable()) {
      steps.push({ id: 'scope' });
    }
    if (this.selectedDirection() === 'expense') {
      steps.push({ id: 'settlement' });
      switch (this.selectedSettlement()) {
        case 'committee_account':
          steps.push({ id: 'accountPaid' });
          break;
        case 'payment_request':
          steps.push({ id: 'vendorDetails' });
          break;
        default:
          steps.push({ id: 'payment' });
          if (this.selectedPaymentMethod() === 'bank_transfer') {
            steps.push({ id: 'bankDetails' });
          }
      }
    }
    for (let i = 0; i < this.receiptCount(); i++) {
      steps.push(
        { id: 'receiptCategory', receiptIndex: i },
        { id: 'receiptForm', receiptIndex: i },
        { id: 'receiptAmount', receiptIndex: i },
        { id: 'receiptExtras', receiptIndex: i },
      );
    }
    steps.push({ id: 'receiptMore' }, { id: 'notice' }, { id: 'declarations' }, { id: 'review' });
    return steps;
  });

  readonly currentStep = computed<WizardStep>(() => {
    const steps = this.steps();
    return steps[Math.min(this.cursor(), steps.length - 1)];
  });

  readonly stepNumber = computed(() => Math.min(this.cursor(), this.steps().length - 1) + 1);
  readonly totalSteps = computed(() => this.steps().length);
  readonly progressPercent = computed(() => (this.stepNumber() / this.totalSteps()) * 100);

  readonly currentReceiptIndex = computed(() => this.currentStep().receiptIndex ?? 0);
  readonly currentReceiptNumber = computed(() => this.currentReceiptIndex() + 1);

  // The four per-receipt questions share one rendered step component, so the
  // template's @switch keys off this normalized id instead of the raw step id.
  readonly currentViewId = computed<StepId | 'receipt'>(() => {
    switch (this.currentStep().id) {
      case 'receiptCategory':
      case 'receiptForm':
      case 'receiptAmount':
      case 'receiptExtras':
        return 'receipt';
      default:
        return this.currentStep().id;
    }
  });

  readonly currentReceiptSection = computed<ReceiptStepSection>(() => {
    switch (this.currentStep().id) {
      case 'receiptCategory':
        return 'category';
      case 'receiptForm':
        return 'form';
      case 'receiptAmount':
        return 'amount';
      default:
        return 'extras';
    }
  });

  readonly currentItemGroup = computed(
    () => this.invoiceItems.at(this.currentReceiptIndex()) as FormGroup
  );

  // --- Derived display state ----------------------------------------------

  readonly requiresBankDetails = computed(
    () => this.selectedPaymentMethod() === 'bank_transfer'
  );
  readonly isCommercial = computed(() => this.selectedSubmissionScope() === 'gewerblich');
  readonly scopeLabel = computed(() =>
    this.selectedSubmissionScope() === 'gewerblich' ? $localize`Gewerblich` : $localize`Hoheitlich`
  );
  readonly selectedDirection = signal<'expense' | 'income'>('expense');
  readonly selectedSettlement = signal<'person' | 'committee_account' | 'payment_request'>('person');
  readonly selectedCommittee = computed(
    () => this.committees().find((c) => c.id === this.selectedCommitteeId()) ?? null
  );
  readonly scopeSelectable = computed(() => this.selectedCommittee()?.allowScopeSelection === true);
  readonly isExpense = computed(() => this.selectedDirection() === 'expense');
  readonly settlementLabel = computed(() => {
    if (this.selectedDirection() === 'income') return $localize`Einnahme (keine Auszahlung)`;
    switch (this.selectedSettlement()) {
      case 'committee_account':
        return $localize`Bereits vom Gremiumskonto bezahlt`;
      case 'payment_request':
        return $localize`Zahlungsauftrag an die Kassenfuehrung`;
      default:
        return this.selectedPaymentMethod() === 'cash'
          ? $localize`Barauszahlung`
          : $localize`Ueberweisung auf dein Konto`;
    }
  });
  readonly committeeName = computed(
    () => this.committees().find((c) => c.id === this.selectedCommitteeId())?.name ?? ''
  );

  readonly currentReceiptIsPaper = computed(() => {
    const snapshot = this.receiptSnapshots()[this.currentReceiptIndex()];
    return snapshot?.documentForm === 'paper_original';
  });

  readonly currentReceiptAttachmentName = computed(
    () => this.receiptSnapshots()[this.currentReceiptIndex()]?.attachmentName ?? null
  );

  readonly showCommercialReceiptLimitWarning = computed(() => {
    if (this.selectedSubmissionScope() !== 'gewerblich') return false;
    const snapshot = this.receiptSnapshots()[this.currentReceiptIndex()];
    return (
      snapshot?.receiptCategory === 'quittung_kassenbon' && (snapshot?.amountCents || 0) > 25000
    );
  });

  ngOnInit(): void {
    const orgId = this.getOrgId();
    this.orgId.set(orgId);
    this.breadcrumbs[0].path = `/organizations/${orgId}/submissions`;
    this.loadData();
    this.setupBankValidation();
    this.setupFormWatchers();
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

    const applyValidation = (method: PayoutMethod | null | undefined) => {
      const currentMethod = (method ?? 'bank_transfer') as PayoutMethod;
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

    applyValidation(paymentControl?.value as PayoutMethod);
    paymentControl?.valueChanges.subscribe((method) => applyValidation(method as PayoutMethod));
  }

  private setupFormWatchers(): void {
    this.form.get('submissionScope')?.valueChanges.subscribe((scope) => {
      this.selectedSubmissionScope.set((scope as SubmissionScope) ?? 'hoheitlich');
      this.updateSubmissionWarnings();
    });

    this.form.get('committeeId')?.valueChanges.subscribe((id) => {
      this.selectedCommitteeId.set(id ?? '');
    });

    this.form.get('direction')?.valueChanges.subscribe((direction) => {
      this.selectedDirection.set((direction as 'expense' | 'income') ?? 'expense');
    });

    this.form.get('settlement')?.valueChanges.subscribe((settlement) => {
      this.selectedSettlement.set(
        (settlement as 'person' | 'committee_account' | 'payment_request') ?? 'person'
      );
    });

    this.form.get('notice')?.valueChanges.subscribe((notice) => {
      this.noticeText.set(notice ?? '');
    });

    this.form.get('bankDetails')?.valueChanges.subscribe((bank) => {
      this.bankSnapshot.set({
        accountHolder: bank?.accountHolder ?? '',
        iban: bank?.iban ?? '',
        bic: bank?.bic ?? '',
      });
    });

    this.updateInvoiceDerivedState();
    this.invoiceItems.valueChanges.subscribe(() => this.updateInvoiceDerivedState());
  }

  private updateInvoiceDerivedState(): void {
    const items = (this.invoiceItems.value as InvoiceItemForm[] | null) ?? [];

    this.receiptSnapshots.set(
      items.map((item) => ({
        receiptCategory: item.receiptCategory,
        documentForm: item.documentForm,
        description: item.description ?? '',
        amountCents: Math.round((Number(item.amount) || 0) * 100),
        attachmentName: item.attachment?.name ?? null,
      })),
    );

    this.totalAmount.set(items.reduce((acc, item) => acc + (Number(item.amount) || 0) * 100, 0));
    this.updateSubmissionWarnings();
  }

  private updateSubmissionWarnings(): void {
    const items = (this.invoiceItems.value as InvoiceItemForm[] | null) ?? [];

    this.hasSubmittableBillType.set(
      items.some(
        (item) => item.receiptCategory === 'rechnung'
          || item.receiptCategory === 'quittung_kassenbon'
          || item.receiptCategory === 'eigenbeleg'
          || item.receiptCategory === 'fahrtkostennachweis'
          || item.receiptCategory === 'sonstige',
      ),
    );

    this.hasPaperOriginalSubmissionWarning.set(
      items.some((item) => item.documentForm === 'paper_original'),
    );

    this.hasCommercialReceiptSubmissionWarning.set(
      this.selectedSubmissionScope() === 'gewerblich'
        && items.some((item) => item.receiptCategory === 'quittung_kassenbon'),
    );
  }

  // --- Navigation ---------------------------------------------------------

  next(): void {
    if (!this.validateCurrentStep()) return;
    this.cursor.set(Math.min(this.cursor() + 1, this.steps().length - 1));
  }

  back(): void {
    this.cursor.set(Math.max(this.cursor() - 1, 0));
  }

  goToStep(id: StepId): void {
    const index = this.steps().findIndex((step) => step.id === id);
    if (index >= 0) {
      this.cursor.set(index);
    }
  }

  goToReceipt(receiptIndex: number): void {
    const index = this.steps().findIndex(
      (step) => step.id === 'receiptCategory' && step.receiptIndex === receiptIndex,
    );
    if (index >= 0) {
      this.cursor.set(index);
    }
  }

  addReceiptAndContinue(): void {
    // The new receipt's steps are inserted at the current cursor position
    // (which points at 'receiptMore'), so the cursor now lands on the new
    // receipt's first question automatically.
    this.addInvoiceItem();
  }

  addReceiptFromReview(): void {
    this.addInvoiceItem();
    this.goToReceipt(this.receiptCount() - 1);
  }

  private validateCurrentStep(): boolean {
    const step = this.currentStep();
    const paths: string[] = [];

    switch (step.id) {
      case 'committee':
        paths.push('committeeId');
        break;
      case 'direction':
        paths.push('direction');
        break;
      case 'settlement':
        if (this.selectedDirection() === 'expense') paths.push('settlement');
        break;
      case 'accountPaid':
        paths.push('committeeAccountDetails.paymentAccountUid', 'committeeAccountDetails.paidDate');
        break;
      case 'vendorDetails':
        paths.push(
          'paymentRequestDetails.vendorName',
          'paymentRequestDetails.vendorIban',
          'paymentRequestDetails.timing'
        );
        break;
      case 'bankDetails':
        paths.push('bankDetails.accountHolder', 'bankDetails.iban', 'bankDetailsConfirmed');
        break;
      case 'receiptCategory':
        paths.push(this.receiptControlPath('receiptCategory'));
        break;
      case 'receiptAmount':
        paths.push(this.receiptControlPath('amount'));
        break;
      case 'declarations':
        paths.push('declarations');
        break;
    }

    let valid = true;
    for (const path of paths) {
      const control = this.form.get(path);
      if (!control) continue;
      if (control instanceof FormGroup) {
        control.markAllAsTouched();
      } else {
        control.markAsTouched();
      }
      if (control.invalid) valid = false;
    }

    if (!valid) this.validationAttempt.update((v) => v + 1);
    return valid;
  }

  showError(path: string): boolean {
    void this.validationAttempt();
    const control = this.form.get(path);
    return !!control && control.invalid && control.touched;
  }

  receiptControlPath(controlName: string): string {
    return `invoiceItems.${this.currentReceiptIndex()}.${controlName}`;
  }

  // --- Receipts -----------------------------------------------------------

  addInvoiceItem(): void {
    const itemGroup = this.fb.group({
      documentForm: ['paper_original' as Belegform, Validators.required],
      receiptCategory: ['', Validators.required],
      description: [''],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      attachment: [null as File | null],
    });
    this.invoiceItems.push(itemGroup);
    this.receiptCount.set(this.invoiceItems.length);
    this.updateInvoiceDerivedState();
  }

  removeReceipt(index: number): void {
    if (this.invoiceItems.length <= 1) return;
    this.invoiceItems.removeAt(index);
    this.receiptCount.set(this.invoiceItems.length);
    this.updateInvoiceDerivedState();
    this.cursor.set(this.steps().length - 1);
  }

  // --- Submission ---------------------------------------------------------

  onFormSubmit(): void {
    if (this.currentStep().id === 'review') {
      this.submit();
    } else {
      this.next();
    }
  }

  submit(): void {
    if (!this.form.valid || this.invoiceItems.length === 0 || !this.hasSubmittableBillType()) return;

    this.saving.set(true);
    const formValue = this.form.value;

    const direction = (formValue.direction ?? 'expense') as 'expense' | 'income';
    const scope: SubmissionScope = this.scopeSelectable()
      ? ((formValue.submissionScope ?? 'hoheitlich') as SubmissionScope)
      : 'hoheitlich';

    const settlement: SettlementPayload | null =
      direction === 'income'
        ? null
        : this.selectedSettlement() === 'committee_account'
          ? {
              kind: 'committee_account',
              paymentAccountUid: formValue.committeeAccountDetails?.paymentAccountUid || '',
              paidDate: formValue.committeeAccountDetails?.paidDate
                ? new Date(formValue.committeeAccountDetails.paidDate)
                : null,
              paymentReference: formValue.committeeAccountDetails?.paymentReference || null,
            }
          : this.selectedSettlement() === 'payment_request'
            ? {
                kind: 'payment_request',
                vendorName: formValue.paymentRequestDetails?.vendorName || '',
                vendorIban: formValue.paymentRequestDetails?.vendorIban || '',
                vendorBic: formValue.paymentRequestDetails?.vendorBic || null,
                timing: (formValue.paymentRequestDetails?.timing || 'on_invoice') as 'on_invoice' | 'advance',
              }
            : {
                kind: 'person',
                payoutMethod: (formValue.paymentMethod as 'bank_transfer' | 'cash') ?? 'bank_transfer',
                bankDetails:
                  formValue.paymentMethod === 'bank_transfer'
                    ? {
                        accountHolder: formValue.bankDetails?.accountHolder || '',
                        iban: formValue.bankDetails?.iban || '',
                        bic: formValue.bankDetails?.bic || null,
                      }
                    : null,
              };

    const items = (formValue.invoiceItems as InvoiceItemForm[] || []).map((item) => ({
      category: item.receiptCategory,
      documentForm: item.documentForm,
      source: null,
      description: item.description?.trim() || null,
      amount: Math.round((Number(item.amount) || 0) * 100),
    }));

    this.dataService
      .createSubmissionDraft({
        committeeId: formValue.committeeId!,
        direction,
        settlement,
        scope,
        notice: (formValue.notice || '').trim() || null,
        items,
      })
      .pipe(switchMap((draft) => this.dataService.submitSubmission(draft.id)))
      .subscribe({
        next: (submission) => {
          this.saving.set(false);
          this.router.navigate(['/organizations', this.orgId(), 'submissions', submission.id]);
        },
        error: () => {
          this.saving.set(false);
          this.notifications.error($localize`Fehler beim Erstellen der Einreichung`);
        },
      });
  }
}
