import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { isSessionUnrecoverable, refreshAccessToken } from './token-refresh';

function withAuthHeaders(
  req: HttpRequest<unknown>,
  oauthService: OAuthService,
): HttpRequest<unknown> {
  // Send credentials so the cross-origin development setup (ng serve on a
  // different port) can receive and store the login session cookie. In
  // production the SPA is same-origin and this is a no-op.
  let authReq = req.clone({ withCredentials: true });
  const token = oauthService.getAccessToken();
  if (token) {
    authReq = authReq.clone({
      headers: authReq.headers.set('Authorization', `Bearer ${token}`),
    });
  }
  return authReq;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const router = inject(Router);

  if (!req.url.includes('/api/') && !req.url.includes('/auth/')) {
    return next(req);
  }

  const sentToken = oauthService.getAccessToken();

  return next(withAuthHeaders(req, oauthService)).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !oauthService.getRefreshToken() ||
        // A failed password login also surfaces as 401; never refresh for
        // the login endpoints themselves.
        req.url.includes('auth:login')
      ) {
        return throwError(() => error);
      }

      // The access token may have expired (e.g. the tab was in the
      // background when the proactive refresh was due). Refresh once —
      // shared across concurrent 401s — and retry the request a single
      // time. If the stored token already changed, the refresh happened
      // meanwhile and the retry can use it directly.
      const refresh =
        oauthService.getAccessToken() !== sentToken
          ? Promise.resolve()
          : refreshAccessToken(oauthService);

      return from(refresh).pipe(
        switchMap(() => next(withAuthHeaders(req, oauthService))),
        catchError((refreshError: unknown) => {
          if (oauthService.hasValidAccessToken()) {
            // A concurrent refresh succeeded while this one failed (the
            // server rotates refresh tokens); retry with the fresh token.
            return next(withAuthHeaders(req, oauthService));
          }
          if (isSessionUnrecoverable(refreshError)) {
            // The refresh token is no longer accepted: the session cannot
            // recover. Clear the stale tokens and drop to the login page.
            oauthService.logOut();
            void router.navigate(['/login']);
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};
