import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  PageContentLayoutComponent,
  BreadcrumbItem,
  ButtonComponent,
  LoadingSpinnerComponent,
  NotificationService,
} from '../../../shared/components';
import { formatDateShort } from '../../../shared/utils';
import { ReportTemplate } from '../../../shared/models';
import { ReportTemplateEditDataService } from './report-template-edit.data-service';
import { ReportTemplateEditorComponent } from '../report-template-editor/report-template-editor.component';

@Component({
  selector: 'app-report-template-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageContentLayoutComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
    ReportTemplateEditorComponent,
  ],
  template: `
    <app-page-content-layout [breadcrumbs]="breadcrumbs">
      <div layout-header-actions class="flex gap-2">
          <app-button variant="secondary" (clicked)="cancel()">
            <ng-container i18n>Abbrechen</ng-container>
          </app-button>
          <app-button
            variant="primary"
            [disabled]="saving() || !isValid()"
            (clicked)="save()"
          >
            <ng-container i18n>{{ saving() ? 'Wird gespeichert...' : 'Speichern' }}</ng-container>
          </app-button>
      </div>

      <div layout-content class="flex flex-1 justify-center">
        @if (loading()) {
          <app-loading-spinner [fullPage]="true" i18n-text text="Vorlage wird geladen..." />
        } @else if (template()) {
          <div class="w-full max-w-3xl space-y-3">
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
                    rows="2"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Template Editor -->
            <app-report-template-editor [(templateContent)]="templateContent" />

            <!-- Metadata -->
            <div i18n class="text-xs text-gray-500">
              Erstellt: {{ formatDate(template()!.createdAt) }} ·
              Zuletzt aktualisiert: {{ formatDate(template()!.updatedAt) }}
            </div>
          </div>
        }
      </div>
    </app-page-content-layout>
  `,
})
export class ReportTemplateEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(ReportTemplateEditDataService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly template = signal<ReportTemplate | null>(null);

  name = '';
  description = '';
  templateContent = '';

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: $localize`Berichtsvorlagen`, path: '' },
    { label: $localize`Bearbeiten` },
  ];

  private templateId = '';
  private orgId = '';

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
    this.breadcrumbs[0].path = `/organizations/${this.orgId}/reportTemplates`;
    this.templateId = this.route.snapshot.paramMap.get('id') || '';
    if (this.templateId) {
      this.loadTemplate();
    }
  }

  private loadTemplate(): void {
    this.dataService.getTemplate(this.orgId, this.templateId).subscribe({
      next: (template) => {
        this.template.set(template);
        this.name = template.name;
        this.description = template.description;
        this.templateContent = template.template;
        this.loading.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Laden der Berichtsvorlage`);
        this.loading.set(false);
      },
    });
  }

  isValid(): boolean {
    return this.name.trim().length > 0;
  }

  save(): void {
    if (!this.isValid()) return;

    this.saving.set(true);
    this.dataService.updateTemplate(this.orgId, this.templateId, {
      name: this.name.trim(),
      description: this.description.trim(),
      template: this.templateContent,
    }).subscribe({
      next: (updated) => {
        this.template.set(updated);
        this.saving.set(false);
      },
      error: () => {
        this.notifications.error($localize`Fehler beim Speichern der Berichtsvorlage`);
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/organizations', this.orgId, 'reportTemplates']);
  }

  formatDate(date: Date): string {
    return formatDateShort(date);
  }
}
