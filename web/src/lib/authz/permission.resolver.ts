import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Permission } from './permissions';
import { AuthorizationService } from './authorization.service';

export function resolvePermissions(...permissions: Permission[]): ResolveFn<Record<string, boolean>> {
  return (route) => {
    if (permissions.length === 0) {
      return of({});
    }

    const authService = inject(AuthorizationService);

    const user = authService.currentUser();
    if (!user) {
      return of({});
    }

    const orgId = route.paramMap.get('orgId');
    const domain = orgId ? `organizations/${orgId}` : '';

    // On errors (e.g. transient backend failures) resolve to an empty map so
    // the page renders with permission-gated elements hidden.
    return authService.checkPermissions(user, domain, permissions).pipe(
      catchError(() => of({})),
    );
  };
}

export function resolveGlobalPermissions(...permissions: Permission[]): ResolveFn<Record<string, boolean>> {
  return () => {
    if (permissions.length === 0) {
      return of({});
    }

    const authService = inject(AuthorizationService);

    const user = authService.currentUser();
    if (!user) {
      return of({});
    }

    return authService.checkPermissions(user, '', permissions).pipe(
      catchError(() => of({})),
    );
  };
}
