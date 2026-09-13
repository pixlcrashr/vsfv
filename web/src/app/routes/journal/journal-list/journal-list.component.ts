import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
  signal,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, merge, map, distinctUntilChanged, filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  StatusBadgeComponent,
  EmptyStateComponent,
  NotificationService,
} from '../../../shared/components';
import { formatDateShort } from '../../../shared/utils';
import {
  JournalEntry,
  JournalEntryFilters,
  JournalAssignmentStatus,
} from './journal-list.data-service';
import { JournalListQueryService } from './journal-list.query-service';
import { HasPermissionPipe } from '../../../../lib/authz/has-permission.pipe';
import { Permissions } from '../../../../lib/authz/permissions';

@Component({
  selector: 'app-journal-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageContentLayoutComponent,
    ButtonComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    HasPermissionPipe,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      @if (Permissions.JOURNAL_IMPORT | hasPermission) {
        <a
          layout-header-actions
          [routerLink]="['/organizations', orgId, 'journal', 'import']"
          class="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:opacity-90"
        >
          <ng-container i18n>Import</ng-container>
        </a>
      }

      <div layout-content class="flex flex-1 justify-center">
          <div class="w-full space-y-3">
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div>
                  <label i18n for="afterDate" class="block text-xs font-medium text-gray-700 mb-1">
                    Von
                  </label>
                  <input
                    id="afterDate"
                    type="date"
                    [(ngModel)]="filterAfterDate"
                    (ngModelChange)="onFilterChange()"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label i18n for="beforeDate" class="block text-xs font-medium text-gray-700 mb-1">
                    Bis
                  </label>
                  <input
                    id="beforeDate"
                    type="date"
                    [(ngModel)]="filterBeforeDate"
                    (ngModelChange)="onFilterChange()"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div class="xl:col-span-2">
                  <label i18n for="searchQuery" class="block text-xs font-medium text-gray-700 mb-1">
                    Allgemeine Suche
                  </label>
                  <input
                    id="searchQuery"
                    type="text"
                    [(ngModel)]="filterQuery"
                    (ngModelChange)="onFilterChange()"
                    placeholder="Belegnummer, Buchungstext, Konto ..."
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label i18n for="assignmentStatus" class="block text-xs font-medium text-gray-700 mb-1">
                    Zuordnungsstatus
                  </label>
                  <select
                    id="assignmentStatus"
                    [(ngModel)]="filterAssignmentStatus"
                    (ngModelChange)="onFilterChange()"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option i18n value="all">Alle</option>
                    <option i18n value="ignored">Ignoriert</option>
                    <option i18n value="assigned">Vollständig zugeordnet</option>
                    <option i18n value="partial">Teilweise zugeordnet</option>
                    <option i18n value="open">Offen</option>
                  </select>
                </div>
              </div>

              <div class="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  i18n-title title="Filter zurücksetzen"
                  (click)="resetFilters()"
                  class="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <ng-container i18n>Zurücksetzen</ng-container>
                </button>
              </div>
            </div>

            <div class="relative">
              @if (loading()) {
                <div class="absolute inset-0 z-10 bg-white/70 rounded-lg flex items-start justify-center pt-10">
                  <svg class="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              }

              @if (!loading() && entries().length === 0) {
                <app-empty-state
                  i18n-title title="Keine Buchungen gefunden"
                  [description]="hasActiveFilters() ? filterActiveDescription : filterInactiveDescription"
                >
                  @if (hasActiveFilters()) {
                    <app-button variant="secondary" (clicked)="resetFilters()">
                      <ng-container i18n>Filter zurücksetzen</ng-container>
                    </app-button>
                  } @else {
                    @if (Permissions.JOURNAL_IMPORT | hasPermission) {
                      <a
                        [routerLink]="['/organizations', orgId, 'journal', 'import']"
                        class="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:opacity-90"
                      >
                        <ng-container i18n>Buchungen importieren</ng-container>
                      </a>
                    }
                  }
                </app-empty-state>
              } @else {
              <div class="bg-white rounded-lg border border-gray-200 overflow-hidden" [class.opacity-50]="loading()">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 border-b-0">
                    <thead class="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Belegdatum</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Belegnummer</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Soll</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Haben</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-right text-gray-500"
                        >
                          <ng-container i18n>Betrag</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Beschreibung</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Haushaltskonten</ng-container>
                        </th>
                        <th
                          scope="col"
                          class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500"
                        >
                          <ng-container i18n>Status</ng-container>
                        </th>
                        <th scope="col" class="px-3 py-2 text-right">
                          <span class="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white">
                      @for (entry of entries(); track trackById(entry)) {
                        <tr class="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                          <td class="px-3 py-2 text-xs text-gray-900">{{ formatDate(entry.documentDate) }}</td>
                          <td class="px-3 py-2 text-xs text-gray-900">{{ entry.reference }}</td>
                          <td class="px-3 py-2 text-xs text-gray-900">
                            <span [title]="entry.debitAccountName">{{ entry.debitAccountCode }}</span>
                          </td>
                          <td class="px-3 py-2 text-xs text-gray-900">
                            <span [title]="entry.creditAccountName">{{ entry.creditAccountCode }}</span>
                          </td>
                          <td class="px-3 py-2 text-xs text-right text-gray-900">{{ formatAmount(entry.amount) }}</td>
                          <td class="px-3 py-2 text-xs text-gray-900">
                            <div class="max-w-sm truncate" [title]="entry.description">
                              {{ entry.description }}
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs text-gray-900">
                            @if (entry.accountAssignments.length > 0) {
                              <ul class="space-y-0.5">
                                @for (assignment of entry.accountAssignments; track $index) {
                                  <li class="flex items-center justify-between gap-2">
                                    <span [title]="assignment.accountName">{{ assignment.accountCode }}</span>
                                    <span class="text-gray-500">{{ formatAmount(assignment.value) }}</span>
                                  </li>
                                }
                              </ul>
                            } @else {
                              <p i18n class="text-[11px] text-gray-400 italic">
                                Keine Zuordnung.
                              </p>
                            }
                          </td>
                          <td class="px-3 py-2 text-xs text-gray-900">
                            <app-status-badge
                              size="sm"
                              [variant]="statusVariant(entry.assignmentStatus)"
                            >
                              {{ statusLabel(entry.assignmentStatus) }}
                            </app-status-badge>
                          </td>
                          <td class="px-3 py-2 text-right text-xs">
                            <a
                              [routerLink]="['/organizations', orgId, 'transactions', entry.id]"
                              class="text-xs text-blue-600 hover:underline"
                            >
                              <ng-container i18n>Bearbeiten</ng-container>
                            </a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <p i18n class="text-xs text-gray-500 mt-2 ml-3">
                  Geladen {{ entries().length }} von {{ total() }} Einträgen
                </p>
                @if (hasMore()) {
                  <app-button
                    variant="secondary"
                    [loading]="loadingMore()"
                    [disabled]="loadingMore()"
                    (clicked)="loadMore()"
                  >
                    <ng-container i18n>Mehr laden</ng-container>
                  </app-button>
                }
              </div>

              @if (hasMore()) {
                <div #loadMoreSentinel class="h-1"></div>
              }
              }
            </div>
          </div>
      </div>
    </app-page-content-layout>

  `,
})
export class JournalListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly queryService = inject(JournalListQueryService);
  private readonly notifications = inject(NotificationService);

  private readonly filterChange$ = new Subject<void>();
  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  orgId = '';

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly entries = signal<JournalEntry[]>([]);
  readonly total = signal(0);
  readonly nextPageToken = signal<string | undefined>(undefined);
  readonly currentPage = signal(0);
  readonly pageSize = 100;
  readonly hasMore = computed(() => this.nextPageToken() !== undefined);
  readonly Permissions = Permissions;

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Journal` }];

  readonly filterActiveDescription = $localize`Passen Sie die Filter an oder setzen Sie sie zurück.`;
  readonly filterInactiveDescription = $localize`Importieren Sie Buchungen, um das Journal zu füllen.`;

  filterAfterDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();
  filterBeforeDate = new Date().toISOString().slice(0, 10);
  filterQuery = '';
  filterAssignmentStatus: 'all' | JournalAssignmentStatus = 'all';

  constructor() {
    this.filterChange$.pipe(
      debounceTime(500),
      takeUntilDestroyed(),
    ).subscribe(() => {
      this.currentPage.set(0);
      this.nextPageToken.set(undefined);
      this.fetchEntries(0, false);
    });

    effect((onCleanup) => {
      const sentinel = this.loadMoreSentinel()?.nativeElement;
      if (!sentinel) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            this.loadMore();
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(sentinel);

      onCleanup(() => observer.disconnect());
    });

    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.orgId = id;
      this.currentPage.set(0);
      this.nextPageToken.set(undefined);
      this.entries.set([]);
      this.total.set(0);
      this.fetchEntries(0, false);
    });
  }

  onFilterChange(): void {
    this.filterChange$.next();
  }

  resetFilters(): void {
    const today = new Date();
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    this.filterAfterDate = yearAgo.toISOString().slice(0, 10);
    this.filterBeforeDate = today.toISOString().slice(0, 10);
    this.filterQuery = '';
    this.filterAssignmentStatus = 'all';
    this.filterChange$.next();
  }

  hasActiveFilters(): boolean {
    return (
      !!this.filterAfterDate ||
      !!this.filterBeforeDate ||
      !!this.filterQuery.trim() ||
      this.filterAssignmentStatus !== 'all'
    );
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.fetchEntries(this.currentPage() + 1, true);
  }

  private fetchEntries(page: number, append: boolean): void {
    if (!append) {
      this.loading.set(true);
    }

    this.queryService.fetchPage(this.orgId, page, this.pageSize, this.buildFilters()).subscribe({
      next: (result) => {
        if (append) {
          this.entries.update((existing) => [...existing, ...result.entries]);
          this.loadingMore.set(false);
        } else {
          this.entries.set(result.entries);
          this.loading.set(false);
        }

        this.currentPage.set(page);
        this.total.set(result.total);
        this.nextPageToken.set(result.nextPageToken);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Buchungen`);
        if (append) {
          this.loadingMore.set(false);
        } else {
          this.loading.set(false);
        }
      },
    });
  }

  private buildFilters(): JournalEntryFilters {
    return {
      afterDate: this.filterAfterDate || undefined,
      beforeDate: this.filterBeforeDate || undefined,
      query: this.filterQuery.trim() || undefined,
      assignmentStatus: this.filterAssignmentStatus,
    };
  }

  trackById = (entry: JournalEntry) => entry.id;

  formatDate(date: Date): string {
    return formatDateShort(date);
  }

  statusLabel(status: JournalAssignmentStatus): string {
    if (status === 'assigned') {
      return $localize`Vollst. zugeordnet`;
    }

    if (status === 'partial') {
      return $localize`Teilw. zugeordnet`;
    }

    if (status === 'ignored') {
      return $localize`Ignoriert`;
    }

    return $localize`Offen`;
  }

  statusVariant(status: JournalAssignmentStatus): 'success' | 'warning' | 'neutral' {
    if (status === 'assigned') {
      return 'success';
    }

    if (status === 'partial') {
      return 'warning';
    }

    return 'neutral';
  }

  formatAmount(value: string): string {
    const num = parseFloat(value);
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(num);
  }
}
