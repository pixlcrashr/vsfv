import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Blue "Beispiele" hint box used by the assistant's question steps.
 * The hint list items are projected via ng-content.
 */
@Component({
  selector: 'app-assistant-info-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-5 rounded-md border-l-4 border-blue-600 bg-blue-50 p-4 dark:border-blue-500 dark:bg-blue-950/40">
      <p class="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300" i18n>
        Beispiele
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900 dark:text-blue-200">
        <ng-content />
      </ul>
    </div>
  `,
})
export class AssistantInfoBoxComponent {}
