import { component$, Resource, Signal, useResource$ } from "@builder.io/qwik";
import { Form, server$ } from "@builder.io/qwik-city";
import { buildTreeFromDB, sortedFlatAccountIterator } from "~/lib/accounts/tree";
import { delay } from "~/lib/delay";
import { Prisma } from "~/lib/prisma";
import { useSaveAccountGroupRouteAction } from "~/routes/accountGroups";

interface EditAccountGroupMenuProps {
  accountGroupId: Signal<string>;
}

type AssignmentMode = 'ignore' | 'positive' | 'negative';

interface AccountWithMode {
  id: string;
  code: string;
  name: string;
  depth: number;
  mode: AssignmentMode;
}

interface AccountGroup {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

async function getAccountGroup(id: string): Promise<{ accountGroup: AccountGroup; assignmentMap: Map<string, boolean> } | null> {
  try {
    const m = await Prisma.account_groups.findUnique({
      include: {
        account_group_assignments: true
      },
      where: {
        id: id,
      },
    });
    if (!m) {
      return null;
    }

    const assignmentMap = new Map<string, boolean>();
    m.account_group_assignments.forEach(a => {
      assignmentMap.set(a.account_id, a.negate);
    });

    return {
      accountGroup: {
        id: m.id,
        name: m.display_name,
        description: m.display_description,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      },
      assignmentMap
    };
  } catch {
    return null;
  }
}

async function getAvailableAccounts(): Promise<{ accounts: AccountWithMode[]; maxDepth: number }> {
  const accounts = await Prisma.accounts.findMany({
    where: {
      is_archived: false
    }
  });

  const tree = buildTreeFromDB(accounts);
  const flatAccounts: AccountWithMode[] = [];

  for (const flatAccount of sortedFlatAccountIterator(tree)) {
    flatAccounts.push({
      id: flatAccount.id,
      code: flatAccount.code,
      name: flatAccount.name,
      depth: flatAccount.depth,
      mode: 'ignore'
    });
  }

  return { accounts: flatAccounts, maxDepth: tree.maxDepth() };
}

export const fetchAccountGroup = server$(async (accountGroupId: string) => {
  const result = await getAccountGroup(accountGroupId);
  const { accounts: accountsWithMode, maxDepth } = await getAvailableAccounts();

  if (!result) {
    return null;
  }

  for (const account of accountsWithMode) {
    if (result.assignmentMap.has(account.id)) {
      account.mode = result.assignmentMap.get(account.id) ? 'negative' : 'positive';
    }
  }

  return { accountGroup: result.accountGroup, accountsWithMode, maxDepth };
});

export default component$<EditAccountGroupMenuProps>(({ accountGroupId }) => {
  const accountGroupResource = useResource$(async ({ track }) => {
    track(() => accountGroupId.value);

    if (accountGroupId.value === '') {
      return null;
    }

    const result = await fetchAccountGroup(accountGroupId.value);

    await delay(300);

    return result;
  });
  const saveAccountGroupAction = useSaveAccountGroupRouteAction();

  return (
    <>
      <Resource value={accountGroupResource} onPending={() => {
        return <progress class="progress is-small is-primary" max="100"></progress>;
      }} onResolved={(data) => {
        if (data === null) {
          return null;
        }

        const accountGroup = data.accountGroup;
        const accountsWithMode = data.accountsWithMode;
        const maxDepth = data.maxDepth;

        return (<>
          <Form action={saveAccountGroupAction}>
            <input hidden name="id" type="hidden" value={accountGroup.id} />

            <div class="field">
              <label class="label">Name</label>
              <div class="control">
                <input name="name" class="input is-small" disabled={saveAccountGroupAction.isRunning} type="text" value={accountGroup.name} />
              </div>
            </div>

            <div class="field">
              <label class="label">Beschreibung</label>
              <div class="control">
                <textarea name="description" class="textarea is-small" disabled={saveAccountGroupAction.isRunning} rows={5} value={accountGroup.description} />
              </div>
            </div>

            <div class="field">
              <label class="label">Kontenzuweisungen</label>
              <p class="help mb-2">Wählen Sie für jedes Konto: Positiv (+), Negativ (-) oder Ignorieren.</p>
              <table class="table is-striped is-narrow is-hoverable is-fullwidth">
                <thead>
                  <tr>
                    <th colSpan={maxDepth}>Konto</th>
                    <th>Name</th>
                    <th class="has-text-centered">P</th>
                    <th class="has-text-centered">N</th>
                    <th class="has-text-centered">I</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsWithMode.map((account, index) => (
                    <tr key={account.id}>
                      <input type="hidden" name={`assignments.${index}.accountId`} value={account.id} />
                      {Array.from({ length: maxDepth }).map((_, j) => (
                        <td class="is-vcentered" key={j}>
                          <span class="is-size-7">{j === account.depth ? account.code : ''}</span>
                        </td>
                      ))}
                      <td class="is-vcentered">
                        <span class="is-size-7">{account.name}</span>
                      </td>
                      <td class="is-vcentered has-text-centered">
                        <label class="radio">
                          <input
                            type="radio"
                            name={`assignments.${index}.mode`}
                            value="positive"
                            checked={account.mode === 'positive'}
                            onChange$={() => { account.mode = 'positive'; }}
                          />
                        </label>
                      </td>
                      <td class="is-vcentered has-text-centered">
                        <label class="radio">
                          <input
                            type="radio"
                            name={`assignments.${index}.mode`}
                            value="negative"
                            checked={account.mode === 'negative'}
                            onChange$={() => { account.mode = 'negative'; }}
                          />
                        </label>
                      </td>
                      <td class="is-vcentered has-text-centered">
                        <label class="radio">
                          <input
                            type="radio"
                            name={`assignments.${index}.mode`}
                            value="ignore"
                            checked={account.mode === 'ignore'}
                            onChange$={() => { account.mode = 'ignore'; }}
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div class="buttons mt-5 is-right are-small">
              <button type="submit" class={["button", "is-warning", {
                'is-loading': saveAccountGroupAction.isRunning
              }]}>Speichern</button>
            </div>
          </Form>
        </>);
      }} />
    </>
  );
});
