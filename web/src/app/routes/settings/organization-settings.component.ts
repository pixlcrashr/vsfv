import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../shared/components';
import {
  OrganizationSettingsDataService,
} from './organization-settings.data-service';

@Component({
  selector: 'app-organization-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageContentLayoutComponent, LoadingSpinnerComponent],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-content>
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Einstellungen werden geladen..." />
        } @else {
          <div class="max-w-2xl mx-auto">
            <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <!-- Organization Name -->
              <div>
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <ng-container i18n>Organisationsname</ng-container>
                </label>
                <input
                  type="text"
                  [formControl]="form.controls.name"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <!-- Description -->
              <div>
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <ng-container i18n>Beschreibung</ng-container>
                </label>
                <textarea
                  [formControl]="form.controls.description"
                  rows="3"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <!-- Fiscal Year Start (read-only after creation) -->
              <div>
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <ng-container i18n>Geschäftsjahr Beginn (Monat)</ng-container>
                </label>
                <p class="text-sm text-gray-900 dark:text-gray-100 py-1.5">
                  {{ monthName(fiscalYearStart) }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1" i18n>
                  Das Geschäftsjahr kann nach der Erstellung nicht mehr geändert werden.
                </p>
              </div>

              <!-- Auto-save indicator -->
              @if (saving()) {
                <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span class="inline-block w-3 h-3 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin"></span>
                  <ng-container i18n>Speichern...</ng-container>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class OrganizationSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(OrganizationSettingsDataService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  fiscalYearStart = 1;

  readonly form = new FormGroup({
    name: new FormControl<string>(''),
    description: new FormControl<string>(''),
  });

  readonly orgId = signal<string>('');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Einstellungen` }
  ];

  ngOnInit(): void {
    const orgId = this.route.snapshot.paramMap.get('orgId');
    if (orgId) {
      this.orgId.set(orgId);
      this.loadSettings(orgId);
    }
  }

  private loadSettings(orgId: string): void {
    this.loading.set(true);
    this.dataService.getSettings(orgId).subscribe({
      next: (settings) => {
        this.fiscalYearStart = settings.fiscalYearStart;
        this.form.setValue({
          name: settings.name,
          description: settings.description || '',
        });

        this.form.valueChanges.pipe(
          skip(1),
          debounceTime(800),
          distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
          takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => this.autoSave());

        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Einstellungen`);
        this.loading.set(false);
      },
    });
  }

  private autoSave(): void {
    const orgId = this.orgId();
    if (!orgId) return;

    this.saving.set(true);

    this.dataService.updateSettings(orgId, {
      name: this.form.controls.name.value ?? undefined,
      description: this.form.controls.description.value ?? undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern der Einstellungen`);
        this.saving.set(false);
      },
    });
  }

  monthName(month: number): string {
    const names = [
      $localize`Januar`, $localize`Februar`, $localize`März`, $localize`April`,
      $localize`Mai`, $localize`Juni`, $localize`Juli`, $localize`August`,
      $localize`September`, $localize`Oktober`, $localize`November`, $localize`Dezember`,
    ];
    return names[month - 1] || '';
  }
}
