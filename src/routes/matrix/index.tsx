import { $, component$, createContextId, QRL, Resource, Signal, useComputed$, useContext, useContextProvider, useOnDocument, useResource$, useSignal, useStore, useStylesScoped$, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, server$ } from "@builder.io/qwik-city";
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { Decimal } from 'decimal.js/decimal';
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { type accountsModel } from "../../lib/prisma/generated/models";
import { Prisma as P } from "../../lib/prisma/generated/client";
import styles from "./index.scss?inline";



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
    }[];
  }[];
  maxDepth: number;
  items: Item[];
};

async function getMatrix(
  budgetIds: string[],
  accountIds: string[]
): Promise<Matrix> {
  const bs = await Prisma.budgets.findMany({
    where: {
      id: {
        in: budgetIds
      }
    },
    include: {
      budget_revisions: true
    },
    orderBy: {
      period_start: 'desc'
    }
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
  const q = P.sql`SELECT b.id as budget_id, t.assigned_account_id AS account_id, SUM(t.amount) AS amount
FROM
	budgets AS b,
	transactions AS t
WHERE
  b.id IN (${P.join(bs.map(b => P.sql`${b.id}::uuid`))}) AND
	t.document_date >= b.period_start AND
	t.document_date <= b.period_end AND
	t.assigned_account_id IS NOT NULL
GROUP BY b.id, t.assigned_account_id`;

  const avs = await Prisma.$queryRaw<{
    budget_id: string;
    account_id: string;
    amount: PDecimal;
  }[]>(q);

  interface Node {
    account: accountsModel;
    parentNode: Node | null;
    depth: number;
    children: Node[];
  }

  const dfsTree = (parentNode: Node | null, account: accountsModel, depth: number): Node => {
    const n: Node = {
      account: account,
      parentNode: parentNode,
      depth: depth,
      children: []
    };

    const cs = as.filter(x => x.parent_account_id === account.id).map(x => dfsTree(n, x, depth + 1));
    cs.sort((a, b) => a.account.display_code.localeCompare(b.account.display_code, undefined, { numeric: true }));

    n.children.push(...cs);

    return n;
  };

  const tmp: accountsModel[] = as.filter(x => x.parent_account_id === null);
  tmp.sort((a, b) => a.display_code.localeCompare(b.display_code, undefined, { numeric: true }));

  const asTree: Node[] = tmp.map(x => dfsTree(null, x, 0));

  const items: Item[] = [];

  const sumActualChildren = (node: Node, budgetId: string): Decimal => {
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

  const sumTargetChildren = (node: Node, revisionId: string): Decimal => {
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

  const traverseTree = (node: Node) => {
    const isGroup = node.children.length > 0;

    const item: Item = {
      accountId: node.account.id,
      accountCode: node.account.display_code,
      accountDescription: node.account.display_description,
      accountName: node.account.display_name,
      depth: node.depth,
      parentAccountId: node.account.parent_account_id ?? null,
      isGroup: isGroup,
      values: bs.map(b => {
        let actualValue = '0';

        if (isGroup) {
          actualValue = sumActualChildren(node, b.id).toString();
        } else {
          actualValue = avs.find(av => av.budget_id === b.id && av.account_id === node.account.id)?.amount.toString() ?? '0';
        }

        return {
          actualValue: actualValue,
          revisions: b.budget_revisions.map((r) => {
            let tV: Decimal = new Decimal(0);
            if (isGroup) {
              tV = sumTargetChildren(node, r.id);
            } else {
              const brav = bravs.find(br => br.account_id === node.account.id && br.budget_revision_id === r.id);
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

    node.children.forEach(x => traverseTree(x));
  };

  asTree.forEach(traverseTree);

  return {
    headers: bs.map(b => {
      return {
        budgetId: b.id,
        budgetName: b.display_name,
        budgetRevisions: b.budget_revisions.map(r => {
          return {
            id: r.id,
            description: r.display_description,
            date: r.date
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
  revisions: {
    id: string;
    date: Date;
  }[];
}

async function getBudgets(): Promise<Budget[]> {
  const bs = await Prisma.budgets.findMany({
    include: {
      budget_revisions: true
    },
    orderBy: {
      period_start: 'desc'
    }
  });

  return bs.map(b => {
    return {
      id: b.id,
      name: b.display_name,
      revisions: b.budget_revisions.map(r => {
        return {
          id: r.id,
          date: r.date
        };
      })
    };
  });
}

export const useGetBudgets = routeLoader$<Budget[]>(async () => await getBudgets());

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

export const useGetAccounts = routeLoader$<Account[]>(async () => await getAccounts());

export const getMatrixFromServer = server$(async (
  selectedBudgetIds: string[],
  selectedAccountIds: string[]
) => {
  return await getMatrix(
    selectedBudgetIds,
    selectedAccountIds
  );
});

async function saveBudgetRevisionAccountValue(
  budgetRevisionId: string,
  accountId: string,
  value: string
) {
  const c = await Prisma.accounts.count({
    where: {
      parent_account_id: accountId
    }
  });
  if (c > 0) {
    return; // TODO: error handling
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

export const saveBudgetRevisionAccountValueServer = server$(async function (
  budgetRevisionId: string,
  accountId: string,
  value: string
) {
  return await saveBudgetRevisionAccountValue(budgetRevisionId, accountId, value);
});

export interface MatrixInputProps {
  isDisabled: boolean;
  budgetRevisionId: string;
  accountId: string;
  onSaved$?: QRL<(diff: Decimal) => void>
}

export const MatrixInput = component$<MatrixInputProps>(({ isDisabled, onSaved$, budgetRevisionId, accountId }) => {
  useStylesScoped$(`.input {
  border-radius: 0;
  border: none;
  font-size: 9pt;
  line-height: 9pt;
  text-align: right;
}

p {
  text-align: right;
  color: #696969;
}`);

  const targetValues = useContext(TargetValuesContext);

  const value = useSignal<string>('0');
  const oldValue = useSignal<string>(value.value);

  useTask$(({ track }) => {
    track(() => targetValues[`${accountId}:${budgetRevisionId}`]);

    oldValue.value = value.value;
    value.value = targetValues[`${accountId}:${budgetRevisionId}`];
  });

  const formattedValue = useComputed$(() => formatCurrency(value.value));
  const loading = useSignal<boolean>(false);

  const inputRef = useSignal<HTMLInputElement | undefined>(undefined);

  useVisibleTask$(() => {
    if (inputRef.value) {
      inputRef.value.value = formattedValue.value;
    }
  });

  return (
    <>
      {isDisabled ? <p class="pl-2 pr-2">{formattedValue}</p> :
        <input ref={inputRef} class={["input", "is-small", {
          "is-loading": loading.value
        }]} onFocus$={() => {
          value.value = new Decimal(oldValue.value).toString();
          if (inputRef.value) {
            inputRef.value.value = value.value.toString();
            inputRef.value.setSelectionRange(0, inputRef.value.value.length);
          }
        }} onFocusOut$={() => {
          value.value = oldValue.value;
          if (inputRef.value) {
            inputRef.value.value = formattedValue.value;
          }
        }} onInput$={$(async (event, elem) => {
          const v = new Decimal(elem.value);

          loading.value = true;

          // TODO: add debounce mechanism
          await saveBudgetRevisionAccountValueServer(
            budgetRevisionId,
            accountId,
            v.toString()
          );
          loading.value = false;

          const diff = v.sub(new Decimal(oldValue.value));
          oldValue.value = v.toString();

          onSaved$?.(diff);
        })} />}
    </>
  );
});

function propagateMatrixValues(
  brbMap: Map<string, string>,
  targetValues: { [key: string]: string; },
  actualValues: { [key: string]: string; },
  diffValues: { [key: string]: string; },
  accounts: Account[],
  revisionId: string,
  parentAccountId: string | null,
  v: Decimal,
) {
  if (parentAccountId === null) {
    return;
  }

  const a = accounts.find(a => a.id === parentAccountId);
  if (!a) {
    return;
  }

  if (targetValues[`${a.id}:${revisionId}`] === undefined) {
    targetValues[`${a.id}:${revisionId}`] = new Decimal(0).toString();
  }

  const tV = new Decimal(targetValues[`${a.id}:${revisionId}`]).add(new Decimal(v));
  targetValues[`${a.id}:${revisionId}`] = tV.toString();

  const aV = new Decimal(actualValues[`${a.id}:${brbMap.get(revisionId) ?? ''}`] ?? '0');
  diffValues[`${a.id}:${revisionId}`] = tV.sub(aV).toString();

  propagateMatrixValues(
    brbMap,
    targetValues,
    actualValues,
    diffValues,
    accounts,
    revisionId,
    a.parentAccountId,
    v
  );
};

export type StringMap = { [key: string]: string };

export const ActualValuesContext = createContextId<StringMap>('actualValues');
export const TargetValuesContext = createContextId<StringMap>('targetValues');
export const DiffValuesContext = createContextId<StringMap>('diffValues');
export const budgetRevisionIdToBudgetIdContext = createContextId<StringMap>('budgetRevisionIdToBudgetId');

export default component$(() => {
  useStylesScoped$(styles);

  const allBudgets = useGetBudgets();
  const allAccounts = useGetAccounts();

  const showTarget = useSignal(true);
  const showActual = useSignal(false);
  const showDiff = useSignal(false);
  const showDescription = useSignal(false);

  const budgetsDropdownRef = useSignal<HTMLElement>();
  const showBudgetsDropdown = useSignal(false);
  const accountsDropdownRef = useSignal<HTMLElement>();
  const showAccountsDropdown = useSignal(false);

  const selectedBudgetIds = useSignal<string[]>([]);
  const selectedAccountIds = useSignal<string[]>([]);

  const matrixResource = useResource$(async ({ track }) => {
    track(() => selectedBudgetIds.value);
    track(() => selectedAccountIds.value);

    const m = await getMatrixFromServer(
      selectedBudgetIds.value,
      selectedAccountIds.value
    );

    return m;
  });

  const brbMap = new Map<string, string>();
  allBudgets.value.forEach(b => {
    b.revisions.forEach(r => {
      brbMap.set(r.id, b.id);
    });
  });

  const actualValues = useStore<StringMap>({}, { deep: true });
  const targetValues = useStore<StringMap>({}, { deep: true });
  const diffValues = useStore<StringMap>({}, { deep: true });
  const budgetRevisionIdToBudgetId = useStore<StringMap>({}, { deep: true });

  useContextProvider(ActualValuesContext, actualValues);
  useContextProvider(TargetValuesContext, targetValues);
  useContextProvider(DiffValuesContext, diffValues);
  useContextProvider(budgetRevisionIdToBudgetIdContext, budgetRevisionIdToBudgetId);

  useTask$(({ track }) => {
    track(() => allBudgets.value);

    if (allBudgets.value.length > 0) {
      selectedBudgetIds.value = [allBudgets.value[0].id];
    }
  });

  useTask$(({ track }) => {
    track(() => allAccounts.value);

    if (allAccounts.value.length > 0) {
      selectedAccountIds.value = allAccounts.value.map(a => a.id);
    }
  });

  useOnDocument('click', $((event) => {
    if (showBudgetsDropdown.value && budgetsDropdownRef.value && !budgetsDropdownRef.value.contains(event.target as Node)) {
      showBudgetsDropdown.value = false;
    }

    if (accountsDropdownRef.value && accountsDropdownRef.value && !accountsDropdownRef.value.contains(event.target as Node)) {
      showAccountsDropdown.value = false;
    }
  }));

  const budgetColSpan = useComputed$(() => {
    return (showTarget.value ? 1 : 0) + (showActual.value ? 1 : 0) + (showDiff.value ? 1 : 0);
  });

  return (<div class="matrix-container">
    <header class="matrix-header">
      <div class="buttons are-small has-addons">
        <button class={["button", { "is-active": showTarget.value }]} onClick$={() => showTarget.value = !showTarget.value}>
          Soll
        </button>
        <button class={["button", { "is-active": showActual.value }]} onClick$={() => showActual.value = !showActual.value}>
          Ist
        </button>
        <button class={["button", { "is-active": showDiff.value }]} onClick$={() => showDiff.value = !showDiff.value}>
          Diff.
        </button>
      </div>
      <div class="buttons are-small has-addons">
        <button class={["button", { "is-active": showDescription.value }]} onClick$={() => showDescription.value = !showDescription.value}>
          Kontobeschreibung
        </button>
      </div>
      <div class={["dropdown", "is-small", {
        'is-active': showBudgetsDropdown.value
      }]} ref={budgetsDropdownRef}>
        <div class="dropdown-trigger">
          <button class="button is-small" onClick$={() => showBudgetsDropdown.value = !showBudgetsDropdown.value} aria-haspopup="true" aria-controls="dropdown-menu">
            <span>Budgets</span>
            <span class="icon is-small">
              <i class="fa fa-angle-down" aria-hidden="true"></i>
            </span>
          </button>
        </div>
        <div class="dropdown-menu" id="dropdown-menu" role="menu">
          <div class="dropdown-content">
            <table class="table is-narrow is-hoverable">
              <tbody>
                {allBudgets.value.map(b => <tr key={b.id}>
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
            <span>Konten</span>
            <span class="icon is-small">
              <i class="fa fa-angle-down" aria-hidden="true"></i>
            </span>
          </button>
        </div>
        <div class="dropdown-menu" id="dropdown-menu" role="menu">
          <div class="dropdown-content">
            <table class="table is-narrow is-hoverable">
              <tbody>
                {allAccounts.value.map(a => <tr key={a.id}>
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
    </header>
    <main class="matrix-content">
      <Resource value={matrixResource} onResolved={(matrix) => {
        matrix.items.forEach(row => {
          row.values.forEach((value, i) => {
            actualValues[`${row.accountId}:${matrix.headers[i].budgetId}`] = value.actualValue;

            value.revisions.forEach(revision => {
              targetValues[`${row.accountId}:${revision.revisionId}`] = revision.targetValue;
              diffValues[`${row.accountId}:${revision.revisionId}`] = revision.diffValue;
            });
          });
        });

        return <table class="table is-bordered">
          <thead>
            <tr>
              <th rowSpan={2} colSpan={matrix.maxDepth + 1}>Konto</th>
              <th rowSpan={2}>Titel</th>
              {showDescription.value && <th rowSpan={2}>Beschreibung</th>}
              {(showTarget.value || showActual.value || showDiff.value) && <>
                {matrix.headers.map((h) => <th key={h.budgetId} colSpan={budgetColSpan.value + (h.budgetRevisions.length - 1) * ((showTarget.value ? 1 : 0) + (showDiff.value ? 1 : 0))}>{h.budgetName}</th>)}
              </>}
            </tr>
            <tr>
              {matrix.headers.map((h) => <>
                {showTarget.value && h.budgetRevisions.map((revision, i) => <th key={revision.id}>Soll{i > 0 ? ` (Rev. ${i + 1}, ${formatDateShort(revision.date)})` : ''}</th>)}
                {showActual.value && <th>Ist</th>}
                {showDiff.value && h.budgetRevisions.map((revision, i) => <th key={revision.id}>Diff.{i > 0 ? ` (Rev. ${i + 1}, ${formatDateShort(revision.date)})` : ''}</th>)}
              </>)}
            </tr>
          </thead>
          <tbody>
            {matrix.items.map((row) => <tr key={row.accountId}>
              {Array.from({ length: matrix.maxDepth + 1 }).map((_, index) => <td class="is-vcentered" key={index}>
                {index === row.depth ? row.accountCode : ''}
              </td>)}
              <td>{row.accountName}</td>
              {showDescription.value && <td>{row.accountDescription}</td>}
              {row.values.map((value, i) => <>
                {showTarget.value && value.revisions.map((revision) => <td class="p-0 is-vcentered" key={revision.revisionId}>
                  <MatrixInput budgetRevisionId={revision.revisionId} accountId={row.accountId} isDisabled={row.isGroup} onSaved$={(v) => {
                    propagateMatrixValues(
                      brbMap,
                      targetValues,
                      actualValues,
                      diffValues,
                      allAccounts.value,
                      revision.revisionId,
                      row.parentAccountId,
                      v
                    );
                    console.log(targetValues, actualValues, diffValues);
                  }} />
                </td>)}
                {showActual.value && <td class="disabled-cell">{formatCurrency(actualValues[`${row.accountId}:${matrix.headers[i].budgetId}`])}</td>}
                {showDiff.value && value.revisions.map((revision) => <td class="disabled-cell" key={revision.revisionId}>{formatCurrency(diffValues[`${row.accountId}:${revision.revisionId}`])}</td>)}
              </>)}
            </tr>)}
          </tbody>
        </table>;
      }} />
    </main>
  </div>);
});
