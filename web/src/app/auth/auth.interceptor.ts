import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const token = oauthService.getAccessToken();

  if (req.url.includes('/api/') || req.url.includes('/auth/')) {
    // Send credentials so the cross-origin development setup (ng serve on a
    // different port) can receive and store the login session cookie. In
    // production the SPA is same-origin and this is a no-op.
    let authReq = req.clone({ withCredentials: true });

    if (token) {
      authReq = authReq.clone({
        headers: authReq.headers.set('Authorization', `Bearer ${token}`),
      });
    }
    return next(authReq);
  }

  return next(req);
};
