import { Component, ChangeDetectionStrategy, signal, inject, OnInit, computed, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, filter } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSun, faMoon, faGear, faRightFromBracket, faCircleUser } from '@fortawesome/free-solid-svg-icons';
import { MenuItem, Organization } from '../../models';
import { getMostRecentOrganization } from '../../utils/organization.utils';
import { CurrentOrganizationService } from '../../services/current-organization.service';
import { MainLayoutDataService } from './main-layout.data-service';
import { CurrentUserService, CurrentUserInfo } from '../../../../lib/authz/current-user.service';
import { AuthorizationService } from '../../../../lib/authz/authorization.service';
import { Permissions } from '../../../../lib/authz/permissions';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, FormsModule, FontAwesomeModule],
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .route-container > :not(router-outlet) {
      display: block;
      height: 100%;
      min-height: 0;
    }
  `,
  template: `
    <div class="flex h-full w-full min-h-0 min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-950">
      <!-- Sidebar -->
      <aside class="flex min-h-0 w-52 min-w-52 flex-col bg-gray-900 border-r border-gray-800">
        <!-- Logo -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
          <img src="/favicon.ico" alt="Logo" class="w-5 h-5" />
          <h1 class="text-xs font-medium text-white">VS-Finanzverwaltung</h1>
        </div>

        <!-- Organization Selector -->
        <div class="px-2 py-2">
          <div class="flex items-center justify-between mb-1">
            <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500" i18n>Organisation</label>
            @if (loading()) {
              <svg class="w-3 h-3 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            }
          </div>
          <select
            [ngModel]="currentOrganizationId()"
            (ngModelChange)="onOrganizationChange($event)"
            [disabled]="loading() || organizations().length === 0"
            class="w-full px-2 py-1.5 text-xs bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (organizations().length === 0) {
              <option value="" i18n>Keine Organisationen</option>
            } @else {
              @for (org of organizations(); track org.id) {
                <option [value]="org.id">{{ org.name }}</option>
              }
            }
          </select>
        </div>

        <!-- Navigation (always show when organizations exist) -->
        @if (organizations().length > 0) {
        <nav class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <ul class="space-y-0.5">
            @for (item of generalMenuItems(); track item.name) {
              <li>
                <a
                  [routerLink]="item.path"
                  [class]="menuItemClasses(item)"
                >
                  {{ item.name }}
                </a>
              </li>
            }
          </ul>

          <div class="mt-4">
            <p i18n class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Rechnungswesen
            </p>
            <ul class="space-y-0.5">
              @for (item of applicationMenuItems(); track item.name) {
                <li>
                  <a [routerLink]="item.path" [class]="menuItemClasses(item)">
                    {{ item.name }}
                  </a>
                </li>
              }
            </ul>
          </div>

          <div class="mt-4">
            <p i18n class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Buchhaltung
            </p>
            <ul class="space-y-0.5">
              @for (item of bookkeepingMenuItems(); track item.name) {
                <li>
                  <a [routerLink]="item.path" [class]="menuItemClasses(item)">
                    {{ item.name }}
                  </a>
                </li>
              }
            </ul>
          </div>

          <div class="mt-4">
            <p i18n class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Haushalt
            </p>
            <ul class="space-y-0.5">
              @for (item of householdMenuItems(); track item.name) {
                <li>
                  <a [routerLink]="item.path" [class]="menuItemClasses(item)">
                    {{ item.name }}
                  </a>
                </li>
              }
            </ul>
          </div>
        </nav>
        }

        <!-- User Info Row -->
        <div class="border-t border-gray-800 px-2 py-2">
          <div class="flex items-center gap-2">
            <button
              type="button"
              routerLink="/me"
              class="flex items-center gap-2 flex-1 min-w-0 rounded p-1 hover:bg-gray-800 transition-colors"
              [title]="'Profil'"
            >
              <div class="flex-shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                @if (currentUser()?.pictureUrl) {
                  <img [src]="currentUser()!.pictureUrl" [alt]="currentUser()!.name" class="w-full h-full object-cover" />
                } @else {
                  <fa-icon [icon]="faCircleUser" class="text-gray-400 text-sm"></fa-icon>
                }
              </div>
              <p class="text-xs font-medium text-white truncate">{{ currentUser()?.name || 'Guest' }}</p>
            </button>
            <div class="flex items-center gap-1">
              @if (hasAdminAccess()) {
                <button
                  type="button"
                  routerLink="/admin"
                  class="p-1.5 rounded transition-colors"
                  [class]="isAdminRouteActive() ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'"
                  [attr.aria-label]="'Administration'"
                  [title]="'Systemeinstellungen'"
                >
                  <fa-icon [icon]="faGear" class="text-xs"></fa-icon>
                </button>
              }
              <button
                type="button"
                (click)="logout()"
                class="p-1.5 rounded text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                [attr.aria-label]="'Logout'"
                [title]="'Abmelden'"
              >
                <fa-icon [icon]="faRightFromBracket" class="text-xs"></fa-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Theme Toggle Row -->
        <div class="px-2 py-1.5 border-t border-gray-800">
          <button
            type="button"
            (click)="toggleTheme()"
            class="flex items-center justify-center gap-2 w-full px-2 py-1 rounded text-[11px] text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <fa-icon [icon]="isDarkMode() ? faSun : faMoon" class="text-[10px]"></fa-icon>
            <span i18n>{{ isDarkMode() ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>
        </div>

        <!-- Footer -->
        <footer class="px-2 py-2 border-t border-gray-800">
          <p class="text-[10px] text-center text-gray-500">
              © 2025 Vincent Heins<br />
              <a
                href="https://github.com/pixlcrashr/vsfv"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-white"
              >
                github.com/pixlcrashr/vsfv
              </a>
          </p>
        </footer>
      </aside>

      <!-- Main Content -->
      <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <div class="route-container min-h-0 flex-1 overflow-hidden">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class MainLayoutComponent implements OnInit {
  protected readonly router = inject(Router);
  private readonly currentOrganizationService = inject(CurrentOrganizationService);
  private readonly dataService = inject(MainLayoutDataService);
  private readonly currentUserService = inject(CurrentUserService);
  private readonly authorizationService = inject(AuthorizationService);

  readonly faSun = faSun;
  readonly faMoon = faMoon;
  readonly faGear = faGear;
  readonly faRightFromBracket = faRightFromBracket;
  readonly faCircleUser = faCircleUser;

  readonly isDarkMode = signal(false);
  readonly organizations = signal<Organization[]>([]);
  readonly loading = signal(true);
  readonly currentUser = signal<CurrentUserInfo | null>(null);
  readonly hasAdminAccess = signal(false);

  readonly currentOrganizationId = signal<string>('');

  // Extracts :orgId from the current URL path directly — avoids snapshot timing issues.
  private orgIdFromUrl(): string {
    const m = this.router.url.match(/\/organizations\/([^/?#]+)/);
    return m ? m[1] : '';
  }

  // Computed menu items that include the organization ID
  readonly orgIdFromRoute = computed(() => {
    return this.currentOrganizationService.currentOrganization()?.id ?? this._routeOrgId();
  });

  private readonly _routeOrgId = signal<string>('');

  // Check if we have an organization selected or are on an org-prefixed route
  readonly hasOrganization = computed(() => {
    return this.currentOrganizationService.hasOrganization() || this.orgIdFromRoute() !== '';
  });

  readonly generalMenuItems = computed<MenuItem[]>(() => {
    const orgId = this.orgIdFromRoute();
    if (!orgId) return [];
    return [
      { name: $localize`Dashboard`, path: `/organizations/${orgId}/dashboard` },
      { name: $localize`Einstellungen`, path: `/organizations/${orgId}/settings` },
      { name: $localize`Audit-Log`, path: `/organizations/${orgId}/auditLog` },
    ];
  });

  readonly applicationMenuItems = computed<MenuItem[]>(() => {
    const orgId = this.orgIdFromRoute();
    if (!orgId) return [];
    return [{ name: $localize`Kostenerstattungen`, path: `/organizations/${orgId}/reimbursements` }];
  });

  readonly householdMenuItems = computed<MenuItem[]>(() => {
    const orgId = this.orgIdFromRoute();
    if (!orgId) return [];
    return [
      { name: $localize`Matrix`, path: `/organizations/${orgId}/matrix` },
      { name: $localize`Pläne`, path: `/organizations/${orgId}/budgets` },
      { name: $localize`Konten`, path: `/organizations/${orgId}/accounts`, excludePaths: [`/organizations/${orgId}/accounts/compare`] },
      { name: $localize`Kontenvergleich`, path: `/organizations/${orgId}/accounts/compare` },
      { name: $localize`Kontengruppen`, path: `/organizations/${orgId}/accountGroups` },
      { name: $localize`Journal`, path: `/organizations/${orgId}/journal` },
      { name: $localize`Berichte`, path: `/organizations/${orgId}/reports` },
      { name: $localize`Berichtsvorlagen`, path: `/organizations/${orgId}/reportTemplates` },
    ];
  });

  readonly bookkeepingMenuItems = computed<MenuItem[]>(() => {
    const orgId = this.orgIdFromRoute();
    if (!orgId) return [];
    return [
      { name: $localize`Buchhaltungskonten`, path: `/organizations/${orgId}/ledgerAccounts` },
      { name: $localize`Geschäftsjahre`, path: `/organizations/${orgId}/ledgerYears` },
    ];
  });

  constructor() {
    this.initializeTheme();
    // Setup organization change handler
    this.orgChangeSubject.pipe(
      takeUntil(this.destroy$)
    ).subscribe((organizationId) => {
      this.selectOrganization(organizationId);
      // Stay on the same route segment, just replace the orgId
      const currentUrl = this.router.url;
      const orgRouteMatch = currentUrl.match(/^\/organizations\/([^/]+)(\/[^?#]*)(.*)$/);
      if (orgRouteMatch) {
        const remainingPath = orgRouteMatch[2];
        const queryAndHash = orgRouteMatch[3];
        this.router.navigateByUrl(`/organizations/${organizationId}${remainingPath}${queryAndHash}`);
      } else {
        this.router.navigate(['/organizations', organizationId, 'dashboard']);
      }
    });
  }

  ngOnInit(): void {
    this._routeOrgId.set(this.orgIdFromUrl());

    // Keep _routeOrgId in sync on every navigation
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe((e) => {
      const orgId = e.urlAfterRedirects.match(/\/organizations\/([^/?#]+)/)?.[1] ?? '';
      this._routeOrgId.set(orgId);
      if (orgId && this.organizations().length > 0) {
        this.syncToUrlOrgId(orgId);
      }
      if (!orgId && (e.urlAfterRedirects === '/' || e.urlAfterRedirects === '')) {
        const selectedOrgId = this.currentOrganizationService.currentOrganization()?.id
          ?? this.currentOrganizationId();
        if (selectedOrgId) {
          this.router.navigate(['/organizations', selectedOrgId, 'dashboard']);
        }
      }
    });

    this.loadOrganizations();
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    this.currentUserService.getCurrentUser().pipe(
      takeUntil(this.destroy$),
    ).subscribe((user) => {
      this.currentUser.set(user);
      if (user) {
        this.authorizationService.checkPermissions(
          `users/${user.id}`,
          '',
          [Permissions.ORGANIZATIONS_READ, Permissions.USERS_READ, Permissions.GROUPS_READ, Permissions.AUDIT_LOGS_READ],
        ).pipe(takeUntil(this.destroy$)).subscribe((result) => {
          this.hasAdminAccess.set(
            result[Permissions.ORGANIZATIONS_READ] ||
            result[Permissions.USERS_READ] ||
            result[Permissions.GROUPS_READ] ||
            result[Permissions.AUDIT_LOGS_READ],
          );
        });
      }
    });
  }

  logout(): void {
    void this.router.navigate(['/logout']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncToUrlOrgId(urlOrgId: string): void {
    const orgs = this.organizations();
    const currentOrg = this.currentOrganizationService.currentOrganization();
    const org = orgs.find((o) => o.id === urlOrgId);
    if (org && (!currentOrg || currentOrg.id !== org.id)) {
      this.selectOrganization(org.id);
    }
  }

  private loadOrganizations(): void {
    this.loading.set(true);
    this.dataService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations.set(orgs);
        this.loading.set(false);

        const currentOrg = this.currentOrganizationService.currentOrganization();
        const urlOrgId = this.orgIdFromUrl();

        if (urlOrgId) {
          const org = orgs.find((o) => o.id === urlOrgId);
          if (org) {
            if (!currentOrg || currentOrg.id !== org.id) {
              this.selectOrganization(org.id);
            } else {
              this.currentOrganizationId.set(org.id);
            }
          } else if (!currentOrg && orgs.length > 0) {
            const defaultOrg = getMostRecentOrganization(orgs);
            if (defaultOrg) {
              this.selectOrganization(defaultOrg.id);
            }
          }
        } else if (currentOrg) {
          this.currentOrganizationId.set(currentOrg.id);
          if (this.router.url === '/' || this.router.url === '') {
            this.router.navigate(['/organizations', currentOrg.id, 'dashboard']);
          }
        } else if (orgs.length > 0) {
          const defaultOrg = getMostRecentOrganization(orgs);
          if (defaultOrg) {
            this.selectOrganization(defaultOrg.id);
            if (this.router.url === '/' || this.router.url === '') {
              this.router.navigate(['/organizations', defaultOrg.id, 'dashboard']);
            }
          }
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onOrganizationChange(organizationId: string): void {
    if (!organizationId) return;
    this.orgChangeSubject.next(organizationId);
  }

  private selectOrganization(organizationId: string): void {
    if (!organizationId) {
      this.currentOrganizationId.set('');
      this.currentOrganizationService.setOrganization(null);
      return;
    }

    const org = this.organizations().find((o) => o.id === organizationId);
    if (org) {
      this.currentOrganizationId.set(organizationId);
      this.currentOrganizationService.setOrganization(org);
    }
  }

  readonly isCreateOrgFormVisible = signal(false);
  readonly newOrgName = signal('');
  readonly newOrgDescription = signal('');

  private readonly orgChangeSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  isAdminRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl === '/admin' || currentUrl.startsWith('/admin/');
  }

  isMenuItemActive(item: MenuItem): boolean {
    // Check if this is an admin route - admin routes don't have org prefix
    const isAdminRoute = item.path.startsWith('/admin/');
    if (isAdminRoute) {
      const currentUrl = this.router.url;
      const matchesPath = currentUrl === item.path || currentUrl.startsWith(`${item.path}/`);

      if (!matchesPath) {
        return false;
      }

      return !(item.excludePaths ?? []).some(
        (excludedPath) =>
          currentUrl === excludedPath || currentUrl.startsWith(`${excludedPath}/`),
      );
    }

    // For org routes, extract the org path prefix and compare route segments
    const currentUrl = this.router.url;
    const orgId = this.orgIdFromRoute();

    if (!orgId) return false;

    // Build the full path with current org ID
    const fullPath = item.path.replace(/\/organizations\/[^/]+/, `/organizations/${orgId}`);

    const matchesPath = currentUrl === fullPath || currentUrl.startsWith(`${fullPath}/`);

    if (!matchesPath) {
      return false;
    }

    // Check excluded paths with current org ID
    const excludedPaths = item.excludePaths?.map(ep =>
      ep.replace(/\/organizations\/[^/]+/, `/organizations/${orgId}`)
    ) ?? [];

    return !excludedPaths.some(
      (excludedPath) =>
        currentUrl === excludedPath || currentUrl.startsWith(`${excludedPath}/`),
    );
  }

  menuItemClasses(item: MenuItem): string {
    const baseClasses = 'block px-2 py-1.5 rounded text-xs transition-colors';

    if (this.isMenuItemActive(item)) {
      return `${baseClasses} bg-blue-600 text-white font-semibold`;
    }

    return `${baseClasses} text-gray-300 hover:bg-gray-800 hover:text-white`;
  }

  toggleTheme(): void {
    this.applyTheme(!this.isDarkMode());
  }

  private initializeTheme(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const savedTheme = window.localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDarkMode = savedTheme ? savedTheme === 'dark' : prefersDark;

    this.applyTheme(useDarkMode, false);

    // Listen for browser theme changes when no user override is stored
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (window.localStorage.getItem('theme')) return;
      this.applyTheme(e.matches, false);
    });
  }

  private applyTheme(isDark: boolean, persist = true): void {
    this.isDarkMode.set(isDark);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }

    if (persist && typeof window !== 'undefined') {
      window.localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
  }
}
