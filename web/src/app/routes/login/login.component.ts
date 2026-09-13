import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService, OAuthEvent } from 'angular-oauth2-oidc';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subscription, Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';

import { ButtonComponent } from '../../shared/components';
import { LoadingSpinnerComponent } from '../../shared/components';
import { LoginDataService } from './login.data-service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, LoadingSpinnerComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div class="max-w-md w-full space-y-8 p-8">
        <div class="text-center">
          <h1 i18n class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Anmelden
          </h1>
          @if (isProcessing()) {
            <p i18n class="text-sm text-gray-500 dark:text-gray-400">
              Anmeldung wird verarbeitet...
            </p>
          } @else if (optionsLoading()) {
            <div class="flex justify-center py-4">
              <app-loading-spinner />
            </div>
          } @else if (optionsError()) {
            <p class="text-sm text-red-600 dark:text-red-400">{{ optionsError() }}</p>
          } @else {
            <p i18n class="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Melden Sie sich mit Ihrem Konto an.
            </p>

            @if (passwordEnabled()) {
              <form [formGroup]="loginForm" (ngSubmit)="loginWithPassword()" class="space-y-4 text-left">
                <div>
                  <label for="email" i18n class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    formControlName="email"
                    autocomplete="username"
                    i18n-placeholder
                    placeholder="name@example.com"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label for="password" i18n class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Passwort
                  </label>
                  <input
                    id="password"
                    type="password"
                    formControlName="password"
                    autocomplete="current-password"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                @if (passwordError()) {
                  <p class="text-sm text-red-600 dark:text-red-400">{{ passwordError() }}</p>
                }

                <app-button
                  type="submit"
                  variant="primary"
                  [fullWidth]="true"
                  [loading]="submitting()"
                  [disabled]="loginForm.invalid || submitting()"
                >
                  <ng-container i18n>Mit Passwort anmelden</ng-container>
                </app-button>
              </form>
            }

            @if (passwordEnabled() && gitlabEnabled()) {
              <div class="flex items-center gap-3 my-6" role="separator">
                <span class="flex-1 h-px bg-gray-300 dark:bg-gray-600"></span>
                <span i18n class="text-xs text-gray-500 dark:text-gray-400">oder</span>
                <span class="flex-1 h-px bg-gray-300 dark:bg-gray-600"></span>
              </div>
            }

            @if (gitlabEnabled()) {
              <button
                (click)="loginWithGitLab()"
                i18n
                class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263c-.135-.423-.73-.423-.867 0L1.388 9.452-.955 13.587a.87.87 0 0 0 .317 1.156L12 21.182l11.638-6.44a.87.87 0 0 0 .317-1.155z"/>
                </svg>
                Mit GitLab anmelden
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly oauthService = inject(OAuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly loginDataSvc = inject(LoginDataService);

  readonly isProcessing = signal(false);
  readonly optionsLoading = signal(false);
  readonly optionsError = signal<string | null>(null);
  readonly passwordEnabled = signal(false);
  readonly gitlabEnabled = signal(false);
  readonly submitting = signal(false);
  readonly passwordError = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  private tokenSub: Subscription | null = null;
  private tokenCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly destroy$ = new Subject<void>();

  async ngOnInit() {
    // If already authenticated, redirect to home
    if (this.oauthService.hasValidAccessToken()) {
      await this.router.navigate(['/']);
      return;
    }

    this.loadLoginOptions();

    // Check if this is a callback (code in URL) — the library processes it
    // automatically via loadDiscoveryDocumentAndTryLogin() in app.config.ts.
    // We wait for the token_received event and fall back to a polling timeout.
    const hasCode = new URLSearchParams(window.location.search).has('code');
    if (hasCode) {
      this.isProcessing.set(true);

      this.tokenSub = this.oauthService.events
        .pipe(
          filter((event: OAuthEvent) => event.type === 'token_received' || event.type === 'token_refreshed'),
          take(1),
        )
        .subscribe(async () => {
          this.cleanupTokenCheck();
          if (this.oauthService.hasValidAccessToken()) {
            await this.router.navigate(['/']);
          } else {
            this.isProcessing.set(false);
          }
        });

      this.tokenCheckTimeout = setTimeout(() => {
        this.tokenSub?.unsubscribe();
        this.tokenSub = null;
        this.tokenCheckTimeout = null;

        if (this.oauthService.hasValidAccessToken()) {
          this.router.navigate(['/']);
        } else {
          this.isProcessing.set(false);
        }
      }, 5000);
    }
  }

  ngOnDestroy(): void {
    this.cleanupTokenCheck();
    this.tokenSub?.unsubscribe();
    this.tokenSub = null;
    this.destroy$.next();
    this.destroy$.complete();
  }

  loginWithGitLab() {
    this.oauthService.initCodeFlow();
  }

  loginWithPassword() {
    if (this.loginForm.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.passwordError.set(null);

    const { email, password } = this.loginForm.getRawValue();
    this.loginDataSvc
      .login(email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (redirectUrl) => {
          // The session cookie is now set; continue into the OAuth2 flow.
          // Because of the session, the authorize endpoint immediately
          // redirects back with a code, which is handled by the callback
          // logic in ngOnInit.
          if (!redirectUrl) {
            // No OAuth2 continuation available (e.g. mock environment).
            void this.router.navigate(['/']);
            return;
          }
          this.oauthService.initCodeFlow();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.passwordError.set(this.loginErrorMessage(err));
        },
      });
  }

  private loadLoginOptions() {
    this.optionsLoading.set(true);
    this.optionsError.set(null);

    this.loginDataSvc
      .getLoginOptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (options) => {
          this.optionsLoading.set(false);
          this.passwordEnabled.set(options.passwordEnabled);
          this.gitlabEnabled.set(options.gitlabEnabled);
        },
        error: () => {
          this.optionsLoading.set(false);
          this.optionsError.set($localize`Anmeldeoptionen konnten nicht geladen werden.`);
        },
      });
  }

  private loginErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      // The gateway wraps the gRPC status in the body; key off the code
      // because the HTTP status mapping is lossy (FailedPrecondition → 400).
      const code = (err.error as { code?: number } | null)?.code;
      if (code === 9) {
        // FAILED_PRECONDITION: password authentication is disabled.
        return $localize`Die Passwort-Anmeldung ist deaktiviert.`;
      }
      if (code === 16 || err.status === 401) {
        // UNAUTHENTICATED: unknown user or wrong password.
        return $localize`E-Mail oder Passwort ist falsch.`;
      }
    }
    return $localize`Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.`;
  }

  private cleanupTokenCheck(): void {
    if (this.tokenCheckTimeout) {
      clearTimeout(this.tokenCheckTimeout);
      this.tokenCheckTimeout = null;
    }
  }
}
