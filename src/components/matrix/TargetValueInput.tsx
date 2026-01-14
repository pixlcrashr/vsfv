import { component$, QRL, useSignal, useTask$ } from "@builder.io/qwik";
import DecimalInput, { OnChangeEvent } from "./DecimalInput";
import { serializeDecimalValueChange } from "~/lib/value";
import { Decimal } from 'decimal.js';
import { Prisma } from "~/lib/prisma";
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { server$ } from "@builder.io/qwik-city";



async function saveTargetValue(
  budgetRevisionId: string,
  accountId: string,
  value: Decimal
): Promise<void> {
  const c = await Prisma.accounts.count({
    where: {
      parent_account_id: accountId
    }
  });
  if (c > 0) {
    throw new Error('value cannot be set for an account that has chilren');
  }

  const brav = await Prisma.budget_revision_account_values.findFirst({
    where: {
      account_id: accountId,
      budget_revision_id: budgetRevisionId
    }
  });
  if (!brav) {
    await Prisma.budget_revision_account_values.create({
      data: {
        budget_revision_id: budgetRevisionId,
        account_id: accountId,
        value: new PDecimal(value)
      }
    });
  } else {
    await Prisma.budget_revision_account_values.update({
      where: {
        id: brav.id
      },
      data: {
        value: new PDecimal(value)
      }
    });
  }
}

export const saveTargetValueServer = server$(async function (
  budgetRevisionId: string,
  accountId: string,
  value: string
) {
  return await saveTargetValue(budgetRevisionId, accountId, new Decimal(value));
});

export type OnSaveEvent = OnChangeEvent;

export interface TargetValueInputProps {
  tabIndex?: number;
  accountId: string;
  budgetRevisionId: string;
  value?: string;
  onSaved$?: QRL<(event: OnSaveEvent) => void>;
}

export default component$<TargetValueInputProps>(({ tabIndex, value, accountId, budgetRevisionId, onSaved$ }) => {
  const oldValue = useSignal<string>(value ?? '0');
  const currentValue = useSignal<string>(value ?? '0');
  const debouncedValue = useSignal<string>(value ?? '0');
  const loading = useSignal<boolean>(false);

  useTask$(({ track, cleanup }) => {
    track(() => currentValue.value);

    const debounced = setTimeout(() => {
      oldValue.value = debouncedValue.value;
      debouncedValue.value = currentValue.value;
    }, 1000);

    cleanup(() => clearTimeout(debounced));
  });

  useTask$(({ track }) => {
    track(() => debouncedValue.value);
    track(() => oldValue.value);

    const oldD = new Decimal(oldValue.value);
    const newD = new Decimal(debouncedValue.value);

    if (oldD.eq(newD)) {
      return;
    }

    loading.value = true;
    const promise = saveTargetValueServer(
      budgetRevisionId,
      accountId,
      debouncedValue.value.toString()
    );

    promise.then(() => {
      onSaved$?.({ change: {
        old: oldD,
        new: newD,
        diff: newD.sub(oldD)
      }});
      loading.value = false;
    }).catch((error) => {
      console.error(error);
      loading.value = false;
    });
  });

  return <DecimalInput tabIndex={tabIndex} value={value} onChange$={(event) => {
    const c = serializeDecimalValueChange(event.change);
    currentValue.value = c.new;
  }} loading={loading.value} />;
});
