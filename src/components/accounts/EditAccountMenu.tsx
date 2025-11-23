import { component$, QRL, Resource, Signal, useResource$, useSignal, useTask$ } from "@builder.io/qwik";
import { Form, server$ } from "@builder.io/qwik-city";
import { delay } from "~/lib/delay";
import { Prisma } from "~/lib/prisma";
import { useSaveAccountAction } from "~/routes/accounts";

interface AccountDetails {
  id: string;
  name: string;
  description: string;
  code: string;
  parentAccountId: string | null;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  depth: number;
  children: Account[];
}

interface FlatAccount {
  id: string;
  code: string;
  name: string;
  depth: number;
}

async function getAccountDetails(id: string): Promise<AccountDetails | null> {
  try {
    const m = await Prisma.accounts.findUnique({
      where: {
        id: id,
      },
    });
    if (!m) {
      return null;
    }

    return {
      id: m.id,
      name: m.display_name,
      description: m.display_description,
      code: m.display_code,
      parentAccountId: m.parent_account_id
    };
  } catch {
    return null;
  }
}

export const fetchAccount = server$(async (accountId: string) => {
  const a = await getAccountDetails(accountId);

  return a;
});

export interface EditAccountMenuProps {
  accountId: Signal<string>;
  accounts: Signal<Account[]>;
}

function accountsToSelectableAccounts(id: string, accounts: Account[]): FlatAccount[] {
  const flatAccounts: FlatAccount[] = [];

  const dfs = (account: Account) => {
    if (account.id === id) {
      return;
    }

    flatAccounts.push({
      id: account.id,
      code: account.code,
      name: account.name,
      depth: account.depth
    });

    account.children.forEach(x => dfs(x));
  };

  accounts.forEach(dfs);

  return flatAccounts;
}

export default component$<EditAccountMenuProps>(({ accountId, accounts }) => {
  const saveAction = useSaveAccountAction();

  const refSig = useSignal<HTMLFormElement>();

  useTask$(({ track }) => {
    const success = track(() => saveAction.value?.success);
    if (success) {
      if (refSig.value) {
        refSig.value.reset();
      }
    }
  });

  const selectableAccounts = useSignal<FlatAccount[]>([]);

  const accountResource = useResource$(async ({ track }) => {
    track(() => accountId.value);

    if (accountId.value === '') {
      return null;
    }

    const a = await fetchAccount(accountId.value);

    selectableAccounts.value = accountsToSelectableAccounts(accountId.value, accounts.value);

    await delay(300);

    return a;
  });

  return (
    <>
      <Resource value={accountResource} onPending={() => {
        return <progress class="progress is-small is-primary" max="100"></progress>;
      }} onResolved={(account) => {
        return (
          <Form action={saveAction} ref={refSig}>
            <input hidden name="id" type="hidden" value={account?.id ?? ''} />

            <div class="field">
              <label class="label">Gruppe</label>
              <div class="control">
                <div class="select is-small is-fullwidth">
                  <select value={account?.parentAccountId ?? ''} name="parentAccountId">
                    <option value="">- keine -</option>

                    {selectableAccounts.value.map((account) => (
                      <option key={account.id} value={account.id}>
                        {`${"\u00A0".repeat(account.depth * 6)}└─ ${account.code} | ${account.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {saveAction.value?.fieldErrors?.parentAccountId && <p class="help is-danger">{saveAction.value?.fieldErrors?.parentAccountId}</p>}
            </div>

            <div class="field is-grouped">
              <div class="field-body">
                <div class="field">
                  <label class="label">Code</label>
                  <p class="control">
                    <input name="code" class="input is-small code-input" value={account?.code} disabled={saveAction.isRunning} type="text" placeholder="Code" />
                  </p>
                </div>
                <div class="field">
                  <label class="label">Name</label>
                  <p class="control">
                    <input name="name" class="input is-small" value={account?.name} disabled={saveAction.isRunning} type="text" placeholder="Name" />
                  </p>
                </div>
              </div>
            </div>

            <div class="field">
              <label class="label">Beschreibung</label>
              <div class="control">
                <textarea name="description" class="textarea is-small" value={account?.description}></textarea>
              </div>
            </div>

            <div class="buttons mt-5 is-right are-small">
              <button type="submit" class={["button", "is-warning", {
                'is-loading': saveAction.isRunning
              }]}>Speichern</button>
            </div>
          </Form>
        );
      }} />

    </>
  );
});
