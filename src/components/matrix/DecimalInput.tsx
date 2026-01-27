import { component$, useSignal, useTask$, QRL, useStylesScoped$, $ } from "@builder.io/qwik";
import { Decimal } from "decimal.js";
import { formatCurrency } from "~/lib/format";
import { DecimalValueChange } from "~/lib/value";
import styles from "./DecimalInput.scss?inline";

export interface OnChangeEvent {
  change: DecimalValueChange;
}

export interface DecimalInputProps {
  tabIndex?: number;
  value?: string;
  loading?: boolean;
  onChange$?: QRL<(event: OnChangeEvent) => void>;
}

export default component$<DecimalInputProps>(({ tabIndex, value, loading, onChange$ }) => {
  useStylesScoped$(styles);

  const ref = useSignal<HTMLInputElement | undefined>(undefined);
  const oldValue = useSignal<string>(value ?? '0');
  const currentValue = useSignal<string>(value ?? '0');
  const isFocused = useSignal<boolean>(false);

  useTask$(({ track }) => {
    track(() => ref.value);
    track(() => isFocused.value);

    if (ref.value) {
      if (isFocused.value) {
        ref.value.value = currentValue.value;
        ref.value.setSelectionRange(0, ref.value.value.length);
      } else {
        ref.value.value = formatCurrency(currentValue.value);
      }
    }
  });

  return <input
    tabIndex={tabIndex}
    ref={ref}
    class={["decimal-input", {
      "is-loading": loading
    }]}
    value={formatCurrency(value ?? '0')}
    onFocus$={() => isFocused.value = true}
    onFocusOut$={() => isFocused.value = false}
    onInput$={$(async (_, elem) => {
      const neutralValue = elem.value.replaceAll(',', '.');

      const nV = new Decimal(neutralValue);
      const oV = new Decimal(currentValue.value);
      const dV = nV.sub(oV);

      onChange$?.({
        change: {
          old: oV,
          new: nV,
          diff: dV
        }
      });

      oldValue.value = currentValue.value;
      currentValue.value = nV.toString();
    })} />;
});
