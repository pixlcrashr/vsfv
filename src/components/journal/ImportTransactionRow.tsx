import { component$, useSignal, type QRL } from "@builder.io/qwik";
import { Form, type ActionStore } from "@builder.io/qwik-city";
import { formatCurrency, formatDateInputField, formatDateShort } from "~/lib/format";
import type { Account } from "~/routes/journal/import/index@menu";
import TransactionAssignmentCellInline from "./TransactionAssignmentCellInline";

export interface ImportTransaction {
  receiptFrom: Date;
  bookedAt: Date;
  reference: string;
  description: string;
  amount: string;
  debitAccount: string;
  creditAccount: string;
}

export interface ImportTransactionRowProps {
  transaction: ImportTransaction;
  sourceId: string;
  accounts: Account[];
  importAction: ActionStore<any, any, boolean>;
  onSuccess$: QRL<() => void>;
}

export default component$<ImportTransactionRowProps>(({
  transaction,
  sourceId,
  accounts,
  importAction,
  onSuccess$
}) => {
  const isLoading = useSignal(false);
  const isSubmitted = useSignal(false);
  const isValid = useSignal(false);

  return (
    <tr hidden={isSubmitted.value}>
      <td style="vertical-align: top;">
        {formatDateShort(transaction.bookedAt)}
      </td>
      <td class="has-text-right" style="vertical-align: top;">
        {formatCurrency(transaction.amount.toString())}
      </td>
      <td class="has-text-right" style="vertical-align: top;">
        {transaction.debitAccount}
      </td>
      <td class="has-text-right" style="vertical-align: top;">
        {transaction.creditAccount}
      </td>
      <td style="vertical-align: top;">
        {transaction.description}
      </td>
      <td style="vertical-align: top;">
        {transaction.reference}
      </td>
      <td style="vertical-align: top;">
        <Form
          action={importAction}
          onSubmit$={() => isLoading.value = true}
          onSubmitCompleted$={async (event) => {
            const detail = event.detail as { value?: { success?: boolean } };
            if (detail?.value?.success) {
              isSubmitted.value = true;
              setTimeout(() => onSuccess$(), 0);
              return;
            }
            isLoading.value = false;
          }}
        >
          <input hidden name="sourceId" value={sourceId} />
          <input hidden name="receiptFrom" type="date" value={formatDateInputField(transaction.receiptFrom)} />
          <input hidden name="bookedAt" type="date" value={formatDateInputField(transaction.bookedAt)} />
          <input hidden name="amount" value={transaction.amount.toString()} />
          <input hidden name="description" value={transaction.description} />
          <input hidden name="reference" value={transaction.reference} />
          <input hidden name="debitAccount" value={transaction.debitAccount} />
          <input hidden name="creditAccount" value={transaction.creditAccount} />
      
          <TransactionAssignmentCellInline
            transactionAmount={transaction.amount.toString()}
            accounts={accounts}
            onValidChange$={(valid: boolean) => { isValid.value = valid; }}
          />
          <div class="buttons are-small is-right">
            <button
              type="submit"
              disabled={!isValid.value || importAction.isRunning || isLoading.value}
              class={["button", "is-small", "is-primary", { "is-loading": importAction.isRunning || isLoading.value }]}
            >
              Importieren
            </button>
          </div>
        </Form>
      </td>
    </tr>
  );
});
