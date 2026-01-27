import { component$, useSignal, useComputed$, useVisibleTask$, $, type QRL, useStylesScoped$, useStyles$ } from "@builder.io/qwik";
import { _ } from "compiled-i18n";
import VirtualizedAccountDropdown from "./VirtualizedAccountDropdown";
import styles from "./VirtualizedAccountSelect.scss?inline";

const VISIBLE_COUNT = 10;
const ITEM_HEIGHT = 32;
const DROPDOWN_MAX_HEIGHT = (VISIBLE_COUNT + 4) * ITEM_HEIGHT;

export interface Account {
  id: string;
  name: string;
  isArchived?: boolean;
}

export interface VirtualizedAccountSelectProps {
  name: string;
  value: string;
  accounts: Account[];
  isInvalid?: boolean;
  onValueChange$?: QRL<(value: string) => void>;
}

export default component$<VirtualizedAccountSelectProps>(({ name, value, accounts, onValueChange$ }) => {
  const isOpen = useSignal(false);
  const containerRef = useSignal<HTMLDivElement>();
  const dropUp = useSignal(false);
  useStyles$(styles);

  const selectedAccount = useComputed$(() => {
    if (value === '') return { name: _`- bitte auswählen -`, isArchived: false };
    if (value === 'ignore') return { name: _`Ignorieren`, isArchived: false };
    const acc = accounts.find(a => a.id === value);
    return { name: acc?.name ?? value, isArchived: acc?.isArchived ?? false };
  });

  const updateDropDirection$ = $(() => {
    if (!containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    dropUp.value = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
  });

  const handleSelect$ = $((id: string) => {
    onValueChange$?.(id);
    isOpen.value = false;
  });

  const handleClose$ = $(() => {
    isOpen.value = false;
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => isOpen.value);
    if (isOpen.value) {
      updateDropDirection$();
    }
  });

  return (
    <div
      ref={containerRef}
      class="virtualized-select"
    >
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        class={[
          "button", "is-small", "is-fullwidth", "is-justify-content-space-between",
          "virtualized-select__trigger",
          {
            'is-focused': isOpen.value
          }
        ]}
        onClick$={async () => {
          if (!isOpen.value) {
            await updateDropDirection$();
          }
          isOpen.value = !isOpen.value;
        }}
      >
        <span class="virtualized-select__trigger-label">
          {selectedAccount.value.name}
          {selectedAccount.value.isArchived && <span class="tag is-warning is-light ml-1" style="font-size: 0.65rem; padding: 0 0.4em; height: 1.2em;">{_`Archiviert`}</span>}
        </span>
        <span class="icon is-small">
          <i class={isOpen.value ? "fas fa-chevron-up" : "fas fa-chevron-down"}></i>
        </span>
      </button>

      {isOpen.value && (
        <VirtualizedAccountDropdown
          value={value}
          accounts={accounts}
          onSelect$={handleSelect$}
          onClose$={handleClose$}
          dropUp={dropUp.value}
        />
      )}
    </div>
  );
});
