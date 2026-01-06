import { component$, useSignal, useComputed$, useVisibleTask$, $, type QRL, useStylesScoped$ } from "@builder.io/qwik";
import { _ } from "compiled-i18n";
import styles from "./VirtualizedAccountSelect.scss?inline";



const ITEM_HEIGHT = 32; // px per option row
const VISIBLE_COUNT = 10; // number of visible items in dropdown
const BUFFER_COUNT = 5; // extra items to render above/below viewport
const DROPDOWN_MAX_HEIGHT = (VISIBLE_COUNT + 4) * ITEM_HEIGHT; // approx height including search + special options

export interface Account {
  id: string;
  name: string;
}

export interface VirtualizedAccountSelectProps {
  name: string;
  value: string;
  accounts: Account[];
  isInvalid?: boolean;
  onValueChange$?: QRL<(value: string) => void>;
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

export default component$<VirtualizedAccountSelectProps>(({ name, value, accounts, onValueChange$ }) => {
  const isOpen = useSignal(false);
  const scrollTop = useSignal(0);
  const searchQuery = useSignal('');
  const dropdownRef = useSignal<HTMLDivElement>();
  const containerRef = useSignal<HTMLDivElement>();
  const dropUp = useSignal(false);
  useStylesScoped$(styles);

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

  const selectedLabel = useComputed$(() => {
    if (value === '') return _`- bitte auswählen -`;
    if (value === 'ignore') return _`Ignorieren`;
    const acc = accounts.find(a => a.id === value);
    return acc?.name ?? value;
  });

  const handleSelect$ = $((id: string) => {
    if (id === '') return;
    onValueChange$?.(id);
    isOpen.value = false;
    searchQuery.value = '';
  });

  const updateDropDirection$ = $(() => {
    if (!containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    dropUp.value = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
  });

  const handleScroll$ = $((e: Event) => {
    const target = e.target as HTMLDivElement;
    scrollTop.value = target.scrollTop;
  });

  const handleClickOutside$ = $((e: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
      isOpen.value = false;
      searchQuery.value = '';
    }
  });

  const handleKeyDown$ = $((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      isOpen.value = false;
      searchQuery.value = '';
    }
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
      document:onClick$={handleClickOutside$}
      document:onKeyDown$={handleKeyDown$}
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
          if (isOpen.value) {
            scrollTop.value = 0;
          }
        }}
      >
        <span class="virtualized-select__trigger-label">{selectedLabel.value}</span>
        <span class="icon is-small">
          <i class={isOpen.value ? "fas fa-chevron-up" : "fas fa-chevron-down"}></i>
        </span>
      </button>

      {isOpen.value && (
        <div
          ref={dropdownRef}
          class={[
            "virtualized-select__dropdown",
            dropUp.value ? "virtualized-select__dropdown--up" : "virtualized-select__dropdown--down"
          ]}
        >
          <div class="virtualized-select__search">
            <input
              type="text"
              class="input is-small"
              placeholder={_`Suchen...`}
              value={searchQuery.value}
              autoFocus
              onInput$={(e, elem) => {
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
                    { "virtualized-select__item--selected": value === acc.id }
                  ]}
                  style={{ top: `${acc.index * ITEM_HEIGHT}px` }}
                  onClick$={() => handleSelect$(acc.id)}
                >
                  {acc.name}
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
      )}
    </div>
  );
});
