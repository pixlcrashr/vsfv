import { component$, Signal, useComputed$, useStore, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { formatCurrency } from "~/lib/format";
import { Account, Budget, Matrix } from "~/routes/matrix/index@menu";
import TargetValueInput from "./TargetValueInput";
import { Decimal } from 'decimal.js';
import styles from "./MatrixTable.scss?inline";



export interface MatrixTableProps {
  showDescription?: Signal<boolean>;
  showTarget?: Signal<boolean>;
  showActual?: Signal<boolean>;
  showDiff?: Signal<boolean>;
  showOnlyLatestRevision?: Signal<boolean>;
  matrix: Signal<Matrix>;
  allBudgets: Budget[];
  allAccounts: Account[];
  canEdit?: boolean;
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
  showOnlyLatestRevision,
  matrix,
  allBudgets,
  allAccounts,
  canEdit = false
}) => {
  const budgetClosedMap = new Map<string, boolean>();
  allBudgets.forEach(b => {
    budgetClosedMap.set(b.id, b.isClosed);
  });
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
    
    // Clear existing values before populating
    Object.keys(actualValues).forEach(key => delete actualValues[key]);
    Object.keys(targetValues).forEach(key => delete targetValues[key]);
    Object.keys(diffValues).forEach(key => delete diffValues[key]);
    
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

  // Compute filtered headers based on showOnlyLatestRevision
  const filteredHeaders = useComputed$(() => {
    return matrix.value.headers.map(h => ({
      ...h,
      budgetRevisions: showOnlyLatestRevision?.value 
        ? (h.budgetRevisions.length > 0 ? [h.budgetRevisions[h.budgetRevisions.length - 1]] : [])
        : h.budgetRevisions
    }));
  });

  // Precompute latest revision IDs per budget index
  const latestRevisionIds = useComputed$(() => {
    return matrix.value.headers.map(h => 
      h.budgetRevisions.length > 0 ? h.budgetRevisions[h.budgetRevisions.length - 1].id : null
    );
  });

  // Precompute editable revision IDs (set for fast lookup)
  const editableRevisionIds = useComputed$(() => {
    if (!canEdit) return new Set<string>();
    const editable = new Set<string>();
    matrix.value.headers.forEach((h) => {
      const isClosed = budgetClosedMap.get(h.budgetId) ?? false;
      if (!isClosed && h.budgetRevisions.length > 0) {
        editable.add(h.budgetRevisions[h.budgetRevisions.length - 1].id);
      }
    });
    return editable;
  });

  // Precompute filtered revisions for each item and budget
  const filteredItemRevisions = useComputed$(() => {
    return matrix.value.items.map(row => 
      row.values.map((value, i) => {
        if (showOnlyLatestRevision?.value) {
          const latestId = latestRevisionIds.value[i];
          if (latestId) {
            const latestRevision = value.revisions.find(r => r.revisionId === latestId);
            return latestRevision ? [latestRevision] : [];
          }
          return [];
        }
        return value.revisions;
      })
    );
  });

  return <>
    <table class="table is-bordered">
      <thead>
        <tr>
          <th rowSpan={2} colSpan={matrix.value.maxDepth + 1}>Konto</th>
          <th rowSpan={2}>Titel</th>
          {showDescription?.value && <th rowSpan={2}>Beschreibung</th>}
          {(showTarget?.value || showActual?.value || showDiff?.value) && <>
            {filteredHeaders.value.map((h) => <th key={h.budgetId} colSpan={budgetColSpan.value + (h.budgetRevisions.length - 1) * ((showTarget?.value ? 1 : 0) + (showDiff?.value ? 1 : 0))}>{h.budgetName}</th>)}
          </>}
        </tr>
        <tr>
          {filteredHeaders.value.map((h) => <>
            {showTarget?.value && h.budgetRevisions.map((revision) => <th key={revision.id}>{revision.displayName}</th>)}
            {showActual?.value && <th>Ist</th>}
            {showDiff?.value && h.budgetRevisions.map((revision) => <th key={revision.id}>{revision.displayName.replace('Soll', 'Diff.')}</th>)}
          </>)}
        </tr>
      </thead>
      <tbody>
        {matrix.value.items.map((row, rowIndex) => {
          const rowFilteredRevisions = filteredItemRevisions.value[rowIndex];
          return (
            <tr key={row.accountId}>
              {Array.from({ length: matrix.value.maxDepth + 1 }).map((_, j) => <td class="is-vcentered" key={j}>
                {j === row.depth ? row.accountCode : ''}
              </td>)}
              <td>{row.accountName}</td>
              {showDescription?.value && <td class="description-cell" title={row.accountDescription}>{row.accountDescription}</td>}
              {row.values.map((value, i) => {
                const revisions = rowFilteredRevisions[i];
                return (<>
                  {showTarget?.value && revisions.map((revision) => {
                    const isEditable = editableRevisionIds.value.has(revision.revisionId);
                    const showInput = isEditable && !row.isGroup;
                    return (
                      <td class={["is-vcentered", { "p-0": showInput, "editable-cell": showInput, "readonly-cell": !showInput }]} key={revision.revisionId}>
                        {row.isGroup ?
                          <span>{formatCurrency(targetValues[targetValueKey(row.accountId, revision.revisionId)] ?? '0')}</span> :
                          (isEditable ?
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
                              }} /> :
                            <span>{formatCurrency(targetValues[targetValueKey(row.accountId, revision.revisionId)] ?? '0')}</span>)
                        }
                      </td>
                    );
                  })}
                  {showActual?.value && <td class="disabled-cell">{formatCurrency(actualValues[actualValueKey(row.accountId, matrix.value.headers[i].budgetId)] ?? '0')}</td>}
                  {showDiff?.value && revisions.map((revision) => <td class="disabled-cell" key={revision.revisionId}>{formatCurrency(diffValues[`${row.accountId}:${revision.revisionId}`] ?? '0')}</td>)}
                </>);
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  </>;
})
