import { Component, ChangeDetectionStrategy, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';

interface AdminMenuItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .admin-content-area > :not(router-outlet) {
      display: block;
      height: 100%;
      min-height: 0;
    }
  `,
  template: `
    <div class="flex h-full min-h-0">
      <!-- Left sidebar -->
      <aside class="flex w-48 min-w-48 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="flex items-center px-4 py-2 h-[37px] border-b border-gray-200 dark:border-gray-800">
          <h1 class="text-sm font-semibold text-gray-900 dark:text-gray-100" i18n>Systemeinstellungen</h1>
        </div>
        <nav class="flex-1 overflow-y-auto px-2 py-2">
          <ul class="space-y-0.5">
            @for (item of menuItems; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  class="block px-2 py-1.5 rounded text-xs transition-colors"
                  [class]="isActive(item.path) ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'"
                >
                  {{ item.label }}
                </a>
              </li>
            }
          </ul>
        </nav>
      </aside>

      <!-- Content area -->
      <div class="admin-content-area h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AdminLayoutComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly menuItems: AdminMenuItem[] = [
    { label: $localize`Organisationen`, path: '/admin/organizations' },
    { label: $localize`Benutzer`, path: '/admin/users' },
    { label: $localize`Gruppen`, path: '/admin/groups' },
    { label: $localize`Audit-Log`, path: '/admin/auditLog' },
  ];

  private currentUrl = '';

  constructor() {
    this.currentUrl = this.router.url;
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe((e) => {
      this.currentUrl = e.urlAfterRedirects;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isActive(path: string): boolean {
    return this.currentUrl === path || this.currentUrl.startsWith(`${path}/`);
  }
}
