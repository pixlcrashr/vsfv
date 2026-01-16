import { $, component$, isServer, useOnDocument, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { DocumentHead, routeLoader$, server$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { Decimal } from 'decimal.js';
import { Prisma } from "~/lib/prisma";
import { type accountsModel } from "~/lib/prisma/generated/models";
import { Prisma as P } from "~/lib/prisma/generated/client";
import styles from "./index@menu.scss?inline";
import MatrixTable from "~/components/matrix/MatrixTable";
import { buildTreeFromDB, Node as AccountNode, sortedFlatAccountIterator } from "~/lib/accounts/tree";
import { requirePermission, Permissions, checkPermissions } from "~/lib/auth";



const SETTING_DEFAULT_REPORT_TEMPLATE_ID = 'default_report_template_id';

export const onRequest: RequestHandler = requirePermission(Permissions.MATRIX_READ);

export interface Item {
  accountId: string;
  accountName: string;
  accountCode: string;
  accountDescription: string;
  depth: number;
  isGroup: boolean;
  parentAccountId: string | null;
  values: {
    actualValue: string;
    revisions: {
      revisionId: string;
      targetValue: string;
      diffValue: string;
    }[];
  }[];
}

export interface Matrix {
  headers: {
    budgetId: string;
    budgetName: string;
    budgetRevisions: {
      id: string;
      description: string;
      date: Date;
      displayName: string;
    }[];
  }[];
  maxDepth: number;
  items: Item[];
};

async function getMatrix(
  budgetIds: string[],
  accountIds: string[]
): Promise<Matrix> {
  if (budgetIds.length === 0 || accountIds.length === 0) {
    return {
      headers: [],
      maxDepth: 0,
      items: []
    };
  }

  const bs = await Prisma.budgets.findMany({
    where: {
      id: {
        in: budgetIds
      }
    },
    include: {
      budget_revisions: {
        orderBy: {
          date: 'asc'
        }
      }
    },
    orderBy: [
      { period_start: 'desc' },
      { created_at: 'desc' },
      { display_name: 'asc' }
    ]
  });
  const as = await Prisma.accounts.findMany({
    where: {
      id: {
        in: accountIds
      }
    }
  });
  const bravs = await Prisma.budget_revision_account_values.findMany({
    where: {
      budget_revision_id: {
        in: bs.flatMap(b => b.budget_revisions.map(r => r.id))
      },
      account_id: {
        in: as.map(a => a.id)
      }
    }
  });
  const q = P.sql`WITH forward AS (
    SELECT
        b.id AS budget_id,
        taa.account_id,
        t.debit_transaction_account_id,
        t.credit_transaction_account_id,
        SUM(taa.value) AS total
    FROM budgets AS b
    JOIN transactions AS t
        ON t.document_date >= b.period_start
        AND t.document_date <= b.period_end
    JOIN transaction_account_assignments AS taa
        ON taa.transaction_id = t.id
    WHERE b.id IN (${P.join(bs.map(b => P.sql`${b.id}::uuid`))})
    GROUP BY b.id, taa.account_id, t.debit_transaction_account_id, t.credit_transaction_account_id
)
SELECT
    f1.budget_id,
    f1.account_id,
    SUM(f1.total - COALESCE(f2.total, 0)) AS amount
FROM forward AS f1
LEFT JOIN forward AS f2
    ON f2.budget_id = f1.budget_id
    AND f2.account_id = f1.account_id
    AND f2.debit_transaction_account_id = f1.credit_transaction_account_id
    AND f2.credit_transaction_account_id = f1.debit_transaction_account_id
GROUP BY f1.budget_id, f1.account_id`;


  const avs = await Prisma.$queryRaw<{
    budget_id: string;
    account_id: string;
    amount: PDecimal;
  }[]>(q);

  const items: Item[] = [];
  const tree = buildTreeFromDB(as);

  const sumActualChildren = (node: AccountNode, budgetId: string): Decimal => {
    let sum = new Decimal(0);

    node.children.forEach(x => {
      if (x.children.length > 0) {
        sum = sum.add(sumActualChildren(x, budgetId));
        return;
      }

      const av = avs.find(av => av.account_id === x.account.id && av.budget_id === budgetId);

      if (av) {
        sum = sum.add(new Decimal(av.amount));
      }
    });

    return sum;
  };

  const sumTargetChildren = (node: AccountNode, revisionId: string): Decimal => {
    let sum = new Decimal(0);

    node.children.forEach(x => {
      if (x.children.length > 0) {
        sum = sum.add(sumTargetChildren(x, revisionId));
        return;
      }

      const brav = bravs.find(br => br.account_id === x.account.id && br.budget_revision_id === revisionId);

      if (brav) {
        sum = sum.add(new Decimal(brav.value));
      }
    });

    return sum;
  };

  for (const flatAccount of sortedFlatAccountIterator(tree)) {
    const isGroup = flatAccount.isGroup;

    const item: Item = {
      accountId: flatAccount.id,
      accountCode: flatAccount.code,
      accountDescription: flatAccount.description,
      accountName: flatAccount.name,
      depth: flatAccount.depth,
      parentAccountId: flatAccount.parentAccountId,
      isGroup: isGroup,
      values: bs.map(b => {
        let actualValue = '0';

        if (isGroup) {
          actualValue = sumActualChildren(flatAccount.node, b.id).toString();
        } else {
          actualValue = avs.find(av => av.budget_id === b.id && av.account_id === flatAccount.node.account.id)?.amount.toString() ?? '0';
        }

        return {
          actualValue: actualValue,
          revisions: b.budget_revisions.map((r) => {
            let tV: Decimal = new Decimal(0);
            if (isGroup) {
              tV = sumTargetChildren(flatAccount.node, r.id);
            } else {
              const brav = bravs.find(br => br.account_id === flatAccount.node.account.id && br.budget_revision_id === r.id);
              if (brav) {
                tV = new Decimal(brav.value);
              }
            }

            return {
              revisionId: r.id,
              targetValue: tV.toString(),
              diffValue: tV.sub(new Decimal(actualValue)).toString()
            };
          })
        };
      })
    };
    items.push(item);
  }

  return {
    headers: bs.map(b => {
      const totalRevisions = b.budget_revisions.length;
      return {
        budgetId: b.id,
        budgetName: b.display_name,
        budgetRevisions: b.budget_revisions.map((r, index) => {
          const revisionNumber = index + 1;
          const dateStr = r.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const displayName = totalRevisions === 1 && index === 0
            ? 'Soll'
            : `Soll (Rev. ${revisionNumber}, ${dateStr})`;
          return {
            id: r.id,
            description: r.display_description,
            date: r.date,
            displayName: displayName
          };
        })
      };
    }),
    maxDepth: items.reduce((max, item) => Math.max(max, item.depth), 0),
    items: items
  };
}

export interface Budget {
  id: string;
  name: string;
  isClosed: boolean;
  revisions: {
    id: string;
    date: Date;
  }[];
}

async function getBudgets(): Promise<Budget[]> {
  const bs = await Prisma.budgets.findMany({
    include: {
      budget_revisions: {
        orderBy: {
          date: 'desc'
        }
      }
    },
    orderBy: [
      { period_start: 'desc' },
      { created_at: 'desc' },
      { display_name: 'asc' }
    ]
  });

  return bs.map(b => {
    return {
      id: b.id,
      name: b.display_name,
      isClosed: b.is_closed,
      revisions: b.budget_revisions.map(r => {
        return {
          id: r.id,
          date: r.date
        };
      })
    };
  });
}

export interface Account {
  id: string;
  code: string;
  name: string;
  depth: number;
  parentAccountId: string | null;
}

async function getAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany({
    orderBy: {
      display_code: 'asc',
    }
  });

  as.sort((a, b) => a.display_code.localeCompare(b.display_code, undefined, { numeric: true }));

  const flatAccounts: Account[] = [];

  const dfs = (account: accountsModel, depth: number) => {
    flatAccounts.push({
      id: account.id,
      code: account.display_code,
      name: account.display_name,
      depth: depth,
      parentAccountId: account.parent_account_id
    });

    as.filter(x => x.parent_account_id === account.id).forEach(x => dfs(x, depth + 1));
  };

  as.filter(x => x.parent_account_id === null).forEach(dfs, 0);

  return flatAccounts;
}

export interface Data {
  matrix: Matrix;
  budgets: Budget[];
  accounts: Account[];
  selectedBudgetIds: string[];
  selectedAccountIds: string[];
}

export const useMatrixPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canEdit: Permissions.MATRIX_UPDATE
  });
});

export const useDefaultReportTemplate = routeLoader$(async () => {
  try {
    const setting = await Prisma.settings.findUnique({
      where: { id: SETTING_DEFAULT_REPORT_TEMPLATE_ID }
    });
    return setting?.value_uuid ?? null;
  } catch {
    return null;
  }
});

export const useGetDataLoader = routeLoader$<Data>(async () => {
  // TODO: add params for selected routes
  const budgets = await getBudgets();
  const accounts = await getAccounts();

  const selectedBudgetIds = budgets.length > 0 ? [budgets[0].id] : [];
  const selectedAccountIds = accounts.map(a => a.id);
  
  return {
    matrix: await getMatrix(selectedBudgetIds, selectedAccountIds),
    budgets,
    accounts,
    selectedBudgetIds,
    selectedAccountIds
  };
});

export const getMatrixFromServer = server$(async (
  selectedBudgetIds: string[],
  selectedAccountIds: string[]
) => {
  return await getMatrix(
    selectedBudgetIds,
    selectedAccountIds
  );
});

export default component$(() => {
  useStylesScoped$(styles);

  const data = useGetDataLoader();
  const permissions = useMatrixPermissions();
  const defaultReportTemplateId = useDefaultReportTemplate();

  const showTarget = useSignal(true);
  const showActual = useSignal(false);
  const showDiff = useSignal(false);
  const showDescription = useSignal(false);
  const showOnlyLatestRevision = useSignal(false);

  const budgetsDropdownRef = useSignal<HTMLElement>();
  const showBudgetsDropdown = useSignal(false);
  const accountsDropdownRef = useSignal<HTMLElement>();
  const showAccountsDropdown = useSignal(false);

  const selectedBudgetIds = useSignal<string[]>(data.value.selectedBudgetIds);
  const selectedAccountIds = useSignal<string[]>(data.value.selectedAccountIds);
  const matrix = useSignal<Matrix>(data.value.matrix);

  useTask$(({ track }) => {
    if (isServer) {
      return;
    }

    track(() => selectedBudgetIds.value);
    track(() => selectedAccountIds.value);

    getMatrixFromServer(
      selectedBudgetIds.value,
      selectedAccountIds.value
    ).then(m => {
      matrix.value = m;
    }).catch((e) => {
      console.log(e)
    });
  });

  useOnDocument('click', $((event) => {
    if (showBudgetsDropdown.value && budgetsDropdownRef.value && !budgetsDropdownRef.value.contains(event.target as Node)) {
      showBudgetsDropdown.value = false;
    }

    if (accountsDropdownRef.value && accountsDropdownRef.value && !accountsDropdownRef.value.contains(event.target as Node)) {
      showAccountsDropdown.value = false;
    }
  }));

  return (<div class="matrix-container">
    <header class="matrix-header">
      <div class="buttons are-small has-addons">
        <button class={["button", { "is-active": showTarget.value }]} onClick$={() => showTarget.value = !showTarget.value}>
          {_`Soll`}
        </button>
        <button class={["button", { "is-active": showActual.value }]} onClick$={() => showActual.value = !showActual.value}>
          {_`Ist`}
        </button>
        <button class={["button", { "is-active": showDiff.value }]} onClick$={() => showDiff.value = !showDiff.value}>
          {_`Diff.`}
        </button>
      </div>
      <div class="buttons are-small has-addons">
        <button class={["button", { "is-active": showDescription.value }]} onClick$={() => showDescription.value = !showDescription.value}>
          {_`Kontobeschreibung`}
        </button>
      </div>
      <div class="buttons are-small has-addons">
        <button class={["button", { "is-active": showOnlyLatestRevision.value }]} onClick$={() => showOnlyLatestRevision.value = !showOnlyLatestRevision.value}>
          {_`Nur Letzte Revision`}
        </button>
      </div>
      <div class={["dropdown", "is-small", {
        'is-active': showBudgetsDropdown.value
      }]} ref={budgetsDropdownRef}>
        <div class="dropdown-trigger">
          <button class="button is-small" onClick$={() => showBudgetsDropdown.value = !showBudgetsDropdown.value} aria-haspopup="true" aria-controls="dropdown-menu">
            <span>{_`Budgets`}</span>
            <span class="icon is-small">
              <i class="fa fa-angle-down" aria-hidden="true"></i>
            </span>
          </button>
        </div>
        <div class="dropdown-menu" id="dropdown-menu" role="menu">
          <div class="dropdown-content">
            <table class="table is-narrow is-hoverable">
              <tbody>
                {data.value.budgets.map(b => <tr key={b.id}>
                  <td>{b.name}</td>
                  <td><input type="checkbox" checked={selectedBudgetIds.value.includes(b.id)} onInput$={() => {
                    if (selectedBudgetIds.value.includes(b.id)) {
                      selectedBudgetIds.value = selectedBudgetIds.value.filter(x => x !== b.id);
                    } else {
                      selectedBudgetIds.value = [...selectedBudgetIds.value, b.id];
                    }
                  }} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class={["dropdown", "is-small", {
        'is-active': showAccountsDropdown.value
      }]} ref={accountsDropdownRef}>
        <div class="dropdown-trigger">
          <button class="button is-small" onClick$={() => showAccountsDropdown.value = !showAccountsDropdown.value} aria-haspopup="true" aria-controls="dropdown-menu">
            <span>{_`Konten`}</span>
            <span class="icon is-small">
              <i class="fa fa-angle-down" aria-hidden="true"></i>
            </span>
          </button>
        </div>
        <div class="dropdown-menu" id="dropdown-menu" role="menu">
          <div class="dropdown-content">
            <table class="table is-narrow is-hoverable">
              <tbody>
                {data.value.accounts.map(a => <tr key={a.id}>
                  <td>{`${"\u00A0".repeat(a.depth * 6)}${a.depth === 0 ? '' : '└─ '}${a.code} | ${a.name}`}</td>
                  <td><input type="checkbox" checked={selectedAccountIds.value.includes(a.id)} onInput$={() => {
                    if (selectedAccountIds.value.includes(a.id)) {
                      selectedAccountIds.value = selectedAccountIds.value.filter(x => x !== a.id);
                    } else {
                      selectedAccountIds.value = [...selectedAccountIds.value, a.id];
                    }
                  }} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="buttons are-small">
        {defaultReportTemplateId.value && (
          <form method="post" action="/matrix/export/html" target="_blank">
            {selectedBudgetIds.value.map(id => (
              <input key={id} type="hidden" name="selectedBudgetIds[]" value={id} />
            ))}
            {selectedAccountIds.value.map(id => (
              <input key={id} type="hidden" name="selectedAccountIds[]" value={id} />
            ))}
            <input type="hidden" name="targetValuesEnabled" value={showTarget.value ? "on" : ""} />
            <input type="hidden" name="actualValuesEnabled" value={showActual.value ? "on" : ""} />
            <input type="hidden" name="differenceValuesEnabled" value={showDiff.value ? "on" : ""} />
            <input type="hidden" name="accountDescriptionsEnabled" value={showDescription.value ? "on" : ""} />
            <button type="submit" class="button is-small is-link is-outlined">
              <span class="icon is-small">
                <i class="fa fa-file-export" aria-hidden="true"></i>
              </span>
              <span>{_`Exportieren`}</span>
            </button>
          </form>
        )}
      </div>
    </header>
    <main class="matrix-content">
      <MatrixTable
        matrix={matrix}
        allAccounts={data.value.accounts}
        allBudgets={data.value.budgets}
        showActual={showActual}
        showDescription={showDescription}
        showDiff={showDiff}
        showTarget={showTarget}
        showOnlyLatestRevision={showOnlyLatestRevision}
        canEdit={permissions.value.canEdit} />
    </main>
  </div>);
});

export const head: DocumentHead = {
  title: _`VSFV | Matrix`,
  meta: [],
};
