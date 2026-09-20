import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  StatusBadgeComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import {
  Submission,
  SubmissionComment,
  SubmissionAuditEntry,
  SubmissionStatus,
  getSubmissionStatusLabel,
  getSubmissionStatusVariant,
  getSettlementLabel,
  getPaymentRequestTimingLabel,
  formatCurrency,
} from '../../../shared/models';
import { SubmissionEditDataService } from './submission-edit.data-service';

type ActivityItem =
  | { type: 'comment'; data: SubmissionComment; timestamp: Date }
  | { type: 'audit'; data: SubmissionAuditEntry; timestamp: Date };

@Component({
  selector: 'app-submission-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs()">
      <div layout-header-actions class="flex gap-2">
          @if (canEdit()) {
            <app-button variant="primary" (clicked)="save()" [disabled]="saving()">
              <ng-container i18n>Speichern</ng-container>
            </app-button>
          }
      </div>

      <div layout-content>
        @if (loading()) {
          <div class="flex flex-1 justify-center">
            <app-loading-spinner [fullPage]="true" i18n-text text="Kostenerstattung wird geladen..." />
          </div>
        } @else if (submission()) {
          <div class="w-full max-w-4xl mx-auto space-y-4">
            <!-- Main Content -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Left Column: Invoice Items -->
              <div class="lg:col-span-2 space-y-4">
                <!-- Notice -->
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2" i18n>Anmerkung</h2>
                  <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ submission()?.notice ?? "-" }}</p>
                </div>

                <!-- Invoice Items -->
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100" i18n>Belege</h2>
                  </div>

                  @if (submission()!.items.length === 0) {
                    <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4" i18n>Keine Belege vorhanden.</p>
                  } @else {
                    <div class="space-y-4">
                      @for (item of submission()!.items; track item.id) {
                        <div class="rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                          <div class="flex items-start justify-between mb-3">
                            <div>
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.publicId }}</span>
                                <span
                                  [class]="'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'"
                                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                >
                                  {{ item.category }}
                                </span>
                                @if (item.documentForm === 'paper_original') {
                                  @if (item.originalReceived) {
                                    <span class="text-xs text-green-600 dark:text-green-400" i18n>Original erhalten</span>
                                  } @else {
                                    <span class="text-xs text-orange-600 dark:text-orange-400" i18n>Original ausstehend</span>
                                  }
                                }
                              </div>
                              @if (item.description) {
                                <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">{{ item.description }}</p>
                              }
                            </div>
                            <div class="text-right">
                              <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {{ formatCurrency(item.amount) }}
                              </span>
                            </div>
                          </div>

                          <!-- Receipt Warning -->
                          @if (!item.originalReceived) {
                            <div class="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-md p-3 mb-3">
                              <p class="text-xs text-orange-800 dark:text-orange-300" i18n>
                                Kassenbons müssen im Original eingereicht werden. Ein Screenshot oder Foto ist nicht ausreichend.
                              </p>
                            </div>
                          }

                          <!-- Attachments -->
                          <div class="mt-3">
                            <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2" i18n>Anhänge</h4>
                            @if (item.attachments.length === 0) {
                              <p class="text-xs text-gray-500 dark:text-gray-400" i18n>Keine Anhänge</p>
                            } @else {
                              <ul class="space-y-1">
                                @for (attachment of item.attachments; track attachment.id) {
                                  <li class="flex items-center gap-2 text-xs">
                                    <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span class="text-blue-600 hover:underline cursor-pointer dark:text-blue-400">
                                      {{ attachment.fileName }}
                                    </span>
                                    <span class="text-gray-400 dark:text-gray-500">
                                      ({{ formatFileSize(attachment.fileSize) }})
                                    </span>
                                  </li>
                                }
                              </ul>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <!-- Total -->
                    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                      <div class="text-right">
                        <span class="text-sm text-gray-500 dark:text-gray-400" i18n>Gesamtbetrag</span>
                        <span class="text-lg font-semibold text-gray-900 dark:text-gray-100 block">
                          {{ formatCurrency(submission()!.totalAmount) }}
                        </span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Activity Feed - Combined Comments & Audit Log (oldest first) -->
                <div>
                  <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-6" i18n>Aktivität</h2>

                  @if (activityFeed().length === 0) {
                    <p class="text-sm text-gray-500 dark:text-gray-400 py-4" i18n>Keine Aktivität vorhanden.</p>
                  } @else {
                    <div class="flow-root">
                      <ul role="list" class="-mb-8">
                        @for (item of visibleActivityFeed(); track item.data.id; let isLast = $last) {
                          <li>
                            <div class="relative pb-8">
                              @if (!isLast || (activityFeed().length > 10 && !showAllActivity())) {
                                <span class="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                              }
                              <div class="relative flex space-x-3">
                                @if (item.type === 'comment') {
                                  <!-- Comment Item -->
                                  <div>
                                    @if (item.data.statusChange) {
                                      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                                        <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                        </svg>
                                      </span>
                                    } @else if (item.data.isAdminOnly) {
                                      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500">
                                        <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                      </span>
                                    } @else {
                                      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-400">
                                        <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                        </svg>
                                      </span>
                                    }
                                  </div>
                                  <div class="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                    <div class="flex-1">
                                      <p class="text-sm text-gray-500 dark:text-gray-400">
                                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ item.data.authorUserFullName }}</span>
                                        <span class="ml-1" i18n>hat kommentiert</span>
                                        @if (item.data.isAdminOnly) {
                                          <span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" i18n>
                                            Intern
                                          </span>
                                        }
                                      </p>
                                      @if (item.data.statusChange) {
                                        <div class="mt-2 flex items-center gap-2">
                                          <app-status-badge [variant]="getStatusVariant(item.data.statusChange.from)" size="sm">
                                            {{ getStatusLabel(item.data.statusChange.from) }}
                                          </app-status-badge>
                                          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                          </svg>
                                          <app-status-badge [variant]="getStatusVariant(item.data.statusChange.to)" size="sm">
                                            {{ getStatusLabel(item.data.statusChange.to) }}
                                          </app-status-badge>
                                        </div>
                                      }
                                      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ item.data.content }}</p>
                                    </div>
                                    <div class="whitespace-nowrap text-right text-xs text-gray-500 dark:text-gray-400">
                                      {{ formatDateTime(item.data.createdAt) }}
                                    </div>
                                  </div>
                                } @else {
                                  <!-- Audit Item -->
                                  <div class="relative">
                                    <span [class]="getAuditIconClass(item.data.action)" class="flex h-8 w-8 items-center justify-center rounded-full">
                                      @switch (item.data.action) {
                                        @case ('create') {
                                          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                          </svg>
                                        }
                                        @case ('update') {
                                          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                          </svg>
                                        }
                                        @case ('status_change') {
                                          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                          </svg>
                                        }
                                        @case ('add_comment') {
                                          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                          </svg>
                                        }
                                        @case ('delete') {
                                          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                          </svg>
                                        }
                                        @default {
                                          <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        }
                                      }
                                    </span>
                                  </div>
                                  <div class="min-w-0 flex-1 pt-1.5">
                                    <p class="text-sm text-gray-500 dark:text-gray-400">
                                      <span class="font-medium text-gray-900 dark:text-gray-100">{{ item.data.actorUserFullName }}</span>
                                      <span class="ml-1">{{ getAuditActionLabel(item.data.action) }}</span>
                                    </p>
                                    @if (item.data.fieldName && item.data.oldValue && item.data.newValue) {
                                      <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                        {{ item.data.fieldName }}: {{ item.data.oldValue }} → {{ item.data.newValue }}
                                      </p>
                                    }
                                    <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ formatDateTime(item.data.timestamp) }}</p>
                                  </div>
                                }
                              </div>
                            </div>
                          </li>
                        }
                      </ul>
                    </div>
                    @if (activityFeed().length > 10 && !showAllActivity()) {
                      <button
                        (click)="toggleShowAllActivity()"
                        class="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <ng-container i18n>Alle anzeigen ({{ activityFeed().length }})</ng-container>
                      </button>
                    }
                    @if (showAllActivity() && activityFeed().length > 10) {
                      <button
                        (click)="toggleShowAllActivity()"
                        class="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <ng-container i18n>Weniger anzeigen</ng-container>
                      </button>
                    }
                  }

                  <!-- Add Comment Form -->
                  <div class="mt-6 flex gap-3">
                    <div class="flex-shrink-0">
                      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                        <svg class="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </span>
                    </div>
                    <div class="flex-1">
                      <textarea
                        [formControl]="newCommentControl"
                        rows="3"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                        i18n-placeholder
                        placeholder="Kommentar hinzufügen..."
                      ></textarea>
                      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <label class="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            [checked]="isAdminOnlyComment()"
                            (change)="isAdminOnlyComment.set($any($event.target).checked)"
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                          />
                          <span class="text-sm text-gray-600 dark:text-gray-400" i18n>Intern</span>
                        </label>
                        <div class="flex items-center gap-2">
                          <select
                            [value]="selectedStatusChange()"
                            (change)="selectedStatusChange.set($any($event.target).value)"
                            class="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="" i18n>Nur Kommentar</option>
                            @for (option of availableStatusTransitions(); track option.status) {
                              <option [value]="option.status">{{ option.label }}</option>
                            }
                          </select>
                          <app-button
                            variant="secondary"
                            size="sm"
                            (clicked)="addComment()"
                            [disabled]="!newCommentControl.value?.trim()"
                          >
                            <ng-container i18n>Senden</ng-container>
                          </app-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Sidebar -->
              <div class="space-y-6">
                <!-- Details -->
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3" i18n>Details</h3>
                  <dl class="space-y-3">
                    <div>
                      <dt class="text-xs text-gray-500 dark:text-gray-400" i18n>Status</dt>
                      <dd class="mt-1">
                        <app-status-badge [variant]="getStatusVariant(submission()!.status)" size="md">
                          {{ getStatusLabel(submission()!.status) }}
                        </app-status-badge>
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-gray-500 dark:text-gray-400" i18n>Eingereicht von</dt>
                      <dd class="text-sm text-gray-900 dark:text-gray-100 font-medium">{{ submission()!.createdByUserFullName }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-gray-500 dark:text-gray-400" i18n>Eingereicht am</dt>
                      <dd class="text-sm text-gray-900 dark:text-gray-100">{{ formatDate(submission()!.createdAt) }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-gray-500 dark:text-gray-400" i18n>Gremium</dt>
                      <dd class="text-sm text-gray-900 dark:text-gray-100 font-medium">{{ submission()!.committeeName }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-gray-500 dark:text-gray-400" i18n>Abrechnungsweg</dt>
                      <dd class="text-sm text-gray-900 dark:text-gray-100">
                        @if (submission()!.settlement) {
                          {{ getSettlementLabel(submission()!.settlement!) }}
                        } @else {
                          <span i18n>Keine (Einnahme)</span>
                        }
                      </dd>
                    </div>
                  </dl>
                </div>

                <!-- Person settlement payout details -->
                @if (submission()!.personSettlement?.bankDetails) {
                  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3" i18n>Bankverbindung</h3>
                    <dl class="space-y-3">
                      <div>
                        <dt class="text-xs text-gray-500 dark:text-gray-400" i18n>Kontoinhaber</dt>
                        <dd class="text-sm text-gray-900 dark:text-gray-100">{{ submission()!.personSettlement!.bankDetails!.accountHolder }}</dd>
                      </div>
                      <div>
                        <dt class="text-xs text-gray-500 dark:text-gray-400">IBAN</dt>
                        <dd class="text-sm text-gray-900 dark:text-gray-100 font-mono">{{ submission()!.personSettlement!.bankDetails!.iban }}</dd>
                      </div>
                      @if (submission()!.personSettlement!.bankDetails!.bic) {
                        <div>
                          <dt class="text-xs text-gray-500 dark:text-gray-400">BIC</dt>
                          <dd class="text-sm text-gray-900 dark:text-gray-100 font-mono">{{ submission()!.personSettlement!.bankDetails!.bic }}</dd>
                        </div>
                      }
                    </dl>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class SubmissionEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(SubmissionEditDataService);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submission = signal<Submission | null>(null);
  readonly comments = signal<SubmissionComment[]>([]);
  readonly auditLog = signal<SubmissionAuditEntry[]>([]);
  readonly showAllActivity = signal(false);

  readonly newCommentControl = this.fb.control('');
  readonly isAdminOnlyComment = signal(false);
  readonly selectedStatusChange = signal<SubmissionStatus | ''>('');
  // exposed for the template
  readonly getSettlementLabel = getSettlementLabel;
  readonly getPaymentRequestTimingLabel = getPaymentRequestTimingLabel;

  readonly canEdit = computed(() => {
    const r = this.submission();
    return r ? r.status === 'pending' || r.status === 'further_info_required' : false;
  });

  readonly availableStatusTransitions = computed<{ status: SubmissionStatus; label: string }[]>(() => {
    const submission = this.submission();
    if (!submission) return [];

    const transitions: Record<SubmissionStatus, { status: SubmissionStatus; label: string }[]> = {
      draft: [
        { status: 'pending', label: $localize`→ Einreichen` },
      ],
      approved: [
        { status: 'completed', label: $localize`→ Abgeschlossen (Zahlung veranlasst)` },
      ],
      pending: [
        { status: 'further_info_required', label: $localize`→ Weitere Informationen erforderlich` },
        { status: 'completed', label: $localize`→ Abgeschlossen` },
        { status: 'rejected', label: $localize`→ Abgelehnt` },
      ],
      further_info_required: [
        { status: 'pending', label: $localize`→ Ausstehend` },
        { status: 'completed', label: $localize`→ Abgeschlossen` },
        { status: 'rejected', label: $localize`→ Abgelehnt` },
      ],
      rejected: [],
      completed: [],
    };

    return transitions[submission.status] || [];
  });

  readonly activityFeed = computed<ActivityItem[]>(() => {
    const commentItems: ActivityItem[] = this.comments().map((comment) => ({
      type: 'comment' as const,
      data: comment,
      timestamp: new Date(comment.createdAt),
    }));

    const auditItems: ActivityItem[] = this.auditLog().map((auditEntry) => ({
      type: 'audit' as const,
      data: auditEntry,
      timestamp: new Date(auditEntry.timestamp),
    }));

    const combined = [...commentItems, ...auditItems];
    return combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  });

  readonly visibleActivityFeed = computed(() => {
    const feed = this.activityFeed();
    if (this.showAllActivity() || feed.length <= 10) {
      return feed;
    }
    return feed.slice(0, 10);
  });

  private orgId = '';

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const r = this.submission();
    return [
      { label: $localize`Belegeinreichungen`, path: `/organizations/${this.orgId}/submissions` },
      { label: r ? r.publicId : '...' },
    ];
  });

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSubmission(id);
    }
  }

  private loadSubmission(id: string): void {
    this.dataService.getSubmission(id).subscribe({
      next: (submission) => {
        this.submission.set(submission);
        this.loading.set(false);
        this.loadComments(id);
        this.loadAuditLog(id);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Erstattung`);
      },
    });
  }

  private loadComments(id: string): void {
    this.dataService.getComments(id).subscribe({
      next: (comments) => this.comments.set(comments),
    });
  }

  private loadAuditLog(id: string): void {
    this.dataService.getAuditLog(id).subscribe({
      next: (log) => this.auditLog.set(log),
    });
  }

  save(): void {
    // TODO: Implement save functionality
  }

  addComment(): void {
    const r = this.submission();
    const content = this.newCommentControl.value?.trim();
    if (!r || !content) return;

    const newStatus = this.selectedStatusChange();

    if (newStatus) {
      this.dataService
        .changeStatus(r.id, newStatus, content)
        .subscribe({
          next: (updatedSubmission) => {
            this.submission.set(updatedSubmission);
            this.newCommentControl.reset();
            this.isAdminOnlyComment.set(false);
            this.selectedStatusChange.set('');
            this.loadComments(r.id);
            this.loadAuditLog(r.id);
          },
        });
      return;
    }

    this.dataService
      .addComment(r.id, { content, isAdminOnly: this.isAdminOnlyComment() })
      .subscribe({
        next: (comment) => {
          this.comments.update((c) => [...c, comment]);
          this.newCommentControl.reset();
          this.isAdminOnlyComment.set(false);
        },
      });
  }

  getStatusLabel(status: SubmissionStatus): string {
    return getSubmissionStatusLabel(status);
  }

  getStatusVariant(status: SubmissionStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
    return getSubmissionStatusVariant(status);
  }

  getItemTypeLabel(type: string): string {
    return type;
  }

  formatCurrency(cents: number): string {
    return formatCurrency(cents);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  toggleShowAllActivity(): void {
    this.showAllActivity.update((value) => !value);
  }

  getAuditIconClass(action: string): string {
    const classes: Record<string, string> = {
      create: 'bg-green-500',
      update: 'bg-blue-500',
      status_change: 'bg-purple-500',
      add_comment: 'bg-gray-500',
      delete: 'bg-red-500',
      add_attachment: 'bg-teal-500',
      remove_attachment: 'bg-pink-500',
      confirm_original_received: 'bg-emerald-500',
    };

    return classes[action] || 'bg-gray-400';
  }

  getAuditActionLabel(action: string): string {
    const labels: Record<string, string> = {
      create: $localize`hat die Kostenerstattung erstellt`,
      update: $localize`hat die Kostenerstattung bearbeitet`,
      status_change: $localize`hat den Status geändert`,
      add_comment: $localize`hat kommentiert`,
      delete: $localize`hat gelöscht`,
      add_attachment: $localize`hat einen Anhang hinzugefügt`,
      remove_attachment: $localize`hat einen Anhang entfernt`,
      confirm_original_received: $localize`hat Originaleingang bestätigt`,
    };

    return labels[action] || action;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
