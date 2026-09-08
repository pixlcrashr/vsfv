import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  AuditLogDataService,
  AuditLogEntryFilters,
  AuditLogEntry,
} from './audit-log.data-service';

/**
 * Stateful wrapper around {@link AuditLogDataService} that manages cursor
 * pagination for the audit log list.
 *
 * The underlying data service is kept stateless; this service tracks the
 * current page token and filters so that the component can keep requesting
 * pages by number while the API is called with the correct token.
 */
@Injectable()
export class AuditLogQueryService {
  private readonly dataService = inject(AuditLogDataService);

  private state?: {
    filters: AuditLogEntryFilters | undefined;
    currentPage: number;
    nextPageToken?: string;
    total: number;
  };

  fetchPage(
    page: number,
    pageSize: number,
    filters?: AuditLogEntryFilters,
  ): Observable<{ entries: AuditLogEntry[]; total: number; nextPageToken?: string }> {
    if (
      page === 0 ||
      !this.state ||
      !this.areFiltersEqual(this.state.filters, filters)
    ) {
      this.state = {
        filters,
        currentPage: -1,
        nextPageToken: undefined,
        total: 0,
      };
    }

    const state = this.state;
    return this.dataService
      .listEntries(pageSize, state.nextPageToken, filters)
      .pipe(
        tap((result) => {
          state.currentPage = page;
          state.nextPageToken = result.nextPageToken;
          state.total = result.total;
        }),
      );
  }

  private areFiltersEqual(
    a: AuditLogEntryFilters | undefined,
    b: AuditLogEntryFilters | undefined,
  ): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
}
