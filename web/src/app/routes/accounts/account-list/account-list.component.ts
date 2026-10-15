import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { forkJoin, merge, map, distinctUntilChanged, filter, timer } from 'rxjs';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  StatusBadgeComponent,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  AccountCodeCellComponent,
  NotificationService,
} from '../../../shared/components';
import {
  CreateAccountDialogComponent,
  CreateAccountDialogInput,
  CreateAccountDialogOutput,
} from '../../../shared/dialogs/create-account-dialog/create-account-dialog.component';
import { HierarchicalAccount } from '../../../shared/models';
import { AccountHierarchyService } from '../../../shared/services/account-hierarchy.service';
import { AccountListDataService } from './account-list.data-service';

@Component({
  selector: 'app-account-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContentLayoutComponent,
    ButtonComponent,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    AccountCodeCellComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <app-button layout-header-actions (clicked)="openCreateDialog()"><ng-container i18n>Hinzufügen</ng-container></app-button>

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Konten werden geladen..." />
        } @else if (accounts().length === 0) {
          <app-empty-state
            i18n-title title="Keine Konten vorhanden"
            i18n-description description="Erstellen Sie Ihr erstes Konto, um mit der Buchführung zu beginnen."
          >
            <app-button (clicked)="openCreateDialog()"><ng-container i18n>Konto erstellen</ng-container></app-button>
          </app-empty-state>
        } @else {
          <div class="w-full max-w-6xl">
            <div class="bg-white rounded-lg border border-gray-200">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <ng-container i18n>Kontonummer</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <ng-container i18n>Name</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <ng-container i18n>Typ</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <ng-container i18n>Beschreibung</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <ng-container i18n>Status</ng-container>
                      </th>
                      <th scope="col" class="px-3 py-1 text-right">
                        <span class="sr-only">Aktionen</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    @for (account of flatAccounts(); track account.id) {
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-1 text-xs text-gray-900 whitespace-nowrap">
                          <app-account-code-cell [code]="account.code" [depth]="account.depth" />
                        </td>
                        <td class="px-3 py-1 text-xs text-gray-900">
                          {{ account.name }}
                        </td>
                        <td class="px-3 py-1 text-xs">
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                                [class.bg-blue-100]="account.isContainer"
                                [class.text-blue-700]="account.isContainer"
                                [class.bg-gray-100]="!account.isContainer"
                                [class.text-gray-600]="!account.isContainer">
                            {{ account.isContainer ? 'Gruppe' : 'Konto' }}
                          </span>
                        </td>
                        <td class="px-3 py-1 text-[11px] text-gray-500">
                          <div class="max-w-xs truncate" [title]="account.description || ''">
                            {{ account.description || '-' }}
                          </div>
                        </td>
                        <td class="px-3 py-1 text-xs">
                          <app-status-badge size="sm" [variant]="account.isArchived ? 'neutral' : 'success'">
                            <ng-container i18n>{{ account.isArchived ? 'Archiviert' : 'Aktiv' }}</ng-container>
                          </app-status-badge>
                        </td>
                        <td class="px-3 py-1 text-right text-xs">
                          <div class="flex items-center justify-end gap-2">
                            @if (account.isArchived && canRestore(account)) {
                              <button
                                type="button"
                                class="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                                [disabled]="isMutatingAccount(account.id)"
                                (click)="restoreAccount(account)"
                              >
                                <ng-container i18n>{{ restoringAccountId() === account.id ? 'Wird wiederhergestellt...' : 'Wiederherstellen' }}</ng-container>
                              </button>
                            } @else if (!account.isArchived && canArchive(account)) {
                              <button
                                type="button"
                                class="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                                [disabled]="isMutatingAccount(account.id)"
                                (click)="archiveAccount(account)"
                              >
                                <ng-container i18n>{{ archivingAccountId() === account.id ? 'Wird archiviert...' : 'Archivieren' }}</ng-container>
                              </button>
                            }
                            <a
                              [routerLink]="['/organizations', orgId, 'accounts', account.id]"
                              class="text-xs text-blue-600 hover:underline"
                            >
                              <ng-container i18n>Bearbeiten</ng-container>
                            </a>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class AccountListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(AccountListDataService);
  private readonly dialog = inject(Dialog);
  private readonly notifications = inject(NotificationService);
  private readonly hierarchy = inject(AccountHierarchyService);

  orgId = '';

  readonly loading = signal(true);
  readonly archivingAccountId = signal<string | null>(null);
  readonly restoringAccountId = signal<string | null>(null);
  readonly accounts = signal<HierarchicalAccount[]>([]);
  // The data services return a nested tree, while the hierarchy service
  // expects a flat list: collect all nodes first, otherwise children are lost.
  readonly flatAccounts = computed<HierarchicalAccount[]>(() => {
    const flat: HierarchicalAccount[] = [];
    const walk = (nodes: HierarchicalAccount[]): void => {
      for (const node of nodes) {
        flat.push(node);
        walk(node.children);
      }
    };
    walk(this.accounts());
    return this.hierarchy.flatten(flat);
  });

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: $localize`Haushaltskonten` }];

  constructor() {
    merge(...this.route.pathFromRoot.map(r => r.params)).pipe(
      map(params => params['orgId'] as string | undefined),
      filter((id): id is string => !!id),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.orgId = id;
      this.loading.set(true);
      this.accounts.set([]);
      this.loadAccounts();
    });
  }

  private loadAccounts(): void {
    this.dataService.listAccounts(this.orgId).subscribe({
      next: (hierarchical) => {
        this.accounts.set(hierarchical);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notifications.error($localize`Fehler beim Laden der Konten`);
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<CreateAccountDialogOutput, CreateAccountDialogInput>(
      CreateAccountDialogComponent,
      {
        backdropClass: 'cdk-overlay-dark-backdrop',
        width: '500px',
        data: { organizationId: this.orgId },
      }
    );

    dialogRef.closed.subscribe((result) => {
      if (result?.created) {
        this.loadAccounts();
      }
    });
  }

  canArchive(account: HierarchicalAccount): boolean {
    return this.allChildrenArchived(account.children);
  }

  canRestore(account: HierarchicalAccount): boolean {
    // An account can only be restored if its parent is not archived.
    // Restoring must happen top-down: restore the parent first.
    if (!account.parentAccountId) return true;
    const parent = this.flatAccounts().find((a) => a.id === account.parentAccountId);
    return !parent || !parent.isArchived;
  }

  private allChildrenArchived(children: HierarchicalAccount[]): boolean {
    return children.every((child) => child.isArchived && this.allChildrenArchived(child.children));
  }

  isMutatingAccount(id: string): boolean {
    return this.archivingAccountId() === id || this.restoringAccountId() === id;
  }

  archiveAccount(account: HierarchicalAccount): void {
    if (this.isMutatingAccount(account.id)) return;

    this.archivingAccountId.set(account.id);
    forkJoin([this.dataService.archiveAccount(this.orgId, account.id), timer(500)]).subscribe({
      next: () => {
        this.archivingAccountId.set(null);
        this.loadAccounts();
      },
      error: () => {
        this.archivingAccountId.set(null);
        this.notifications.error($localize`Fehler beim Archivieren des Kontos`);
      },
    });
  }

  restoreAccount(account: HierarchicalAccount): void {
    if (this.isMutatingAccount(account.id)) return;

    this.restoringAccountId.set(account.id);
    forkJoin([this.dataService.restoreAccount(this.orgId, account.id), timer(500)]).subscribe({
      next: () => {
        this.restoringAccountId.set(null);
        this.loadAccounts();
      },
      error: () => {
        this.restoringAccountId.set(null);
        this.notifications.error($localize`Fehler beim Wiederherstellen des Kontos`);
      },
    });
  }
}
