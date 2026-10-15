import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import { formatDateShort } from '../../../shared/utils';
import { Committee, CommitteePaymentAccountKind } from '../../../shared/models';
import { CommitteeMember, CommitteeUser, PaymentAccountInput, SaveCommitteeInput } from '../committee-form.model';
import { CommitteeEditDataService } from './committee-edit.data-service';

@Component({
  selector: 'app-committee-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-header-actions class="flex gap-2">
          <app-button variant="secondary" (clicked)="cancel()">
            <ng-container i18n>Fertig</ng-container>
          </app-button>
      </div>

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Gremium wird geladen..." />
        } @else if (committee()) {
          <div class="w-full max-w-4xl space-y-3">
            <!-- Basic Info -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <h2 i18n class="text-sm font-semibold text-gray-900 mb-4">
                Grundinformationen
              </h2>
              <div class="space-y-3">
                <div>
                  <label
                    for="name"
                    class="block text-xs font-medium text-gray-500 mb-1"
                  >
                    <ng-container i18n>Name *</ng-container>
                  </label>
                  <input
                    id="name"
                    type="text"
                    [(ngModel)]="name"
                    (ngModelChange)="onFormChanged()"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    for="description"
                    class="block text-xs font-medium text-gray-500 mb-1"
                  >
                    <ng-container i18n>Beschreibung</ng-container>
                  </label>
                  <textarea
                    id="description"
                    [(ngModel)]="description"
                    (ngModelChange)="onFormChanged()"
                    rows="2"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  ></textarea>
                </div>
                <div>
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      [(ngModel)]="allowScopeSelection"
                      (ngModelChange)="onFormChanged()"
                      class="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span i18n class="text-xs text-gray-900">Gewerbliche Einreichungen erlauben</span>
                  </label>
                  <p i18n class="text-xs text-gray-500 mt-1 ml-5">
                    Falls aktiviert, können Gremienmitglieder bei Einreichungen zwischen hoheitlich und gewerblich wählen. Andernfalls werden Einreichungen immer als hoheitlich angelegt.
                  </p>
                </div>
              </div>
            </div>

            <!-- Payment Accounts -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center justify-between mb-4">
                <h2 i18n class="text-sm font-semibold text-gray-900">
                  Zahlungskonten
                </h2>
                <span i18n class="text-xs text-gray-500">
                  Konten, von denen aus das Gremium Ausgaben bezahlen kann
                </span>
              </div>
              @if (paymentAccounts.length === 0) {
                <p i18n class="text-xs text-gray-500 mb-3">
                  Keine Zahlungskonten vorhanden. Gremienmitglieder reichen Ausgaben dann über die private Kontoabrechnung ein.
                </p>
              }
              <div class="space-y-2">
                @for (account of paymentAccounts; track $index) {
                  <div class="flex items-center gap-2">
                    <select
                      [(ngModel)]="account.kind"
                      (ngModelChange)="onFormChanged()"
                      class="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="bank_account" i18n>Bankkonto</option>
                      <option value="cash_box" i18n>Kasse</option>
                    </select>
                    <input
                      type="text"
                      [(ngModel)]="account.label"
                      (ngModelChange)="onFormChanged()"
                      [placeholder]="accountLabelPlaceholder"
                      class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      (click)="removePaymentAccount($index)"
                      i18n-title
                      title="Konto entfernen"
                      class="px-2 py-1.5 text-xs text-red-600 hover:underline"
                    >
                      <ng-container i18n>Entfernen</ng-container>
                    </button>
                  </div>
                }
              </div>
              <button
                type="button"
                (click)="addPaymentAccount()"
                class="mt-3 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                <ng-container i18n>+ Konto hinzufügen</ng-container>
              </button>
              <p i18n class="text-xs text-gray-500 mt-3">
                Achtung: Bereits in Einreichungen referenzierte Konten sollten nicht entfernt werden.
              </p>
            </div>

            <!-- Members -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <div class="flex items-center justify-between mb-4">
                <h2 i18n class="text-sm font-semibold text-gray-900">
                  Mitglieder
                </h2>
                <span i18n class="text-xs text-gray-500">
                  Mitglieder können Einreichungen im Namen des Gremiums erstellen
                </span>
              </div>
              @if (members().length === 0) {
                <p i18n class="text-xs text-gray-500 mb-3">
                  Keine Mitglieder zugewiesen.
                </p>
              }
              <div class="space-y-2">
                @for (member of members(); track member.id) {
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-900">{{ member.userName }}</span>
                    <span class="text-xs text-gray-500">{{ member.userEmail }}</span>
                    <span class="flex-1"></span>
                    <button
                      type="button"
                      (click)="removeMember(member)"
                      i18n-title
                      title="Mitglied entfernen"
                      class="px-2 py-1.5 text-xs text-red-600 hover:underline"
                    >
                      <ng-container i18n>Entfernen</ng-container>
                    </button>
                  </div>
                }
              </div>
              <div class="flex items-center gap-2 mt-3">
                <select
                  [(ngModel)]="selectedUserId"
                  class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" i18n>Benutzer auswählen...</option>
                  @for (user of availableUsers(); track user.id) {
                    <option [value]="user.id">{{ user.displayName }} ({{ user.email }})</option>
                  }
                </select>
                <button
                  type="button"
                  (click)="addMember()"
                  [disabled]="!selectedUserId || addingMember()"
                  class="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ng-container i18n>{{ addingMember() ? 'Wird hinzugefügt...' : '+ Mitglied hinzufügen' }}</ng-container>
                </button>
              </div>
            </div>

            <!-- Metadata -->
            <div i18n class="text-xs text-gray-500">
              Erstellt: {{ formatDate(committee()!.createdAt) }} ·
              Zuletzt aktualisiert: {{ formatDate(committee()!.updatedAt) }}
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class CommitteeEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(CommitteeEditDataService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly committee = signal<Committee | null>(null);
  readonly members = signal<CommitteeMember[]>([]);
  readonly users = signal<CommitteeUser[]>([]);
  readonly addingMember = signal(false);

  // Users that are not yet members of the committee.
  readonly availableUsers = computed(() => {
    const memberIds = new Set(this.members().map((member) => member.user));
    return this.users().filter((user) => !memberIds.has(user.id));
  });

  name = '';
  description = '';
  allowScopeSelection = false;
  paymentAccounts: PaymentAccountInput[] = [];
  selectedUserId = '';

  readonly accountLabelPlaceholder = $localize`z.B. Gremiumskonto`;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Gremien`, path: '' },
    { label: $localize`Bearbeiten` },
  ];

  private committeeId = '';
  private orgId = '';

  /** Emits a form snapshot on every user edit; debounced autosave below. */
  private readonly formChanged$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private loaded = false;

  private getOrgId(): string {
    let snapshot = this.route.snapshot;
    while (snapshot) {
      const id = snapshot.paramMap.get('orgId');
      if (id) return id;
      snapshot = snapshot.parent!;
    }
    return '';
  }

  ngOnInit(): void {
    this.orgId = this.getOrgId();
    this.breadcrumbs[0].path = `/organizations/${this.orgId}/committees`;
    this.committeeId = this.route.snapshot.paramMap.get('id') || '';
    if (this.committeeId) {
      this.loadCommittee();
      this.loadMembers();
      this.loadUsers();
      this.setupAutoSave();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Debounced autosave, mirroring the pattern of the organization edit
   * route: every user edit emits a form snapshot, which is saved 500 ms
   * after the last change — but only when the form is valid and the
   * snapshot actually differs from the previously saved one.
   */
  private setupAutoSave(): void {
    this.formChanged$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged((prev, curr) => prev === curr),
      filter(() => this.loaded && this.isValid()),
    ).subscribe(() => this.save());
  }

  onFormChanged(): void {
    this.formChanged$.next(JSON.stringify(this.formSnapshot()));
  }

  private formSnapshot(): SaveCommitteeInput {
    return {
      name: this.name.trim(),
      description: this.description.trim(),
      allowScopeSelection: this.allowScopeSelection,
      paymentAccounts: this.paymentAccounts.map((account) => ({
        ...account,
        label: account.label.trim(),
      })),
    };
  }

  private loadCommittee(): void {
    this.dataService.getCommittee(this.orgId, this.committeeId).subscribe({
      next: (committee) => {
        this.committee.set(committee);
        this.name = committee.name;
        this.description = committee.description ?? '';
        this.allowScopeSelection = committee.allowScopeSelection;
        this.paymentAccounts = committee.paymentAccounts.map((account) => ({
          uid: account.uid,
          kind: account.kind,
          label: account.label,
        }));
        this.loaded = true;
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden des Gremiums`);
        this.loading.set(false);
      },
    });
  }

  isValid(): boolean {
    return this.name.trim().length > 0
      && this.paymentAccounts.every((account) => account.label.trim().length > 0);
  }

  addPaymentAccount(): void {
    this.paymentAccounts.push({ uid: '', kind: 'bank_account' as CommitteePaymentAccountKind, label: '' });
    this.onFormChanged();
  }

  removePaymentAccount(index: number): void {
    this.paymentAccounts.splice(index, 1);
    this.onFormChanged();
  }

  addMember(): void {
    if (!this.selectedUserId) return;

    this.addingMember.set(true);
    this.dataService.addMember(this.orgId, this.committeeId, this.selectedUserId).subscribe({
      next: (member) => {
        this.members.update((members) => [member, ...members]);
        this.selectedUserId = '';
        this.addingMember.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Hinzufügen des Mitglieds`);
        this.addingMember.set(false);
      },
    });
  }

  removeMember(member: CommitteeMember): void {
    this.dataService.removeMember(this.orgId, this.committeeId, member.id).subscribe({
      next: () => {
        this.members.update((members) => members.filter((m) => m.id !== member.id));
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Entfernen des Mitglieds`);
      },
    });
  }

  private loadMembers(): void {
    this.dataService.listMembers(this.orgId, this.committeeId).subscribe({
      next: (members) => this.members.set(members),
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Mitglieder`);
      },
    });
  }

  private loadUsers(): void {
    this.dataService.listUsers(this.orgId).subscribe({
      next: (users) => this.users.set(users),
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Benutzer`);
      },
    });
  }

  save(): void {
    if (!this.isValid()) return;

    this.saving.set(true);
    this.dataService.updateCommittee(this.orgId, this.committeeId, this.formSnapshot()).subscribe({
      next: (updated) => {
        this.committee.set(updated);
        this.paymentAccounts = updated.paymentAccounts.map((account) => ({
          uid: account.uid,
          kind: account.kind,
          label: account.label,
        }));
        this.saving.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern des Gremiums`);
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/organizations', this.orgId, 'committees']);
  }

  formatDate(date: Date): string {
    return formatDateShort(date);
  }
}
