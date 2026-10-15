import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  effect,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components';

const PREVIEW_KEY_PREFIX = 'rt-preview-';

/**
 * Shared Go HTML template editor used by the report template new/edit pages.
 *
 * Keeps the unsaved template content in localStorage under a per-editor
 * preview ID so the standalone preview window (route
 * /preview/report-template/:previewId) can render it and live-reload on
 * every change. The PDF preview opens the same window with ?print=1, which
 * triggers the browser print dialog after rendering (print-to-PDF).
 */
@Component({
  selector: 'app-report-template-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent],
  template: `
    <!-- Template Editor -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 i18n class="text-sm font-semibold text-gray-900">
          Vorlage
        </h2>
        <div class="flex items-center gap-3">
          <span i18n class="hidden md:inline text-xs text-gray-500">
            Verwenden Sie Go-Template-Syntax für dynamische Inhalte
          </span>
          <app-button variant="secondary" size="xs" (clicked)="openHtmlPreview()">
            <ng-container i18n>HTML-Vorschau</ng-container>
          </app-button>
          <app-button variant="secondary" size="xs" (clicked)="openPdfPreview()">
            <ng-container i18n>PDF-Vorschau</ng-container>
          </app-button>
        </div>
      </div>
      <textarea
        [ngModel]="templateContent()"
        (ngModelChange)="templateContent.set($event)"
        rows="20"
        [placeholder]="placeholderText"
        class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      ></textarea>
    </div>

    <!-- Help Section -->
    <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 mt-3">
      <h3 i18n class="text-xs font-medium text-gray-900 mb-2">
        Verfügbare Variablen
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
        @for (variable of variables; track variable.code) {
          <div><code class="bg-gray-100 px-1 rounded">{{ variable.code }}</code> - {{ variable.label }}</div>
        }
      </div>
    </div>
  `,
})
export class ReportTemplateEditorComponent implements OnDestroy {
  readonly templateContent = model('');

  private readonly previewId = crypto.randomUUID();

  readonly placeholderText = `<div>
  <h1>{{ .Budget.Name }}</h1>
  <table>
    {{ range .Accounts }}
    <tr>
      <td>{{ .Code }}</td>
      <td>{{ .Name }}</td>
      <td>{{ .Balance }}</td>
    </tr>
    {{ end }}
  </table>
</div>`;

  readonly variables = [
    { code: '{{ .Budget.Name }}', label: $localize`Budgetname` },
    { code: '{{ .Budget.StartDate }}', label: $localize`Startdatum` },
    { code: '{{ .Budget.EndDate }}', label: $localize`Enddatum` },
    { code: '{{ range .Accounts }}...{{ end }}', label: $localize`Kontenliste` },
    { code: '{{ .Code }}', label: $localize`Kontonummer` },
    { code: '{{ .Name }}', label: $localize`Kontoname` },
    { code: '{{ .Balance }}', label: $localize`Kontosaldo` },
    { code: '{{ .Date | formatDate }}', label: $localize`Datum formatieren` },
  ];

  constructor() {
    // Mirror the current template content into localStorage so an open
    // preview window live-reloads while editing.
    effect(() => {
      this.updatePreviewStorage();
    });
  }

  openHtmlPreview(): void {
    this.updatePreviewStorage();
    window.open(`/preview/report-template/${this.previewId}`, '_blank');
  }

  openPdfPreview(): void {
    this.updatePreviewStorage();
    window.open(`/preview/report-template/${this.previewId}?print=1`, '_blank');
  }

  private updatePreviewStorage(): void {
    localStorage.setItem(PREVIEW_KEY_PREFIX + this.previewId, this.templateContent());
  }

  ngOnDestroy(): void {
    localStorage.removeItem(PREVIEW_KEY_PREFIX + this.previewId);
  }
}
