import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Renders an account code indented by its depth in the account tree
 * (`depth * 20px` margin plus a └─ branch marker), so the hierarchy is shown
 * identically in every account table.
 */
@Component({
  selector: 'app-account-code-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-1.5" [style.marginLeft.px]="depth() > 0 ? depth() * 20 : null">
      @if (depth() > 0) {
        <span class="text-gray-300 select-none">{{ '└─' }}</span>
      }
      <span>{{ code() }}</span>
    </div>
  `,
})
export class AccountCodeCellComponent {
  readonly code = input.required<string>();
  readonly depth = input<number>(0);
}
