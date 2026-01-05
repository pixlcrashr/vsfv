import { component$, Signal, useComputed$, useStore, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Account, Budget, Matrix } from "~/routes/matrix/index@menu";
import TargetValueInput from "./TargetValueInput";
import { Decimal } from 'decimal.js/decimal';
import styles from "./MatrixTable.scss?inline";



export interface MatrixTableProps {
  showDescription?: Signal<boolean>;
  showTarget?: Signal<boolean>;
  showActual?: Signal<boolean>;
  showDiff?: Signal<boolean>;
  matrix: Signal<Matrix>;
  allBudgets: Budget[];
  allAccounts: Account[];
}

export type StringMap = { [key: string]: string };

function actualValueKey(accountId: string, budgetId: string) {
  return `${accountId}:${budgetId}`;
}

function targetValueKey(accountId: string, budgetRevisionId: string) {
  return `${accountId}:${budgetRevisionId}`;
}

function diffValueKey(accountId: string, budgetRevisionId: string) {
  return `${accountId}:${budgetRevisionId}`;
}

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

  if (targetValues[targetValueKey(a.id, revisionId)] === undefined) {
    targetValues[targetValueKey(a.id, revisionId)] = new Decimal(0).toString();
  }

  const tV = new Decimal(targetValues[targetValueKey(a.id, revisionId)]).add(new Decimal(v));
  targetValues[targetValueKey(a.id, revisionId)] = tV.toString();

  const aV = new Decimal(actualValues[actualValueKey(a.id, brbMap.get(revisionId) ?? '') ] ?? '0');
  diffValues[diffValueKey(a.id, revisionId)] = tV.sub(aV).toString();

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

export default component$<MatrixTableProps>(({
  showDescription,
  showTarget,
  showActual,
  showDiff,
  matrix,
  allBudgets,
  allAccounts
}) => {
  useStylesScoped$(styles);

  const budgetRevisionIdToBudgetIdMap = new Map<string, string>();
  budgetRevisionIdToBudgetIdMap.clear();
  allBudgets.forEach(b => {
    b.revisions.forEach(r => {
      budgetRevisionIdToBudgetIdMap.set(r.id, b.id);
    });
  });

  const targetValues = useStore<StringMap>({}, { deep: true });
  const actualValues = useStore<StringMap>({}, { deep: true });
  const diffValues = useStore<StringMap>({}, { deep: true });

  useTask$(({ track }) => {
    track(() => matrix.value);
    
    matrix.value.items.forEach(row => {
      row.values.forEach((value, i) => {
        actualValues[actualValueKey(row.accountId, matrix.value.headers[i].budgetId)] = value.actualValue;

        value.revisions.forEach(revision => {
          targetValues[targetValueKey(row.accountId, revision.revisionId)] = revision.targetValue;
          diffValues[diffValueKey(row.accountId, revision.revisionId)] = revision.diffValue;
        });
      });
    });
  });

  const budgetColSpan = useComputed$(() => {
    return (showTarget?.value ? 1 : 0) + (showActual?.value ? 1 : 0) + (showDiff?.value ? 1 : 0);
  });

  return <>
    <table class="table is-bordered">
      <thead>
        <tr>
          <th rowSpan={2} colSpan={matrix.value.maxDepth + 1}>Konto</th>
          <th rowSpan={2}>Titel</th>
          {showDescription?.value && <th rowSpan={2}>Beschreibung</th>}
          {(showTarget?.value || showActual?.value || showDiff?.value) && <>
            {matrix.value.headers.map((h) => <th key={h.budgetId} colSpan={budgetColSpan.value + (h.budgetRevisions.length - 1) * ((showTarget?.value ? 1 : 0) + (showDiff?.value ? 1 : 0))}>{h.budgetName}</th>)}
          </>}
        </tr>
        <tr>
          {matrix.value.headers.map((h) => <>
            {showTarget?.value && h.budgetRevisions.map((revision, i) => <th key={revision.id}>Soll{i > 0 ? ` (Rev. ${i + 1}, ${formatDateShort(revision.date)})` : ''}</th>)}
            {showActual?.value && <th>Ist</th>}
            {showDiff?.value && h.budgetRevisions.map((revision, i) => <th key={revision.id}>Diff.{i > 0 ? ` (Rev. ${i + 1}, ${formatDateShort(revision.date)})` : ''}</th>)}
          </>)}
        </tr>
      </thead>
      <tbody>
        {matrix.value.items.map((row) => <tr key={row.accountId}>
          {Array.from({ length: matrix.value.maxDepth + 1 }).map((_, j) => <td class="is-vcentered" key={j}>
            {j === row.depth ? row.accountCode : ''}
          </td>)}
          <td>{row.accountName}</td>
          {showDescription?.value && <td>{row.accountDescription}</td>}
          {row.values.map((value, i) => <>
            {showTarget?.value && value.revisions.map((revision) => <td class="p-0 is-vcentered" key={revision.revisionId}>
              {row.isGroup ?
                <p class="pl-2 pr-2">{formatCurrency(targetValues[targetValueKey(row.accountId, revision.revisionId)] ?? '0')}</p> :
                <TargetValueInput
                  tabIndex={10 + i}
                  value={targetValues[targetValueKey(row.accountId, revision.revisionId)] ?? '0'}
                  accountId={row.accountId}
                  budgetRevisionId={revision.revisionId}
                  onSaved$={(event) => {
                    propagateMatrixValues(
                      budgetRevisionIdToBudgetIdMap,
                      targetValues,
                      actualValues,
                      diffValues,
                      allAccounts,
                      revision.revisionId,
                      row.parentAccountId,
                      event.change.diff
                    );
                  }} />}
            </td>)}
            {showActual?.value && <td class="disabled-cell">{formatCurrency(actualValues[actualValueKey(row.accountId, matrix.value.headers[i].budgetId)] ?? '0')}</td>}
            {showDiff?.value && value.revisions.map((revision) => <td class="disabled-cell" key={revision.revisionId}>{formatCurrency(diffValues[`${row.accountId}:${revision.revisionId}`] ?? '0')}</td>)}
          </>)}
        </tr>)}
      </tbody>
    </table>
  </>;
})
