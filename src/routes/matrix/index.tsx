import { $, component$, QRL, Resource, Signal, useComputed$, useOnDocument, useResource$, useSignal, useStore, useStylesScoped$, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, server$ } from "@builder.io/qwik-city";
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { Decimal } from 'decimal.js/decimal';
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { type accountsModel } from "../../lib/prisma/generated/models";
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

export type Matrix = {
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

  const sumChildren = (node: Node, revisionId: string): Decimal => {
    let sum = new Decimal(0);

    node.children.forEach(x => {
      if (x.children.length > 0) {
        sum = sum.add(sumChildren(x, revisionId));
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
        return {
          actualValue: '0',
          revisions: b.budget_revisions.map((r) => {
            let tV: Decimal = new Decimal(0);
            if (isGroup) {
              tV = sumChildren(node, r.id);
            } else {
              const brav = bravs.find(br => br.account_id === node.account.id && br.budget_revision_id === r.id);
              if (brav) {
                tV = new Decimal(brav.value);
              }
            }

            return {
              revisionId: r.id,
              targetValue: tV.toString(),
              diffValue: tV.sub(new Decimal(0)).toString()
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
  value: Signal<string>;
  onSaved$: QRL<(value: string) => void>;
  budgetRevisionId: string;
  accountId: string;
}

export const MatrixInput = component$<MatrixInputProps>(({ isDisabled, value, onSaved$, budgetRevisionId, accountId }) => {
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

  const oldValue = useSignal<string>(value.value);

  const backgroundValue = useSignal<string>(formatCurrency(value.value));
  const loading = useSignal<boolean>(false);

  const inputRef = useSignal<HTMLInputElement | undefined>(undefined);

  useVisibleTask$(() => {
    if (inputRef.value) {
      inputRef.value.value = backgroundValue.value;
    }
  });

  return (
    <>
      {isDisabled ? <p class="pl-2 pr-2">{formatCurrency(value.value)}</p> :
        <input ref={inputRef} class={["input", "is-small", {
          "is-loading": loading.value
        }]} onFocus$={() => {
          backgroundValue.value = new Decimal(oldValue.value).toFixed(2);
          if (inputRef.value) {
            inputRef.value.value = backgroundValue.value;
            inputRef.value.setSelectionRange(0, inputRef.value.value.length);
          }
        }} onFocusOut$={() => {
          backgroundValue.value = formatCurrency(oldValue.value);
          if (inputRef.value) {
            inputRef.value.value = backgroundValue.value;
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

          onSaved$(diff.toString());
        })} />}
    </>
  );
});

function propagateTargetValue(store: { [key: string]: { value: string; }; }, accounts: Account[], revisionId: string, parentAccountId: string | null, v: string) {
  if (parentAccountId === null) {
    return;
  }

  const a = accounts.find(a => a.id === parentAccountId);
  if (!a) {
    return;
  }

  if (store[`${a.id}:${revisionId}`] === undefined) {
    store[`${a.id}:${revisionId}`] = { value: new Decimal(0).toString() };
  }

  store[`${a.id}:${revisionId}`].value = new Decimal(store[`${a.id}:${revisionId}`].value).add(new Decimal(v)).toString();

  propagateTargetValue(store, accounts, revisionId, a.parentAccountId, v);
};

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

  const matrixValues = useStore<{ [key: string]: { value: string; }; }>({}, {
    deep: true,
  });

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
          Beschreibung
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
          row.values.forEach(value => {
            value.revisions.forEach(revision => {
              matrixValues[`${row.accountId}:${revision.revisionId}`] = { value: new Decimal(revision.targetValue).toString() };
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
              {row.values.map((value) => <>
                {showTarget.value && value.revisions.map((revision) => <td class="p-0 is-vcentered" key={revision.revisionId}>
                  <MatrixInput budgetRevisionId={revision.revisionId} accountId={row.accountId} value={matrixValues[`${row.accountId}:${revision.revisionId}`]} isDisabled={row.isGroup} onSaved$={(v) => {
                    propagateTargetValue(matrixValues, allAccounts.value, revision.revisionId, row.parentAccountId, v);
                  }} />
                </td>)}
                {showActual.value && <td>{value.actualValue}</td>}
                {showDiff.value && value.revisions.map((revision) => <td key={revision.revisionId}>{revision.diffValue}</td>)}
              </>)}
            </tr>)}
          </tbody>
        </table>;
      }} />
    </main>
  </div>);
});
