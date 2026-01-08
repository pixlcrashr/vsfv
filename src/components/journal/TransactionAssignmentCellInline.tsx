import { component$, useComputed$, useStore, useStylesScoped$, useTask$, type QRL } from "@builder.io/qwik";
import { _ } from "compiled-i18n";
import { formatCurrency } from "~/lib/format";
import type { Account } from "~/routes/journal/import/index@menu";
import VirtualizedAccountSelect from "./VirtualizedAccountSelect";
import styles from "./TransactionAssignmentCell.scss?inline";

function parseDecimalValue(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export interface TransactionAssignmentCellInlineProps {
  transactionAmount: string;
  accounts: Account[];
  onValidChange$?: QRL<(isValid: boolean) => void>;
}

interface Assignment {
  accountId: string;
  value: string;
}

export default component$<TransactionAssignmentCellInlineProps>(({ transactionAmount, accounts, onValidChange$ }) => {
  useStylesScoped$(styles);

  const assignments = useStore<{
    value: Assignment[];
  }>({
    value: [
      { accountId: '', value: transactionAmount }
    ]
  });

  const amount = parseFloat(transactionAmount);

  const totalAssigned = useComputed$(() => assignments.value.reduce((sum, a) => sum + parseDecimalValue(a.value), 0));
  const diff = useComputed$(() => totalAssigned.value - amount);
  const diffIsZero = useComputed$(() => Math.abs(diff.value) < 0.01);
  const hasUnassigned = useComputed$(() => assignments.value.some(a => a.accountId === '' || a.accountId === undefined));
  const isValid = useComputed$(() => !hasUnassigned.value && diffIsZero.value);
  const remainingAmount = useComputed$(() => amount - totalAssigned.value);

  useTask$(({ track }) => {
    track(() => isValid.value);

    onValidChange$?.(isValid.value);
  });

  return (
    <div>
      {assignments.value.map((assignment, j) => {
        return (
          <div key={j} class="field has-addons mb-2">
            <div class="control is-expanded virtual-account-select-control">
              <VirtualizedAccountSelect
                name={`accountAssignments.${j}.accountId`}
                value={assignment.accountId}
                accounts={accounts}
                isInvalid={assignment.accountId === '' || assignment.accountId === undefined}
                onValueChange$={(newValue) => assignments.value[j].accountId = newValue}
              />
            </div>
            <div class="control">
              <input
                class="input is-small has-text-right"
                type="text"
                autocomplete="off"
                pattern="[0-9]+([.,][0-9]{1,2})?"
                name={`accountAssignments.${j}.value`}
                value={assignment.value}
                style="width: 100px;"
                placeholder="0,00"
                onChange$={(e, elem) => assignments.value[j].value = elem.value}
              />
            </div>
            <div class="control">
              <button
                type="button"
                class="button is-small is-danger"
                disabled={assignments.value.length === 1}
                onClick$={() => assignments.value = assignments.value.filter((_, idx) => idx !== j)}
              >
                <span class="icon is-small">
                  <i class="fas fa-minus"></i>
                </span>
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        class="button is-small is-outlined is-success is-fullwidth"
        onClick$={() => assignments.value = [...assignments.value, { accountId: '', value: remainingAmount.value.toFixed(2) }]}
      >
        <span class="icon is-small">
          <i class="fas fa-plus"></i>
        </span>
        <span>{_`Zuweisung hinzufügen`}</span>
      </button>
      <div class="has-text-right pb-2" style="padding-right: 2rem;">
        <div class="is-size-7">
          <div>{formatCurrency(totalAssigned.value.toFixed(2))}</div>
          <hr class="my-1" />
          <div>- {formatCurrency(transactionAmount)}</div>
          <div class={{ "has-text-success": diffIsZero.value, "has-text-danger": !diffIsZero.value }}>= {formatCurrency(diff.value.toFixed(2))}</div>
        </div>
      </div>
    </div>
  );
});
