import { component$, Signal, useComputed$, useStore, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { formatCurrency, formatDateShort } from "~/lib/format";
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
  hasEditPermission?: boolean;
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
  canEdit = false,
  hasEditPermission = false
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
    <table>
      <thead>
        <tr>
          <th colSpan={matrix.value.maxDepth + 1}>Konto - Titel</th>
          <th class="border-cell-dark"></th>
          {showDescription?.value && <>
            <th>Beschreibung</th>
            <th class="border-cell-dark"></th>
          </>}
          {(showTarget?.value || showActual?.value || showDiff?.value) && <>
            {filteredHeaders.value.map((h) => {
              const revisionKindCount = ((showTarget?.value ? 1 : 0) + (showDiff?.value ? 1 : 0));
              const revisionColSpan = h.budgetRevisions.length * revisionKindCount;
              const revisionColSpanBorder = revisionColSpan + Math.max(0, revisionColSpan - 1);
              
              const colSpan = revisionColSpanBorder + (showActual?.value ? 2 : 0);

              return <>
                <th class="budget-th-cell" key={h.budgetId} colSpan={colSpan}>{h.budgetName}</th>
                <th class="border-cell-dark"></th>
              </>;
          })}
          </>}
        </tr>
        <tr>
          <th colSpan={matrix.value.maxDepth + 1}></th>
          <th class="border-cell-dark"></th>
          {showDescription?.value && <>
            <th></th>
            <th class="border-cell-dark"></th>
          </>}
          {filteredHeaders.value.map((h) => <>
            {h.budgetRevisions.map((r) => {
              const colSpan = (showTarget?.value ? 1 : 0) + (showDiff?.value ? 1 : 0);

              return <>
                <th class="revision-th-cell" colSpan={colSpan + (colSpan === 2 ? 1 : 0)}>
                  Revision {r.number}<br />
                  <i>{formatDateShort(r.date)}</i>
                </th>
                <th class="border-cell-dark"></th>
              </>;
            })}
            {showActual?.value && <>
              <th></th>
              <th class="border-cell-dark"></th>
            </>}
          </>)}
        </tr>
        <tr>
          {Array.from({ length: matrix.value.maxDepth + 1 }).map((_, j) => <th class="title-cell" key={j}></th>)}
          <th class="border-cell-dark"></th>
          {showDescription?.value && <>
            <th></th>
            <th class="border-cell-dark"></th>
          </>}
          {filteredHeaders.value.map((h) => <>
            {h.budgetRevisions.map(() => <>
              {showTarget?.value && <>
                <th class="revision-value-type-th-cell">Soll</th>
                <th class={{
                    'border-cell-dark': !showDiff?.value,
                    'border-cell-light': showDiff?.value
                  }}></th>
              </>}
              {showDiff?.value && <>
                <th class="revision-value-type-th-cell">Diff.</th>
                <th class="border-cell-dark"></th>
              </>}
            </>)}
            {showActual?.value && <>
              <th class="revision-value-type-th-cell">Ist</th>
              <th class="border-cell-dark"></th>
            </>}
          </>)}
        </tr>
      </thead>
      <tbody>
        {matrix.value.items.map((row, rowIndex) => {
          const rowFilteredRevisions = filteredItemRevisions.value[rowIndex];

          return (
            <>
              <tr key={row.accountId}>
                {row.depth > 0 && <td colSpan={row.depth}></td>}
                <td style={{
                    fontWeight: row.isSum || row.isGroup ? 'bold' : 'normal'
                  }} colSpan={matrix.value.maxDepth - row.depth + 1}>{row.isSum && <>Summe ∑ </>}{row.accountCode} &#8211; {row.accountName}</td>
                <th class="border-cell-dark"></th>

                {showDescription?.value && <>
                  <td class="description-cell" title={row.accountDescription}>{row.accountDescription}</td>
                  <th class="border-cell-dark"></th>
                </>}
                {row.values.map((value, i) => {
                  const revisions = rowFilteredRevisions[i];
                  return (<>
                    {revisions.map(r => {
                      const isEditable = hasEditPermission && editableRevisionIds.value.has(r.revisionId);
                      const showInput = isEditable && !row.isGroup;

                      return <>
                        {showTarget?.value && <>
                          <td class={["is-vcentered", {"p-0": showInput, "editable-cell": showInput, "readonly-cell": !showInput }]} key={r.revisionId}>
                            {row.isGroup ?
                              <span style={{
                                fontWeight: row.isSum ? 'bold' : 'normal'
                              }}>{(!row.isGroup || row.isSum) && formatCurrency(targetValues[targetValueKey(row.accountId, r.revisionId)] ?? '0')}</span> :
                              (isEditable ?
                                <TargetValueInput
                                  tabIndex={10 + i}
                                  value={targetValues[targetValueKey(row.accountId, r.revisionId)] ?? '0'}
                                  accountId={row.accountId}
                                  budgetRevisionId={r.revisionId}
                                  onSaved$={(event) => {
                                    // Update the current cell's target and diff values
                                    const budgetId = budgetRevisionIdToBudgetIdMap.get(r.revisionId) ?? '';
                                    const newTargetValue = event.change.new;
                                    const actualValue = new Decimal(actualValues[actualValueKey(row.accountId, budgetId)] ?? '0');

                                    targetValues[targetValueKey(row.accountId, r.revisionId)] = newTargetValue.toString();
                                    diffValues[diffValueKey(row.accountId, r.revisionId)] = newTargetValue.sub(actualValue).toString();

                                    // Propagate to parent accounts
                                    propagateMatrixValues(
                                      budgetRevisionIdToBudgetIdMap,
                                      targetValues,
                                      actualValues,
                                      diffValues,
                                      allAccounts,
                                      r.revisionId,
                                      row.parentAccountId,
                                      event.change.diff
                                    );
                                  }} /> :
                                <span>{formatCurrency(targetValues[targetValueKey(row.accountId, r.revisionId)] ?? '0')}</span>)
                            }
                          </td>
                          <td class={{
                            'border-cell-dark': !showDiff?.value,
                            'border-cell-light': showDiff?.value
                          }}></td>
                        </>}
                        {showDiff?.value && <>
                          <td class="readonly-cell" style={{
                              fontWeight: row.isSum ? 'bold' : 'normal'
                            }} key={r.revisionId}>{(!row.isGroup || row.isSum) && formatCurrency(diffValues[`${row.accountId}:${r.revisionId}`] ?? '0')}</td>
                          <td class="border-cell-dark"></td>
                        </>}
                      </>;
                    })}
                    {showActual?.value && <>
                      <td class="readonly-cell" style={{
                        fontWeight: row.isSum ? 'bold' : 'normal'
                      }}><i>{(!row.isGroup || row.isSum) && formatCurrency(actualValues[actualValueKey(row.accountId, matrix.value.headers[i].budgetId)] ?? '0')}</i></td>
                      <td class="border-cell-dark"></td>
                    </>}
                  </>);
                })}
              </tr>
              {row.isSum && <tr class="empty-row">
                <td colSpan={matrix.value.maxDepth + 1}></td>
                <td class="border-cell-dark"></td>
                {showDescription?.value && <>
                  <td></td>
                  <td class="border-cell-dark"></td>
                </>}
                {row.values.map((value, i) => {
                  const revisions = rowFilteredRevisions[i];
                  return (<>
                    {revisions.map(r => <>
                      {showTarget?.value && <><td key={r.revisionId}></td><td class={{
                        'border-cell-dark': !showDiff?.value,
                        'border-cell-light': showDiff?.value
                      }}></td></>}
                      {showDiff?.value && <><td key={r.revisionId}></td><td class="border-cell-dark"></td></>}
                    </>)}
                    {showActual?.value && <><td></td><td class="border-cell-dark"></td></>}
                  </>);
                })}
              </tr>}
            </>
          );
        })}
      </tbody>
    </table>
  </>;
})
