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
import { ActivatedRoute } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  EmptyStateComponent,
  NotificationService,
  AdminContentHeaderComponent,
  AdminContentComponent,
} from '../../shared/components';
import { formatDateTime } from '../../shared/utils';
import { Organization } from '../../shared/models';
import { OrganizationListDataService } from '../admin/organizations/organization-list.data-service';
import {
  AuditLogEntry,
  AuditLogEntryFilters,
  AuditLogAction,
} from './audit-log.data-service';
import { AuditLogQueryService } from './audit-log.query-service';

const ACTION_LABELS: Record<AuditLogAction, string> = {
  CREATE: $localize`Erstellt`,
  UPDATE: $localize`Geändert`,
  DELETE: $localize`Gelöscht`,
};

@Component({
  selector: 'app-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    PageContentLayoutComponent,
    ButtonComponent,
    EmptyStateComponent,
    AdminContentHeaderComponent,
    AdminContentComponent,
  ],
  template: `
    <ng-template #content>
      <div class="w-full space-y-3">
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            @if (isGlobalMode()) {
              <div>
                <label i18n for="filterOrg" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organisation
                </label>
                <select
                  id="filterOrg"
                  [(ngModel)]="filterOrganizationId"
                  (ngModelChange)="onFilterChange()"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option i18n value="">Alle</option>
                  @for (org of organizations(); track org.id) {
                    <option [value]="org.id">{{ org.name }}</option>
                  }
                </select>
              </div>
            }

            <div>
              <label i18n for="filterAfterDate" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Von
              </label>
              <input
                id="filterAfterDate"
                type="date"
                [(ngModel)]="filterAfterDate"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label i18n for="filterBeforeDate" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bis
              </label>
              <input
                id="filterBeforeDate"
                type="date"
                [(ngModel)]="filterBeforeDate"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label i18n for="filterAction" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aktion
              </label>
              <select
                id="filterAction"
                [(ngModel)]="filterAction"
                (ngModelChange)="onFilterChange()"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option i18n value="all">Alle</option>
                <option i18n value="CREATE">Erstellt</option>
                <option i18n value="UPDATE">Geändert</option>
                <option i18n value="DELETE">Gelöscht</option>
              </select>
            </div>

            <div>
              <label i18n for="filterResource" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ressource
              </label>
              <input
                id="filterResource"
                type="text"
                [(ngModel)]="filterResource"
                (ngModelChange)="onFilterChange()"
                placeholder="organizations/… /accounts/…"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div class="mt-3 flex items-center justify-end">
            <button
              type="button"
              i18n-title title="Filter zurücksetzen"
              (click)="resetFilters()"
              class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
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
            <div class="absolute inset-0 z-10 bg-white/70 dark:bg-gray-900/70 rounded-lg flex items-start justify-center pt-10">
              <svg class="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          }

          @if (!loading() && entries().length === 0) {
            <app-empty-state
              i18n-title title="Keine Audit-Log-Einträge gefunden"
              [description]="hasActiveFilters() ? filterActiveDescription : filterInactiveDescription"
            >
              @if (hasActiveFilters()) {
                <app-button variant="secondary" (clicked)="resetFilters()">
                  <ng-container i18n>Filter zurücksetzen</ng-container>
                </app-button>
              }
            </app-empty-state>
          } @else {
            <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" [class.opacity-50]="loading()">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400">
                        <ng-container i18n>Zeitpunkt</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400">
                        <ng-container i18n>Aktion</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400">
                        <ng-container i18n>Ressource</ng-container>
                      </th>
                      @if (isGlobalMode()) {
                        <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400">
                          <ng-container i18n>Organisation</ng-container>
                        </th>
                      }
                      <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400">
                        <ng-container i18n>Akteur</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-left text-gray-500 dark:text-gray-400">
                        <ng-container i18n>Änderungen</ng-container>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    @for (entry of entries(); track trackById(entry)) {
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors align-top">
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ formatDateTime(entry.timestamp) }}</td>
                        <td class="px-3 py-2 text-xs">
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                            [class]="actionBadgeClass(entry.action)"
                          >
                            {{ actionLabel(entry.action) }}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          <div class="max-w-xs truncate" [title]="entry.resource">{{ entry.resource }}</div>
                        </td>
                        @if (isGlobalMode()) {
                          <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{{ organizationName(entry) }}</td>
                        }
                        <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                          @if (entry.actor) {
                            <span class="font-mono" [title]="entry.actor">{{ shortActor(entry) }}</span>
                          } @else {
                            <ng-container i18n>System</ng-container>
                          }
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          @for (change of entry.changes; track change.field) {
                            <div class="whitespace-nowrap">
                              <span class="text-gray-500 dark:text-gray-400">{{ change.field }}:</span>
                              <span class="text-red-600 dark:text-red-400 line-through" [title]="change.oldValue ?? ''">{{ change.oldValue ?? '—' }}</span>
                              <span class="text-gray-400 dark:text-gray-500 mx-0.5">→</span>
                              <span class="text-green-700 dark:text-green-400" [title]="change.newValue ?? ''">{{ change.newValue ?? '—' }}</span>
                            </div>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <p i18n class="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-3">
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
    </ng-template>

    @if (isGlobalMode()) {
      <div class="flex flex-col h-full min-h-0">
        <app-admin-content-header i18n-title title="Audit-Log" />
        <app-admin-content>
          <ng-container *ngTemplateOutlet="content" />
        </app-admin-content>
      </div>
    } @else {
      <app-page-content-layout [breadcrumbs]="breadcrumbs">
        <div layout-content class="flex flex-1 justify-center">
          <div class="w-full max-w-5xl">
            <ng-container *ngTemplateOutlet="content" />
          </div>
        </div>
      </app-page-content-layout>
    }
  `,
})
export class AuditLogComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly queryService = inject(AuditLogQueryService);
  private readonly orgListSvc = inject(OrganizationListDataService, { optional: true });
  private readonly notifications = inject(NotificationService);

  private readonly filterChange$ = new Subject<void>();
  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  /** Set when mounted under an organization route; empty in the global (admin) view. */
  orgId = '';
  readonly isGlobalMode = computed(() => this.orgId === '');

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly entries = signal<AuditLogEntry[]>([]);
  readonly total = signal(0);
  readonly nextPageToken = signal<string | undefined>(undefined);
  readonly currentPage = signal(0);
  readonly pageSize = 100;
  readonly hasMore = computed(() => this.nextPageToken() !== undefined);

  readonly organizations = signal<Organization[]>([]);

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Audit-Log` }];

  readonly filterActiveDescription = $localize`Passen Sie die Filter an oder setzen Sie sie zurück.`;
  readonly filterInactiveDescription = $localize`Es wurden noch keine Änderungen aufgezeichnet.`;

  filterOrganizationId = '';
  filterAfterDate = '';
  filterBeforeDate = '';
  filterAction: 'all' | AuditLogAction = 'all';
  filterResource = '';

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
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(orgId => {
      this.orgId = orgId ?? '';
      this.filterOrganizationId = this.orgId;
      this.currentPage.set(0);
      this.nextPageToken.set(undefined);
      this.entries.set([]);
      this.total.set(0);
      if (this.isGlobalMode()) {
        this.loadOrganizations();
      }
      this.fetchEntries(0, false);
    });
  }

  onFilterChange(): void {
    this.filterChange$.next();
  }

  resetFilters(): void {
    this.filterAfterDate = '';
    this.filterBeforeDate = '';
    this.filterAction = 'all';
    this.filterResource = '';
    if (this.isGlobalMode()) {
      this.filterOrganizationId = '';
    }
    this.filterChange$.next();
  }

  hasActiveFilters(): boolean {
    return (
      !!this.filterAfterDate ||
      !!this.filterBeforeDate ||
      this.filterAction !== 'all' ||
      !!this.filterResource.trim() ||
      (this.isGlobalMode() && !!this.filterOrganizationId)
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

    this.queryService.fetchPage(page, this.pageSize, this.buildFilters()).subscribe({
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
        this.notifications.error($localize`Fehler beim Laden des Audit-Logs`);
        if (append) {
          this.loadingMore.set(false);
        } else {
          this.loading.set(false);
        }
      },
    });
  }

  private buildFilters(): AuditLogEntryFilters {
    return {
      organizationId: this.filterOrganizationId || undefined,
      action: this.filterAction,
      resource: this.filterResource.trim() || undefined,
      afterDate: this.filterAfterDate || undefined,
      beforeDate: this.filterBeforeDate || undefined,
    };
  }

  private loadOrganizations(): void {
    this.orgListSvc?.getOrganizations().subscribe({
      next: (orgs) => this.organizations.set(orgs),
      error: () => this.organizations.set([]),
    });
  }

  trackById = (entry: AuditLogEntry) => entry.id;

  formatDateTime(date: Date): string {
    return formatDateTime(date);
  }

  actionLabel(action: AuditLogAction): string {
    return ACTION_LABELS[action] ?? action;
  }

  actionBadgeClass(action: AuditLogAction): string {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case 'DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    }
  }

  organizationName(entry: AuditLogEntry): string {
    if (!entry.organizationId) {
      return '—';
    }
    const org = this.organizations().find((o) => o.id === entry.organizationId);
    return org?.name ?? entry.organizationId;
  }

  shortActor(entry: AuditLogEntry): string {
    return entry.actorId ?? entry.actor;
  }
}
