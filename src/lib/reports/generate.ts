import { Decimal } from "decimal.js";
import { Prisma } from "~/lib/prisma";
import { accountsModel } from "~/lib/prisma/generated/models";
import { Prisma as P } from "~/lib/prisma/generated/client";
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { Account as ReportAccount, renderReport, renderReportHtml } from "~/lib/reports/render";
import { buildTreeFromDB, Node as AccountNode } from "~/lib/accounts/tree";
import { describe } from "node:test";



function bravKey(budgetRevisionId: string, accountId: string): string {
  return `${budgetRevisionId}:${accountId}`;
}

function avKey(budgetId: string, accountId: string): string {
  return `${budgetId}:${accountId}`;
}

function filterReachableAccounts(
  allAccounts: accountsModel[],
  selectedIds: string[] | Set<string>
): accountsModel[] {
  const allowedIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

  const byId = new Map<string, accountsModel>();
  for (const acc of allAccounts) {
    byId.set(acc.id, acc);
  }

  const reachableCache = new Map<string, boolean>();

  const isReachable = (id: string): boolean => {
    if (reachableCache.has(id)) {
      return reachableCache.get(id)!;
    }

    const account = byId.get(id);
    if (!account) {
      reachableCache.set(id, false);
      return false;
    }

    if (allowedIds.has(id)) {
      reachableCache.set(id, true);
      return true;
    }

    if (account.parent_account_id == null) {
      reachableCache.set(id, false);
      return false;
    }

    const result = isReachable(account.parent_account_id);
    reachableCache.set(id, result);
    return result;
  };

  return allAccounts.filter((acc) => isReachable(acc.id));
}

interface ReportRenderData {
  template: string;
  params: {
    accounts?: ReportAccount[];
    budgets?: {
      id: string;
      name: string;
      description: string;
      periodStart: Date;
      periodEnd: Date;
      revisions: {
        id: string;
        name: string;
        description: string;
        date: Date;
      }[];
    }[];
    getTargetValueHandler?: (budgetRevisionId: string, accountId: string) => Decimal;
    getDiffValueHandler?: (budgetRevisionId: string, accountId: string) => Decimal;
    getActualValueHandler?: (budgetId: string, accountId: string) => Decimal;
    actualValuesEnabled?: boolean;
    targetValuesEnabled?: boolean;
    differenceValuesEnabled?: boolean;
    accountDescriptionsEnabled?: boolean;
    budgetDescriptionsEnabled?: boolean;
  };
}

async function buildReportRenderData(
  reportTemplateId: string,
  selectedBudgetIds: string[],
  selectedAccountIds: string[],
  actualValuesEnabled: boolean,
  targetValuesEnabled: boolean,
  differenceValuesEnabled: boolean,
  accountDescriptionsEnabled: boolean,
  budgetDescriptionsEnabled: boolean,
  latestRevisionOnly: boolean
): Promise<ReportRenderData> {
  const reportTemplate = await Prisma.report_templates.findUnique({
    where: {
      id: reportTemplateId
    }
  });

  if (reportTemplate == null) {
    throw new Error('Report template not found');
  }

  const budgetsRaw = await Prisma.budgets.findMany({
    where: {
      id: {
        in: selectedBudgetIds
      }
    },
    include: {
      budget_revisions: {
        orderBy: {
          date: 'asc'
        }
      }
    }
  });

  const budgets = budgetsRaw.map(b => ({
    ...b,
    budget_revisions: latestRevisionOnly && b.budget_revisions.length > 0
      ? [ { ...b.budget_revisions[b.budget_revisions.length - 1], idx: b.budget_revisions.length - 1 } ]
      : b.budget_revisions.map((x, i) => ({
        ...x,
        idx: i,
      }))
  }));

  const allAccounts = filterReachableAccounts(await Prisma.accounts.findMany({
    orderBy: {
      display_code: 'asc'
    }
  }), selectedAccountIds);

  const bravs = await Prisma.budget_revision_account_values.findMany({
    where: {
      budget_revision_id: {
        in: budgets.flatMap(b => b.budget_revisions.map(r => r.id))
      },
      account_id: {
        in: allAccounts.map(a => a.id)
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
    WHERE b.id IN (${P.join(budgets.map(b => P.sql`${b.id}::uuid`))})
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

  const bravMap = new Map<string, Decimal>();
  const avMap = new Map<string, Decimal>();
  const brbMap = new Map<string, string>();

  budgets.forEach(b => {
    b.budget_revisions.forEach(r => {
      brbMap.set(r.id, b.id);
    });
  });

  const tree = buildTreeFromDB(allAccounts);

  const sumActualChildren = (node: AccountNode, budgetId: string): Decimal => {
    let sum = new Decimal(0);

    node.children.forEach(x => {
      if (x.children.length > 0) {
        sum = sum.add(sumActualChildren(x as AccountNode, budgetId));
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
        sum = sum.add(sumTargetChildren(x as AccountNode, revisionId));
        return;
      }

      const brav = bravs.find(br => br.account_id === x.account.id && br.budget_revision_id === revisionId);

      if (brav) {
        sum = sum.add(new Decimal(brav.value));
      }
    });

    return sum;
  };

  // Check if an account (or any descendant for group accounts) has any non-zero target or actual values
  const hasNonZeroValues = (node: AccountNode): boolean => {
    const isGroup = node.children.length > 0;

    if (isGroup) {
      // For group accounts, check if any child has non-zero values
      return node.children.some(child => hasNonZeroValues(child as AccountNode));
    }

    // For leaf accounts, check if any budget revision has a non-zero target value
    const hasNonZeroTarget = budgets.some(b =>
      b.budget_revisions.some(r => {
        const brav = bravs.find(br => br.account_id === node.account.id && br.budget_revision_id === r.id);
        return brav && !new Decimal(brav.value).isZero();
      })
    );

    if (hasNonZeroTarget) {
      return true;
    }

    // Also check if any budget has a non-zero actual value
    const hasNonZeroActual = budgets.some(b => {
      const av = avs.find(av => av.account_id === node.account.id && av.budget_id === b.id);
      return av && !new Decimal(av.amount).isZero();
    });

    return hasNonZeroActual;
  };

  const buildReportAccountTree = (node: AccountNode): ReportAccount | null => {
    // Skip accounts (and their parents) with no non-zero target or actual values
    if (!hasNonZeroValues(node)) {
      return null;
    }

    const isGroup = node.children.length > 0;

    budgets.forEach(b => {
      let actualValue = new Decimal(0);

      if (isGroup) {
        actualValue = sumActualChildren(node, b.id);
      } else {
        const av = avs.find(av => av.budget_id === b.id && av.account_id === node.account.id);
        if (av) {
          actualValue = new Decimal(av.amount);
        }
      }

      avMap.set(avKey(b.id, node.account.id), actualValue);

      b.budget_revisions.forEach((r) => {
        let tV: Decimal = new Decimal(0);
        if (isGroup) {
          tV = sumTargetChildren(node, r.id);
        } else {
          const brav = bravs.find(br => br.account_id === node.account.id && br.budget_revision_id === r.id);
          if (brav) {
            tV = new Decimal(brav.value);
          }
        }

        bravMap.set(bravKey(r.id, node.account.id), tV);
      });
    });

    const children: ReportAccount[] = [];
    const sortedChildren = node.getSortedChildren();

    for (let i = 0; i < sortedChildren.length; i++) {
      const child = buildReportAccountTree(sortedChildren[i] as AccountNode);
      if (child !== null) {
        children.push(child);
      }
    }

    return {
      id: node.account.id,
      isLeaf: !isGroup,
      code: node.account.code,
      name: node.account.name,
      depth: node.depth + 1,
      children,
      description: node.account.description,
      isArchived: node.account.isArchived
    };
  };

  const rootAccountsForReport: ReportAccount[] = [];

  tree.getSortedChildren().forEach(rootNode => {
    const account = buildReportAccountTree(rootNode as AccountNode);
    if (account !== null) {
      rootAccountsForReport.push(account);
    }
  });

  const accountsForReport: ReportAccount[] = [{
    id: 'root',
    isLeaf: rootAccountsForReport.length === 0,
    code: '',
    name: '',
    depth: 0,
    description: '',
    children: rootAccountsForReport
  }];

  return {
    template: reportTemplate.template,
    params: {
      actualValuesEnabled,
      targetValuesEnabled,
      differenceValuesEnabled,
      accountDescriptionsEnabled,
      budgetDescriptionsEnabled,
      getActualValueHandler: (budgetId: string, accountId: string) => {
        return avMap.get(avKey(budgetId, accountId)) ?? new Decimal(0);
      },
      getTargetValueHandler: (budgetRevisionId: string, accountId: string) => {
        return bravMap.get(bravKey(budgetRevisionId, accountId)) ?? new Decimal(0);
      },
      getDiffValueHandler: (budgetRevisionId: string, accountId: string) => {
        const bId = brbMap.get(budgetRevisionId);
        const av = avMap.get(avKey(bId ?? '', accountId)) ?? new Decimal(0);
        const tv = bravMap.get(bravKey(budgetRevisionId, accountId)) ?? new Decimal(0);

        return tv.sub(av);
      },
      budgets: budgets.map(x => ({
        id: x.id,
        name: x.display_name,
        description: x.display_description,
        periodStart: x.period_start,
        periodEnd: x.period_end,
        revisions: x.budget_revisions.map((x) => ({
          id: x.id,
          name: `Rev. ${x.idx + 1}`,
          description: x.display_description,
          date: x.date
        }))
      })),
      accounts: accountsForReport
    }
  };
}

export async function generateReportPdf(
  html2pdfUrl: string,
  reportTemplateId: string,
  selectedBudgetIds: string[],
  selectedAccountIds: string[],
  actualValuesEnabled: boolean,
  targetValuesEnabled: boolean,
  differenceValuesEnabled: boolean,
  accountDescriptionsEnabled: boolean,
  budgetDescriptionsEnabled: boolean,
  latestRevisionOnly: boolean
): Promise<Blob> {
  const data = await buildReportRenderData(
    reportTemplateId,
    selectedBudgetIds,
    selectedAccountIds,
    actualValuesEnabled,
    targetValuesEnabled,
    differenceValuesEnabled,
    accountDescriptionsEnabled,
    budgetDescriptionsEnabled,
    latestRevisionOnly
  );

  const d = await renderReport(
    data.template,
    html2pdfUrl,
    data.params
  );

  return d;
}

export async function generateReportHtml(
  reportTemplateId: string,
  selectedBudgetIds: string[],
  selectedAccountIds: string[],
  actualValuesEnabled: boolean,
  targetValuesEnabled: boolean,
  differenceValuesEnabled: boolean,
  accountDescriptionsEnabled: boolean,
  budgetDescriptionsEnabled: boolean,
  latestRevisionOnly: boolean
): Promise<string> {
  const data = await buildReportRenderData(
    reportTemplateId,
    selectedBudgetIds,
    selectedAccountIds,
    actualValuesEnabled,
    targetValuesEnabled,
    differenceValuesEnabled,
    accountDescriptionsEnabled,
    budgetDescriptionsEnabled,
    latestRevisionOnly
  );

  return renderReportHtml(
    data.template,
    data.params
  );
}
