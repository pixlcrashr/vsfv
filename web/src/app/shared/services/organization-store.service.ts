import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { finalize, map, share, tap } from 'rxjs/operators';
import { Organization } from '../models';
import { OrganizationStoreDataService } from './organization-store.data-service';

/**
 * Root-level store for the organization list. Every consumer (sidebar
 * switcher, admin organization list, import/export, ...) reads the same
 * signal, so creating, importing, renaming or deleting an organization is
 * reflected everywhere as soon as {@link refresh} runs — no per-route reload
 * lists and no stale sidebar until a full page reload.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationStoreService {
  private readonly dataService = inject(OrganizationStoreDataService);

  private readonly _organizations = signal<Organization[] | null>(null);
  private readonly _loading = signal(false);

  /** `null` until the first load completed. */
  readonly organizations = this._organizations.asReadonly();
  readonly loading = this._loading.asReadonly();

  private request$: Observable<Organization[]> | null = null;

  /** Returns the cached list, fetching it once; `force` refetches. */
  load(force = false): Observable<Organization[]> {
    const current = this._organizations();
    if (current !== null && !force) {
      return of(current);
    }
    if (this.request$) {
      return this.request$;
    }

    this._loading.set(true);
    this.request$ = this.dataService.getOrganizations().pipe(
      map((orgs) => {
        this._organizations.set(orgs);
        return orgs;
      }),
      finalize(() => {
        this._loading.set(false);
        this.request$ = null;
      }),
      share(),
    );
    return this.request$;
  }

  /** Refetches the list from the server (after create/import/rename/delete). */
  refresh(): Observable<Organization[]> {
    return this.load(true);
  }
}
