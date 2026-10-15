import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { Permission } from './permissions';
import { AuthorizationService } from './authorization.service';

/**
 * requireAllPermissions returns a CanActivateFn that grants access only when
 * the current user holds ALL of the specified permissions.
 *
 * The domain is determined from the `orgId` route parameter as "organizations/{orgId}".
 * When `orgId` is absent, permissions are checked against the global domain.
 */
export function requireAllPermissions(...requiredPermissions: Permission[]): CanActivateFn {
  return (route) => {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const authService = inject(AuthorizationService);
    const router = inject(Router);

    const user = authService.currentUser();
    if (!user) {
      return router.createUrlTree(['/']);
    }

    const orgId = route.paramMap.get('orgId');
    const domain = orgId ? `organizations/${orgId}` : '';

    return authService.checkPermissions(user, domain, requiredPermissions).pipe(
      map((result) => {
        const allGranted = requiredPermissions.every((p) => result[p]);
        if (allGranted) return true;
        return orgId
          ? router.createUrlTree(['/organizations', orgId, 'permission-denied'])
          : router.createUrlTree(['/permission-denied']);
      }),
      // A failed permission check (e.g. a backend error) must not kill the
      // navigation silently; treat it as denied so the user gets feedback.
      catchError(() => of(orgId
        ? router.createUrlTree(['/organizations', orgId, 'permission-denied'])
        : router.createUrlTree(['/permission-denied']))),
    );
  };
}

/**
 * requireAnyPermission returns a CanActivateFn that grants access when the
 * current user holds at least ONE of the specified permissions.
 *
 * The domain is determined from the `orgId` route parameter as "organizations/{orgId}".
 * When `orgId` is absent, permissions are checked against the global domain.
 */
export function requireAnyPermission(...permissions: Permission[]): CanActivateFn {
  return (route) => {
    if (permissions.length === 0) {
      return true;
    }

    const authService = inject(AuthorizationService);
    const router = inject(Router);

    const user = authService.currentUser();
    if (!user) {
      return router.createUrlTree(['/']);
    }

    const orgId = route.paramMap.get('orgId');
    const domain = orgId ? `organizations/${orgId}` : '';

    return authService.checkPermissions(user, domain, permissions).pipe(
      map((result) => {
        const anyGranted = permissions.some((p) => result[p]);
        if (anyGranted) return true;
        return orgId
          ? router.createUrlTree(['/organizations', orgId, 'permission-denied'])
          : router.createUrlTree(['/permission-denied']);
      }),
      catchError(() => of(orgId
        ? router.createUrlTree(['/organizations', orgId, 'permission-denied'])
        : router.createUrlTree(['/permission-denied']))),
    );
  };
}

/**
 * requireAllGlobalPermissions returns a CanActivateFn that grants access only
 * when the current user holds ALL of the specified permissions in the global
 * domain (ignoring any orgId route parameter).
 */
export function requireAllGlobalPermissions(...requiredPermissions: Permission[]): CanActivateFn {
  return () => {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const authService = inject(AuthorizationService);
    const router = inject(Router);

    const user = authService.currentUser();
    if (!user) {
      return router.createUrlTree(['/']);
    }

    return authService.checkPermissions(user, '', requiredPermissions).pipe(
      map((result) => {
        const allGranted = requiredPermissions.every((p) => result[p]);
        return allGranted || router.createUrlTree(['/permission-denied']);
      }),
      catchError(() => of(router.createUrlTree(['/permission-denied']))),
    );
  };
}

/**
 * requireAnyGlobalPermission returns a CanActivateFn that grants access when
 * the current user holds at least ONE of the specified permissions in the
 * global domain (ignoring any orgId route parameter).
 */
export function requireAnyGlobalPermission(...permissions: Permission[]): CanActivateFn {
  return () => {
    if (permissions.length === 0) {
      return true;
    }

    const authService = inject(AuthorizationService);
    const router = inject(Router);

    const user = authService.currentUser();
    if (!user) {
      return router.createUrlTree(['/']);
    }

    return authService.checkPermissions(user, '', permissions).pipe(
      map((result) => {
        const anyGranted = permissions.some((p) => result[p]);
        return anyGranted || router.createUrlTree(['/permission-denied']);
      }),
      catchError(() => of(router.createUrlTree(['/permission-denied']))),
    );
  };
}
