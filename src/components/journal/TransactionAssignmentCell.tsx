import { component$, useSignal, useTask$, type QRL } from "@builder.io/qwik";
import { _ } from "compiled-i18n";
import { formatCurrency } from "~/lib/format";
import type { Account } from "~/routes/journal/import/index@menu";

function parseDecimalValue(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export interface TransactionAssignmentCellProps {
  transactionIndex: number;
  transactionAmount: string;
  accounts: Account[];
  onValidChange$?: QRL<(index: number, isValid: boolean) => void>;
}

export default component$<TransactionAssignmentCellProps>(({ transactionIndex, transactionAmount, accounts, onValidChange$ }) => {
  const assignments = useSignal<Array<{ accountId: string; value: string }>>([
    { accountId: '', value: transactionAmount }
  ]);

  const amount = parseFloat(transactionAmount);

  useTask$(({ track }) => {
    track(() => assignments.value);
    const totalAssigned = assignments.value.reduce((sum, a) => sum + parseDecimalValue(a.value), 0);
    const hasUnassigned = assignments.value.some(a => a.accountId === '' || a.accountId === undefined);
    const isValid = !hasUnassigned && Math.abs(totalAssigned - amount) < 0.01;
    if (onValidChange$) {
      onValidChange$(transactionIndex, isValid);
    }
  });

  return (
    <div>
      {assignments.value.map((assignment, j) => {
        return (
          <div key={j} class="field has-addons mb-2">
            <div class="control is-expanded has-icons-right">
              <div class={["select", "is-small", "is-fullwidth", { "is-danger": assignment.accountId === '' || assignment.accountId === undefined }]}>
                <select
                  name={`transactions.${transactionIndex}.accountAssignments.${j}.accountId`}
                  value={assignment.accountId}
                  required
                  onChange$={(e, elem) => {
                    const newAssignments = [...assignments.value];
                    newAssignments[j] = { ...newAssignments[j], accountId: elem.value };
                    assignments.value = newAssignments;
                  }}
                >
                  <option value="" selected disabled>{_`- bitte auswählen -`}</option>
                  <option value="ignore">{_`Ignorieren`}</option>
                  <option disabled>---</option>
                  {accounts.map(acc => (
                    <option value={acc.id} key={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div class="control">
              <input
                class="input is-small has-text-right"
                type="text"
                pattern="[0-9]+([.,][0-9]{1,2})?"
                name={`transactions.${transactionIndex}.accountAssignments.${j}.value`}
                value={assignment.value}
                style="width: 100px;"
                placeholder="0,00"
                onChange$={(e, elem) => {
                  const newAssignments = [...assignments.value];
                  newAssignments[j] = { ...newAssignments[j], value: elem.value };
                  assignments.value = newAssignments;
                }}
              />
            </div>
            <div class="control">
              <button
                type="button"
                class="button is-small is-danger"
                disabled={assignments.value.length === 1}
                onClick$={() => {
                  assignments.value = assignments.value.filter((_, idx) => idx !== j);
                }}
              >
                <span class="icon is-small">
                  <i class="fas fa-minus"></i>
                </span>
              </button>
            </div>
          </div>
        );
      })}
      {(() => {
        const totalAssigned = assignments.value.reduce((sum, a) => sum + parseDecimalValue(a.value), 0);
        const diff = totalAssigned - amount;
        const diffIsZero = Math.abs(diff) < 0.01;

        return (
          <>
            <div class="has-text-right pb-2" style="padding-right: 2rem;">
              <div class="is-size-7">
                <div>{formatCurrency(totalAssigned.toFixed(2))}</div>
                <hr class="my-1" />
                <div>- {formatCurrency(transactionAmount)}</div>
                <div class={{ "has-text-success": diffIsZero, "has-text-danger": !diffIsZero }}>= {formatCurrency(diff.toFixed(2))}</div>
              </div>
            </div>
            <button
              type="button"
              class="button is-small is-success is-fullwidth"
              onClick$={() => {
                const totalAssigned = assignments.value.reduce((sum, a) => sum + parseDecimalValue(a.value), 0);
                const remaining = amount - totalAssigned;
                assignments.value = [...assignments.value, { accountId: '', value: remaining.toFixed(2) }];
              }}
            >
              <span class="icon is-small">
                <i class="fas fa-plus"></i>
              </span>
              <span>{_`Zuweisung hinzufügen`}</span>
            </button>
          </>
        );
      })()}
    </div>
  );
});
