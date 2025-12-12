import { component$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeLoader$, useNavigate, useLocation } from "@builder.io/qwik-city";
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { Decimal } from "decimal.js/decimal";
import { buildTreeFromDB, Node as AccountNode } from "~/lib/accounts/tree";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { Prisma as P } from "~/lib/prisma/generated/client";

interface AccountAssignment {
  id: string;
  code: string;
  name: string;
  negate: boolean;
  isGroup: boolean;
  actualAmount: string;
  targetAmount: string;
}

function collectLeafAccountIds(node: AccountNode): string[] {
  if (node.children.length === 0) {
    return [node.account.id];
  }
  return node.children.flatMap(c => collectLeafAccountIds(c as AccountNode));
}

interface AccountGroup {
  id: string;
  name: string;
  description: string;
}

interface BudgetRevisionStat {
  budgetId: string;
  budgetName: string;
  revisionIndex: number;
  revisionId: string;
  revisionDate: Date;
  actualAmount: string;
  targetAmount: string;
  diffAmount: string;
}

interface AccountGroupData {
  accountGroup: AccountGroup;
  assignments: AccountAssignment[];
  budgetStats: BudgetRevisionStat[];
  totalActual: string;
  totalTarget: string;
  selectedBudgetRevisionId: string;
}

async function getAccountGroupData(accountGroupId: string, selectedRevisionId?: string): Promise<AccountGroupData | null> {
  const accountGroup = await Prisma.account_groups.findUnique({
    where: { id: accountGroupId },
    include: {
      account_group_assignments: {
        include: {
          accounts: true
        }
      }
    }
  });

  if (!accountGroup) {
    return null;
  }

  const allAccounts = await Prisma.accounts.findMany();
  const tree = buildTreeFromDB(allAccounts);

  const assignmentsRaw = accountGroup.account_group_assignments.map(a => {
    const node = tree.findNodeByAccountId(a.accounts.id) as AccountNode | null;
    const isGroup = node ? node.children.length > 0 : false;
    const leafIds = node ? collectLeafAccountIds(node) : [a.accounts.id];

    return {
      id: a.accounts.id,
      code: a.accounts.display_code,
      name: a.accounts.display_name,
      negate: a.negate,
      isGroup,
      leafIds,
      node
    };
  });

  const accountIds = assignmentsRaw.map(a => a.id);
  const allLeafIds = [...new Set(assignmentsRaw.flatMap(a => a.leafIds))];

  if (accountIds.length === 0) {
    return {
      accountGroup: {
        id: accountGroup.id,
        name: accountGroup.display_name,
        description: accountGroup.display_description
      },
      assignments: [],
      budgetStats: [],
      totalActual: '0',
      totalTarget: '0',
      selectedBudgetRevisionId: ''
    };
  }

  const budgets = await Prisma.budgets.findMany({
    include: {
      budget_revisions: {
        orderBy: { date: 'asc' }
      }
    },
    orderBy: {
      period_start: 'desc'
    }
  });

  if (budgets.length === 0) {
    return {
      accountGroup: {
        id: accountGroup.id,
        name: accountGroup.display_name,
        description: accountGroup.display_description
      },
      assignments: assignmentsRaw.map(a => ({ id: a.id, code: a.code, name: a.name, negate: a.negate, isGroup: a.isGroup, actualAmount: '0', targetAmount: '0' })),
      budgetStats: [],
      totalActual: '0',
      totalTarget: '0',
      selectedBudgetRevisionId: ''
    };
  }

  let selectedBudget = budgets[0];
  let selectedRevision = selectedBudget.budget_revisions[selectedBudget.budget_revisions.length - 1];

  if (selectedRevisionId) {
    for (const budget of budgets) {
      const revision = budget.budget_revisions.find(r => r.id === selectedRevisionId);
      if (revision) {
        selectedBudget = budget;
        selectedRevision = revision;
        break;
      }
    }
  }

  const bravs = await Prisma.budget_revision_account_values.findMany({
    where: {
      budget_revision_id: {
        in: budgets.flatMap(b => b.budget_revisions.map(r => r.id))
      },
      account_id: {
        in: allLeafIds
      }
    }
  });

  const q = P.sql`WITH forward AS (
  SELECT
    b.id AS budget_id,
    t.assigned_account_id,
    t.debit_transaction_account_id,
    t.credit_transaction_account_id,
    SUM(t.amount) AS total
  FROM budgets AS b
  JOIN transactions AS t
    ON t.document_date >= b.period_start
    AND t.document_date <= b.period_end
    AND t.assigned_account_id IS NOT NULL
  WHERE b.id IN (${P.join(budgets.map(b => P.sql`${b.id}::uuid`))})
    AND t.assigned_account_id IN (${P.join(allLeafIds.map(id => P.sql`${id}::uuid`))})
  GROUP BY b.id, t.assigned_account_id, t.debit_transaction_account_id, t.credit_transaction_account_id
)
SELECT
  f1.budget_id,
  f1.assigned_account_id AS account_id,
  SUM(f1.total - COALESCE(f2.total, 0)) AS amount
FROM forward AS f1
LEFT JOIN forward AS f2
  ON f2.budget_id = f1.budget_id
  AND f2.assigned_account_id = f1.assigned_account_id
  AND f2.debit_transaction_account_id = f1.credit_transaction_account_id
  AND f2.credit_transaction_account_id = f1.debit_transaction_account_id
GROUP BY f1.budget_id, f1.assigned_account_id`;

  const avs = await Prisma.$queryRaw<{
    budget_id: string;
    account_id: string;
    amount: PDecimal;
  }[]>(q);

  const negateMap = new Map<string, boolean>();
  assignmentsRaw.forEach(a => negateMap.set(a.id, a.negate));

  const assignments: AccountAssignment[] = assignmentsRaw.map(a => {
    let actualAmount = new Decimal(0);
    let targetAmount = new Decimal(0);

    for (const leafId of a.leafIds) {
      const av = avs.find(v => v.budget_id === selectedBudget.id && v.account_id === leafId);
      if (av) {
        actualAmount = actualAmount.add(new Decimal(av.amount));
      }

      const brav = bravs.find(b => b.budget_revision_id === selectedRevision.id && b.account_id === leafId);
      if (brav) {
        targetAmount = targetAmount.add(new Decimal(brav.value));
      }
    }

    return {
      id: a.id,
      code: a.code,
      name: a.name,
      negate: a.negate,
      isGroup: a.isGroup,
      actualAmount: actualAmount.toString(),
      targetAmount: targetAmount.toString()
    };
  });

  const budgetStats: BudgetRevisionStat[] = [];

  for (const budget of budgets) {
    for (let i = 0; i < budget.budget_revisions.length; i++) {
      const revision = budget.budget_revisions[i];

      let actualSum = new Decimal(0);
      let targetSum = new Decimal(0);

      for (const assignment of assignmentsRaw) {
        const multiplier = assignment.negate ? -1 : 1;

        for (const leafId of assignment.leafIds) {
          const av = avs.find(a => a.budget_id === budget.id && a.account_id === leafId);
          if (av) {
            actualSum = actualSum.add(new Decimal(av.amount).mul(multiplier));
          }

          const brav = bravs.find(b => b.budget_revision_id === revision.id && b.account_id === leafId);
          if (brav) {
            targetSum = targetSum.add(new Decimal(brav.value).mul(multiplier));
          }
        }
      }

      budgetStats.push({
        budgetId: budget.id,
        budgetName: budget.display_name,
        revisionIndex: i,
        revisionId: revision.id,
        revisionDate: revision.date,
        actualAmount: actualSum.toString(),
        targetAmount: targetSum.toString(),
        diffAmount: targetSum.sub(actualSum).toString()
      });
    }
  }

  const totalActual = assignments.reduce((sum, a) => {
    const multiplier = a.negate ? -1 : 1;
    return sum.add(new Decimal(a.actualAmount).mul(multiplier));
  }, new Decimal(0)).toString();
  const totalTarget = assignments.reduce((sum, a) => {
    const multiplier = a.negate ? -1 : 1;
    return sum.add(new Decimal(a.targetAmount).mul(multiplier));
  }, new Decimal(0)).toString();

  return {
    accountGroup: {
      id: accountGroup.id,
      name: accountGroup.display_name,
      description: accountGroup.display_description
    },
    assignments,
    budgetStats,
    totalActual,
    totalTarget,
    selectedBudgetRevisionId: selectedRevision.id
  };
}

export const useGetAccountGroupLoader = routeLoader$<AccountGroupData>(async (req) => {
  const selectedRevisionId = req.query.get('revisionId') ?? undefined;
  const data = await getAccountGroupData(req.params.accountGroupId, selectedRevisionId);

  if (!data) {
    throw req.redirect(307, "/accountGroups");
  }

  return data;
});

export default component$(() => {
  const loader = useGetAccountGroupLoader();
  const nav = useNavigate();
  const loc = useLocation();
  const { accountGroup, assignments, budgetStats, totalActual, totalTarget, selectedBudgetRevisionId } = loader.value;

  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/accountGroups">Kontengruppen</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">{accountGroup.name}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>

        {accountGroup.description && (
          <div class="content mb-5">
            <p>{accountGroup.description}</p>
          </div>
        )}

        <div class="columns">
          <div class="column is-half">
            <div class="is-flex is-justify-content-space-between is-align-items-center">
              <h2 class="title is-5">Zugewiesene Konten</h2>
              {budgetStats.length > 0 && (
                <div class="field is-grouped is-grouped-right">
                  <label class="label is-small mr-2">Budget-Revision</label>
                  <div class="control">
                    <div class="select is-small">
                      <select onChange$={(_, el) => nav(`${loc.url.pathname}?revisionId=${el.value}`)}>
                        {budgetStats.map(stat => (
                          <option
                            key={stat.revisionId}
                            value={stat.revisionId}
                            selected={stat.revisionId === selectedBudgetRevisionId}
                          >
                            {stat.revisionIndex > 0
                              ? `${stat.budgetName} (Rev. ${stat.revisionIndex + 1}, ${formatDateShort(stat.revisionDate)})`
                              : `${stat.budgetName} (${formatDateShort(stat.revisionDate)})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {assignments.length === 0 ? (
              <p class="has-text-grey">Keine Konten zugewiesen.</p>
            ) : (
              <table class="table is-striped is-narrow is-hoverable is-fullwidth">
                <thead>
                  <tr>
                    <th>Konto</th>
                    <th>Name</th>
                    <th class="has-text-centered">Modus</th>
                    <th class="has-text-right">Soll</th>
                    <th class="has-text-right">Ist</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id}>
                      <td>{a.code}</td>
                      <td>{a.name}</td>
                      <td class="has-text-centered">
                        <span class={["tag", a.negate ? "is-danger" : "is-success"]}>
                          {a.negate ? "−" : "+"}
                        </span>
                      </td>
                      <td class="has-text-right">{formatCurrency(a.targetAmount)}</td>
                      <td class="has-text-right">{formatCurrency(a.actualAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Summe</th>
                    <th class="has-text-right">{formatCurrency(totalTarget)}</th>
                    <th class="has-text-right">{formatCurrency(totalActual)}</th>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div class="column is-half">
            <h2 class="title is-5">Budget-Statistiken</h2>
            {budgetStats.length === 0 ? (
              <p class="has-text-grey">Keine Budget-Daten verfügbar.</p>
            ) : (
              <table class="table is-striped is-narrow is-hoverable is-fullwidth">
                <thead>
                  <tr>
                    <th>Budget / Revision</th>
                    <th class="has-text-right">Soll</th>
                    <th class="has-text-right">Ist</th>
                    <th class="has-text-right">Diff.</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetStats.map(stat => (
                    <tr key={`${stat.budgetId}-${stat.revisionId}`}>
                      <td>
                        {stat.budgetName}
                        {stat.revisionIndex > 0 && (
                          <span class="has-text-grey is-size-7"> (Rev. {stat.revisionIndex + 1})</span>
                        )}
                      </td>
                      <td class="has-text-right">{formatCurrency(stat.targetAmount)}</td>
                      <td class="has-text-right">{formatCurrency(stat.actualAmount)}</td>
                      <td class="has-text-right">{formatCurrency(stat.diffAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: "VSFV | Kontengruppe",
  meta: [],
};
