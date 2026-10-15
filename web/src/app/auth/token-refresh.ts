import { HttpErrorResponse } from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';

// Single-flight refresh: concurrent triggers (proactive timer, 401 recovery)
// share one token round-trip. The server rotates refresh tokens, so parallel
// refresh calls would invalidate each other's tokens.
let refreshInFlight: Promise<void> | null = null;

export function refreshAccessToken(oauthService: OAuthService): Promise<void> {
  refreshInFlight ??= oauthService
    .refreshToken()
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * True when the token endpoint actively rejected the refresh (as opposed to a
 * transient network or server error): the refresh token is expired or revoked
 * and the session cannot recover without re-authenticating.
 */
export function isSessionUnrecoverable(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 400 || err.status === 401);
}
