import { component$, useSignal, useComputed$, $, type QRL, useStylesScoped$ } from "@builder.io/qwik";
import { _ } from "compiled-i18n";
import styles from "./VirtualizedAccountDropdown.scss?inline";

const ITEM_HEIGHT = 32;
const VISIBLE_COUNT = 10;
const BUFFER_COUNT = 5;

export interface Account {
  id: string;
  name: string;
  isArchived?: boolean;
}

export interface VirtualizedAccountDropdownProps {
  value: string;
  accounts: Account[];
  onSelect$: QRL<(value: string) => void>;
  onClose$?: QRL<() => void>;
  dropUp?: boolean;
}

interface SpecialOption {
  id: string;
  name: string;
  disabled?: boolean;
}

const SPECIAL_OPTIONS: SpecialOption[] = [
  { id: '', name: '- bitte auswählen -', disabled: true },
  { id: 'ignore', name: 'Ignorieren', disabled: false },
];

export default component$<VirtualizedAccountDropdownProps>(({
  value,
  accounts,
  onSelect$,
  onClose$,
  dropUp = false
}) => {
  useStylesScoped$(styles);

  const scrollTop = useSignal(0);
  const searchQuery = useSignal('');

  const filteredAccounts = useComputed$(() => {
    if (!searchQuery.value) return accounts;
    const q = searchQuery.value.toLowerCase();
    return accounts.filter(acc => acc.name.toLowerCase().includes(q));
  });

  const longestAccountName = useComputed$(() => {
    let longest = '';
    for (const acc of accounts) {
      if (acc.name.length > longest.length) {
        longest = acc.name;
      }
    }
    return longest;
  });

  const totalHeight = useComputed$(() => filteredAccounts.value.length * ITEM_HEIGHT);

  const visibleRange = useComputed$(() => {
    const start = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - BUFFER_COUNT);
    const end = Math.min(
      filteredAccounts.value.length,
      Math.ceil((scrollTop.value + VISIBLE_COUNT * ITEM_HEIGHT) / ITEM_HEIGHT) + BUFFER_COUNT
    );
    return { start, end };
  });

  const visibleAccounts = useComputed$(() => {
    const { start, end } = visibleRange.value;
    return filteredAccounts.value.slice(start, end).map((acc, i) => ({
      ...acc,
      index: start + i,
    }));
  });

  const handleSelect$ = $((id: string) => {
    if (id === '') return;
    onSelect$(id);
    onClose$?.();
    searchQuery.value = '';
  });

  const handleScroll$ = $((e: Event) => {
    const target = e.target as HTMLDivElement;
    scrollTop.value = target.scrollTop;
  });

  const handleClickOutside$ = $((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.virtualized-select__dropdown')) {
      onClose$?.();
      searchQuery.value = '';
    }
  });

  const handleKeyDown$ = $((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose$?.();
      searchQuery.value = '';
    }
  });

  return (
    <div
      class={[
        "virtualized-select__dropdown",
        dropUp ? "virtualized-select__dropdown--up" : "virtualized-select__dropdown--down"
      ]}
      document:onClick$={handleClickOutside$}
      document:onKeyDown$={handleKeyDown$}
    >
      <div class="virtualized-select__search">
        <input
          type="text"
          class="input is-small"
          placeholder={_`Suchen...`}
          value={searchQuery.value}
          autoFocus
          onInput$={(_, elem) => {
            searchQuery.value = elem.value;
            scrollTop.value = 0;
          }}
        />
      </div>

      <div class="virtualized-select__special-options">
        {SPECIAL_OPTIONS.map(opt => (
          <div
            key={opt.id}
            class={[
              "virtualized-select__item",
              { "virtualized-select__item--disabled": opt.disabled },
              { "virtualized-select__item--selected": value === opt.id && !opt.disabled }
            ]}
            onClick$={() => !opt.disabled && handleSelect$(opt.id)}
          >
            {opt.name}
          </div>
        ))}
      </div>

      <div
        class="virtualized-select__list-container"
        onScroll$={handleScroll$}
      >
        <div class="virtualized-select__sizer" aria-hidden="true">
          <span class="virtualized-select__sizer-item">{longestAccountName.value}</span>
        </div>
        <div class="virtualized-select__list" style={{ height: `${totalHeight.value}px` }}>
          {visibleAccounts.value.map(acc => (
            <p
              key={acc.id}
              class={[
                "virtualized-select__item",
                "virtualized-select__item--absolute",
                { "virtualized-select__item--selected": value === acc.id },
                { "virtualized-select__item--archived": acc.isArchived }
              ]}
              style={{ top: `${acc.index * ITEM_HEIGHT}px` }}
              onClick$={() => handleSelect$(acc.id)}
            >
              {acc.name}
              {acc.isArchived && <span class="tag is-warning is-light ml-1" style="font-size: 0.6rem; padding: 0 0.3em; height: 1em;">{_`Archiviert`}</span>}
            </p>
          ))}
        </div>
      </div>

      {filteredAccounts.value.length === 0 && (
        <div class="virtualized-select__empty">
          {_`Keine Konten gefunden`}
        </div>
      )}
    </div>
  );
});
