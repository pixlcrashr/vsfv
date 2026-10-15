import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ReportTemplateEditDataService } from '../report-template-edit/report-template-edit.data-service';
import { NotificationService } from '../../../shared/components';

const PREVIEW_KEY_PREFIX = 'rt-preview-';

@Component({
  selector: 'app-report-template-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <div class="flex items-center justify-center h-screen">
        <p class="text-sm text-red-600">{{ error() }}</p>
      </div>
    } @else if (previewHtml()) {
      <div [class]="printMode() ? 'w-full' : 'w-full h-screen overflow-auto'" [innerHTML]="previewHtml()"></div>
    }
  `,
})
export class ReportTemplatePreviewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(ReportTemplateEditDataService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly notifications = inject(NotificationService);

  readonly error = signal<string | null>(null);
  readonly previewHtml = signal<SafeHtml | null>(null);
  readonly printMode = signal(false);

  private previewId = '';
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private originalTitle = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private renderSubscription: { unsubscribe: () => void } | null = null;
  private hasPrinted = false;

  ngOnInit(): void {
    this.previewId = this.route.snapshot.paramMap.get('previewId') || '';
    if (!this.previewId) {
      this.error.set('No preview ID provided');
      return;
    }

    this.printMode.set(this.route.snapshot.queryParamMap.get('print') === '1');
    this.originalTitle = document.title;

    this.renderPreview();

    this.storageListener = (e: StorageEvent) => {
      if (e.key === PREVIEW_KEY_PREFIX + this.previewId) {
        this.scheduleRenderPreview();
      }
    };
    window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy(): void {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.renderSubscription) {
      this.renderSubscription.unsubscribe();
    }
    this.stopTabSpinner();
  }

  private scheduleRenderPreview(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.renderPreview();
    }, 300);
  }

  private renderPreview(attempt = 0): void {
    const templateContent = localStorage.getItem(PREVIEW_KEY_PREFIX + this.previewId);
    if (!templateContent) {
      // Freshly opened popups may briefly not yet see the opener's
      // localStorage write — retry for a few seconds before failing.
      if (attempt < 12) {
        this.debounceTimer = setTimeout(() => this.renderPreview(attempt + 1), 250);
        return;
      }
      this.error.set('Template content not found in localStorage');
      return;
    }

    if (this.renderSubscription) {
      this.renderSubscription.unsubscribe();
    }

    this.startTabSpinner();
    this.renderSubscription = this.dataService.generateHtmlPreview(templateContent).subscribe({
      next: (html) => {
        this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.stopTabSpinner();
        // In PDF mode open the browser print dialog once after the first
        // render; the user saves the output as a PDF file there.
        if (this.printMode() && !this.hasPrinted) {
          this.hasPrinted = true;
          setTimeout(() => window.print(), 500);
        }
      },
      error: () => {
        this.error.set('Fehler beim Generieren der Vorschau');
        this.stopTabSpinner();
      },
    });
  }

  private startTabSpinner(): void {
    document.title = '⏳ ' + this.originalTitle;
  }

  private stopTabSpinner(): void {
    document.title = this.originalTitle;
  }
}
