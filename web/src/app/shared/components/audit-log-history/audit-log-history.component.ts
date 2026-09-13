import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AuditLogDataService,
  AuditLogEntryFilters,
} from '../../../routes/audit-log/audit-log.data-service';
import {
  AuditLogHistoryAction,
  AuditLogHistoryChange,
  AuditLogHistoryEntry,
} from '../../models/audit-log-history.model';
import { formatDateTime } from '../../utils/date-format';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { environment } from '../../../../environments/environment';

const PAGE_SIZE = 200;
const VISIBLE_COUNT = 10;

/**
 * Timeline of audit log entries for a single resource, rendered as a dense
 * card. Two modes:
 *
 * - Display mode: bind `entries` (fetched by the host, e.g. via a page data
 *   service).
 * - Self-fetch mode: bind `resource` (and optionally `exact`) and the
 *   component fetches the entries itself via {@link AuditLogDataService};
 *   bind `refreshKey` to a changing value (e.g. a save counter) to re-fetch.
 */
@Component({
  selector: 'app-audit-log-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: AuditLogDataService, useClass: environment.dataServices.auditLog },
  ],
  imports: [LoadingSpinnerComponent],
  template: `
    <div class="bg-white rounded-lg border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
      <h2 i18n class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Historie</h2>

      @if (loading()) {
        <app-loading-spinner size="sm" />
      } @else if (sortedEntries().length === 0) {
        <p i18n class="text-sm text-gray-500 dark:text-gray-400 py-2">Keine Aktivität vorhanden.</p>
      } @else {
        <div class="flow-root">
          <ul role="list" class="-mb-4">
            @for (entry of displayedEntries(); track entry.id; let isLast = $last) {
              @let summary = entryLabels()?.[entry.id];
              @let action = effectiveAction(entry);
              <li>
                <div class="relative pb-4">
                  @if (!isLast || (sortedEntries().length > visibleCount && !showAll())) {
                    <span class="absolute left-3 top-3 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                  }
                  <div class="relative flex space-x-3">
                    <div class="relative">
                      <span [class]="iconClass(action)" class="flex h-6 w-6 items-center justify-center rounded-full">
                        @switch (action) {
                          @case ('CREATE') {
                            <svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          }
                          @case ('UPDATE') {
                            <svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          }
                          @case ('DELETE') {
                            <svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          }
                          @default {
                            <svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                        }
                      </span>
                    </div>
                    <div class="flex min-w-0 flex-1 justify-between gap-4 pt-0.5">
                      <p class="text-sm text-gray-500 dark:text-gray-400 min-w-0">
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ actorLabel(entry) }}</span>
                        <span class="ml-1">{{ summary ?? actionPhrase(entry) }}</span>
                      </p>
                      <div class="whitespace-nowrap text-right text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                        {{ formatDateTime(entry.timestamp) }}
                      </div>
                    </div>
                  </div>
                  @if (!summary && entry.changes.length > 0) {
                    <div class="ml-9 mt-0.5 space-y-0.5">
                      @for (change of entry.changes; track $index) {
                        <p class="text-xs text-gray-400 dark:text-gray-500 truncate" [title]="changeText(change)">
                          {{ changeText(change) }}
                        </p>
                      }
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
        </div>
        @if (sortedEntries().length > visibleCount && !showAll()) {
          <button
            type="button"
            (click)="showAll.set(true)"
            class="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ng-container i18n>Alle anzeigen ({{ sortedEntries().length }})</ng-container>
          </button>
        }
        @if (showAll() && sortedEntries().length > visibleCount) {
          <button
            type="button"
            (click)="showAll.set(false)"
            class="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ng-container i18n>Weniger anzeigen</ng-container>
          </button>
        }
      }
    </div>
  `,
})
export class AuditLogHistoryComponent {
  private readonly dataService = inject(AuditLogDataService);
  private readonly destroyRef = inject(DestroyRef);

  /** Display mode: entries fetched by the host. */
  readonly entries = input<AuditLogHistoryEntry[]>();
  /** Self-fetch mode: resource name of the entity whose history is shown. */
  readonly resource = input<string>();
  /** Self-fetch mode: match the resource name exactly instead of as a substring. */
  readonly exact = input(false);
  /** Changing this value (e.g. a save counter) re-fetches in self-fetch mode. */
  readonly refreshKey = input<unknown>();
  /** Accusative entity phrase used in the action line, e.g. "den Haushaltsplan". */
  readonly entityLabel = input.required<string>();
  /** Resource name of the entity itself; entries on child resources get a type label. */
  readonly entityResource = input<string>();
  /**
   * Per-entry label overrides keyed by entry id. When an entry has a label,
   * it replaces the default action phrase and the raw change lines are
   * hidden — used by hosts that can summarize entries more densely than
   * the generic field diff (e.g. account group assignments).
   */
  readonly entryLabels = input<Readonly<Record<string, string>>>();
  /**
   * Per-entry action overrides keyed by entry id. When an entry has an
   * override, the icon and color are taken from the override instead of the
   * raw action — used by hosts that want a single symbol for entries whose
   * underlying action varies (e.g. account group assignments always shown
   * with the edit icon).
   */
  readonly entryActions = input<Readonly<Record<string, AuditLogHistoryAction>>>();

  protected readonly visibleCount = VISIBLE_COUNT;

  readonly showAll = signal(false);
  protected readonly loading = signal(false);
  private readonly fetchedEntries = signal<AuditLogHistoryEntry[] | null>(null);

  private readonly activeEntries = computed(() => {
    const own = this.entries();
    if (own !== undefined) {
      return own;
    }
    return this.fetchedEntries();
  });

  protected readonly sortedEntries = computed(() =>
    [...(this.activeEntries() ?? [])].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
  );

  protected readonly displayedEntries = computed(() => {
    const all = this.sortedEntries();
    if (this.showAll() || all.length <= VISIBLE_COUNT) {
      return all;
    }
    return all.slice(0, VISIBLE_COUNT);
  });

  constructor() {
    effect(() => {
      const resource = this.resource();
      // Display mode takes precedence: the host supplies the entries.
      if (!resource || this.entries() !== undefined) {
        return;
      }
      this.refreshKey();
      untracked(() => this.fetch(resource));
    });
  }

  private fetch(resource: string): void {
    const filters: AuditLogEntryFilters = this.exact()
      ? { exactResource: resource }
      : { resource };

    this.loading.set(true);
    this.dataService
      .listEntries(PAGE_SIZE, undefined, filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ entries }) => {
          this.fetchedEntries.set(entries);
          this.loading.set(false);
        },
        error: () => {
          // e.g. missing audit-log permission: show an empty history.
          this.fetchedEntries.set([]);
          this.loading.set(false);
        },
      });
  }

  protected actorLabel(entry: AuditLogHistoryEntry): string {
    return entry.actorName ?? entry.actorId ?? $localize`System`;
  }

  protected effectiveAction(entry: AuditLogHistoryEntry): AuditLogHistoryAction {
    return this.entryActions()?.[entry.id] ?? entry.action;
  }

  protected actionPhrase(entry: AuditLogHistoryEntry): string {
    const object = this.objectLabel(entry);
    switch (entry.action) {
      case 'CREATE':
        return $localize`hat ${object}:object: erstellt`;
      case 'DELETE':
        return $localize`hat ${object}:object: gelöscht`;
      default:
        return $localize`hat ${object}:object: bearbeitet`;
    }
  }

  private objectLabel(entry: AuditLogHistoryEntry): string {
    const entityResource = this.entityResource() ?? this.resource();
    if (!entityResource || entry.resource === entityResource) {
      return this.entityLabel();
    }
    if (entry.resource.includes('/revisions/')) {
      return $localize`die Revision`;
    }
    if (entry.resource.includes('/accountValues/')) {
      return $localize`den Kontowert`;
    }
    if (entry.resource.includes('/assignments/')) {
      return $localize`die Zuweisung`;
    }
    return this.entityLabel();
  }

  protected iconClass(action: AuditLogHistoryAction): string {
    const classes: Record<AuditLogHistoryAction, string> = {
      CREATE: 'bg-green-500',
      UPDATE: 'bg-blue-500',
      DELETE: 'bg-red-500',
    };
    return classes[action] ?? 'bg-gray-400';
  }

  protected changeText(change: AuditLogHistoryChange): string {
    return `${change.field}: ${change.oldValue ?? '—'} → ${change.newValue ?? '—'}`;
  }

  protected readonly formatDateTime = formatDateTime;
}
